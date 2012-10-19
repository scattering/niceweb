#!/usr/bin/env python
"""
Tornado server providing a socket.io repeater for NICE publish-subscribe
streams.
"""

from pprint import pprint
import sys
import os
import re
import time
import functools
import json
import gzip
import socket

from tornado import web
import tornadio2 as sio

import cookie

ROOT = os.path.normpath(os.path.dirname(__file__))

CAPTURE_START = time.time()
CAPTURE_FILE = None
def store_event(channel, event, args, kw):
    if CAPTURE_FILE is not None:
        #print "storing",event,"from",channel,"to",CAPTURE_FILE
        if kw: args = [kw]
        CAPTURE_FILE.write('[%g,"%s","%s",%s]\n'
                   % (time.time()-CAPTURE_START, channel,event, json.dumps(args)))
        CAPTURE_FILE.flush()

def capture(fn):
    """
    Decorator for capturing certain types of events to a file so that they
    can be later replayed.

    Note: this would be better handled by modifying SubscriptionChannel so
    that every method doesn't need the decorator, and it could instead be a
    constructor option.  Consider doing so if other event streams need to be
    captured.
    """
    
    @functools.wraps(fn)
    def wrapper(self, *args, **kw):
        store_event(self.channel, fn.func_name, args, kw)
        return fn(self, *args, **kw)
    return wrapper

class IndexHandler(web.RequestHandler):
    """Regular HTTP handler to serve the index.html page"""
    def get(self):
        self.render('index.html')

class RestHandler(web.RequestHandler):
    """
    RESTful interface to channel state

    The router will be set up to take a url path such as::

        http://localhost:8001/state/bt4/device

    and translate this into a request for the current state on the
    device subscription for the bt4 instrument.
    """
    def get(self, instrument, channel):
        channel_class = CHANNELS[channel]
        state = channel_class.get_restful_state(self.request, "/".join(("",instrument,channel)))
        self.write(state)

class ControlChannel(sio.SocketConnection):
    """
    Forward control messages to listening NICE server.

    *session* identifies the client and *endpoint* identifies the
    desired control channel.  These are provided by Tornadio when the
    channel is opened.

    This is mostly a blind pass through, with the exception of the
    listen event which registers the client socket as a receiver of
    all the messages from the other clients.  If there are no listeners
    the control message is silently dropped. [TODO: consider adding
    an additional event to ask whether there is a controller listening.]

    Under the current implementation any client can send the "listen"
    event and receive the control messages from all other clients.  For
    most applications this won't matter, but this would be inappropriate
    if the control messages needed to remain private.  In that case,
    the controller socket should be provided on init.
    """
    _all_listeners = {}
    def __init__(self, session, endpoint=None):
        super(ControlChannel,self).__init__(session, endpoint=endpoint)
        self.channel = endpoint
        self._all_listeners.setdefault(endpoint,None)

    @property
    def listener(self):
        """
        Return the channel specific listener.
        """
        return self._all_listeners[self.channel]

    @listener.setter
    def listener(self, value):
        """
        Set the channel specific listener.
        """
        self._all_listeners[self.channel] = value

    def on_message(self, *args, **kw):
        """
        Received message from browser which needs to be forwarded to
        NICE web proxy client.
        """
        if self.listener:
            response = self.listener.send(*args, **kw)
            #store_event(self.channel, "message", args, kw)
            return response
            
    def on_event(self, name, *args, **kw):
        """
        Received event from browser which needs to be forwarded to
        NICE web proxy client.  If the event is "listen", then this
        is the NICE client, and it is registering itself to receive
        messages, otherwise it is a message sent from a browser to the
        NICE server.
        """
        # Note: tornadio has the weird notion that if a method is called
        # with a single dictionary as an argument, then it should be
        # treated as a set of keyword arguments.
        #print "event received: ", name, "args: ", args, "kw: ", kw, "listener: ", self.listener
        if (len(args) == 0) and 'args' in kw:
            args,kw = kw['args'],{}
        if name == "listen":
            # On connection to the internal server, the NICE web proxy will
            # register itself as a control listener which can receive
            # arbitrary events.
            # TODO: make sure there is only one listener
            self.listener = self
        elif name == "isactive":
            if self.listener:
                return "active"
            else: 
                return "inactive"
        elif self.listener:
            #print "control event",args,kw
            response = self.listener.emit(name, *args, **kw)
            #store_event(self.channel, name, args, kw)
            return response

class SubscriptionChannel(sio.SocketConnection):
    """
    Subscription channel that keeps track of the number of subscribers.

    Subscriber channels should subclass this class to add channel specific
    publisher event handlers.  The subscriber subclass must maintain
    the *state* attribute for the channel, which is the initial state that
    is provided to new subscribers.

    The *subscribe* event is emitted by a subscriber client when it connects
    to the channel.  It registers the client to receive all events emitted
    by the publisher event handlers, including those generated by the client
    itself if the client is acting as a publisher.  The current state is
    sent in response to the subscribe event, if the send_state flag is True.

    The *reset* event is emitted by the publisher to set the initial state
    of the channel.
    """
    # TODO: make sure there is only one publisher per channel; additional
    # publishers should be disconnected when their reset message is
    # received.

    # Channel-specific subscribers and channel specific state
    _all_feeds = {}
    _all_state = {}
    def __init__(self, session, endpoint=None):
        super(SubscriptionChannel,self).__init__(session, endpoint=endpoint)
        #print "endpoint",endpoint
        #print "session",session
        #self.session = session
        self.channel = endpoint
        self._all_feeds.setdefault(endpoint, set())
        self._all_state.setdefault(endpoint, None)

    @classmethod
    def get_restful_state(cls, request, channel):
        #print "channels",cls._all_state.keys()
        #print "channel",channel
        return cls.restful_state(request, cls._all_state[channel])
    
    @property
    def state(self):
        return self._all_state[self.channel]
    
    @state.setter
    def state(self, value):
        self._all_state[self.channel] = value

    @property
    def feeds(self):
        return self._all_feeds[self.channel]

    def on_close(self):
        self.feeds.discard(self)

    @sio.event
    def subscribe(self, send_state=True):
        #print "subscribing to",self.channel,self.session
        #print "channels",self._all_state.keys()
        self.feeds.add(self)
        if send_state == True:
            return self.initial_state(self.state)

    @sio.event
    @capture
    def reset(self, *args, **kw):
        # Note: tornadio has the weird notion that if a method is called
        # with a single dictionary as an argument, then it should be
        # treated as a set of keyword arguments.  Since the publisher state
        # will often use a dict to represent state, we need to hack around this
        # problem by intercepting the **kw arguments if args is not present.
        self.reset_state(args[0] if args else kw)
        #print "sending reset to",self.channel
        self.emit('reset', self.initial_state(self.state))

    def reset_state(self, state):
        """
        Initial state sent by the publisher.  Subclasses may override if
        they are preprocessing the state before feeding it to the
        subscriber channels.
        """
        self.state = state

    @classmethod
    def restful_state(cls, request, state):
        """
        RESTful state defaults to initial state.
        """
        return cls.initial_state(state)

    @classmethod
    def initial_state(cls, state):
        """
        Default the initial state returned on subscribe to the entire
        state of the channel.  Specific channel handlers can override
        and return a part of the state as the initial state, if for
        example they only want to send information to the browser one
        page at a time.
        """
        return state

    def emit(self, event, *args, **kw):
        """
        Send an event to all connected clients.
        """
        for f in self.feeds:
            #print "sending",event,"to",f.channel,f.session
            sio.SocketConnection.emit(f, event, *args, **kw)

    def send(self, message, callback=None):
        """
        Send a message to all connected clients.
        """
        for f in self.feeds:
            sio.SocketConnection.send(f, message, callback=callback)

class EventChannel(SubscriptionChannel):
    """
    NICE logger interface.
    """
    @sio.event
    @capture
    def created(self, **event):
        # Ick! tornadio2 treats single dict arg as keywords!
        self.state.append(event)
        #print "event channel is", self.channel
        self.emit('created', event)

    @sio.event
    @capture
    def acknowledged(self, event_id):
        pass

    @sio.event
    @capture
    def resolved(self, event_id, resolution):
        pass

class ConsoleChannel(SubscriptionChannel):
    @sio.event
    @capture
    def report(self, **event):
        self.state.append(event)
        self.emit('report', event)

class DataChannel(SubscriptionChannel):
    @sio.event
    @capture
    def data(self, **record):
        # Note: may want instrument specific handling of the data so that we only send
        # a summary of the detector image to the server, not the whole detector.  We
        # will still want to store the individual detector frames so that we can
        # return them to the client on request..
        #print "data command",record['command']
        if record['command'] == "Configure":
            self.state = []
        # Ignore intermediate counts; client can pull them off the device stream
        if record['command'] == "Counts" and record['status'] not in ('complete','abort'):
            return
        self.state.append(record)
        #print "emitting data",record['command']
        self.emit('record', record)
    @classmethod
    def initial_state(cls, state):
        #print "current state:"; type(self.state)
        #print "sub",type(self.state[0]),type(self.state[1])
        #print "initial state",(len(self.state) if self.state else 'no state')
        return {'records':state} if state is not None else {'records':[]}
         

class DeviceChannel(SubscriptionChannel):
    """
    NICE device model.
    """

    def reset_state(self, state):
        devices, nodes, structure = state
        _fixup_devices(devices,nodes)
        self.state = devices, structure

    @classmethod
    def initial_state(cls, state):
        #print "current state:", state
        #print "sub",type(self.state[0]),type(self.state[1])
        return state if state is not None else (None,{})

    @classmethod
    def restful_state(cls, request, state):
        #print state
        return {'devices':state[0], 'view':state[1]}
    
    @sio.event
    def device_hierarchy(self):
        return self.state[1] # take the "structure" part
        
    @sio.event
    def filled_device_hierarchy(self):
        from copy import deepcopy
        devices = self.state[0]
        filled_structure = deepcopy(self.state[1])
        #structure = self.state[1]
        def get_value(dottedname):
            keys = dottedname.split('.')
        
        def fill_children(item):
            if len(item['children']) == 0:
                names = item['nodeID'].split('.')
                device = devices[names[0]]
                if len(names) == 2: # node is specified
                    value = device['nodes'][names[1]]['currentValue']['val']
                    new_id = device['nodes'][names[1]]['id']
                else: 
                    primaryNode = device['nodes'][device['primaryNodeID']]
                    value = primaryNode['currentValue']['val']
                    new_id = primaryNode['id']
                item['value'] = value
                item['id'] = new_id
            else:
                for i in item['children']:
                    fill_children(i)
        fill_children(filled_structure)
        return filled_structure

    # TODO: browser clients should not be able to update state; we could either
    # sign the message using HMAC or somehow make some events require an
    # authenticated connection.
    @sio.event
    @capture
    def added(self, devices, nodes):
        """
        Nodes added to the instrument.  Forward their details to the
        clients.
        """
        _fixup_devices(devices, nodes)
        self.state[0].update(devices)
        self.emit('added', devices)

    @sio.event
    @capture
    def removed(self, devices, nodes):
        """
        Nodes removed from the instrument.  Forward their names to the clients.
        """
        deviceIDs = devices.keys()
        for device in deviceIDs:
            del self.state[0][device]
        self.emit('removed', deviceIDs)

    @sio.event
    @capture
    def changed(self, nodes):
        """
        Node value or properties changed.  Forward the details to the clients.
        """
        if self.state is None: self.state = {}
        for node in nodes:
            #print node
            self.state[0][node['deviceID']]['nodes'][node['nodeID']] = node
        # May want to do bandwidth limiting, an only send updates to big nodes
        # such as 2-D detector and ROI mask every minute rather than every
        # time they are updated.
        self.emit('changed', nodes)

def _fixup_devices(devices, nodes):
    for v in devices.values():
        v['nodes'] = {}
        #print v['primaryNodeID'],v['stateNodeID'],v['visibleNodeIDs']
        v['primaryNodeID'] = v['primaryNodeID'].split('.')[1] if v['primaryNodeID'] else ''
        v['stateNodeID'] = v['stateNodeID'].split('.')[1] if v['stateNodeID'] else ''
        v['visibleNodeIDs'] = [id.split('.')[1] for id in v['visibleNodeIDs']]
    for v in nodes.values():
        devices[v['deviceID']]['nodes'][v['nodeID']] = v


class QueueChannel(SubscriptionChannel):
    """
    NICE queue model.

    Publisher follows NICE queue API, but with linked list of children
    replaced by a normal list, and with parentID/prevID removed from the
    node details for ease in maintaining a consistent queue state on the
    client.

    Subscribers emit 'subscribe' when first connected, which returns the
    complete queue.  A queue node looks like::

        node = {
            "status": {
                "commandStr": string,
                "errors": [string, ...],
                "isBreakPoint": boolean,
                "metaState": string,
                "state": "QUEUED|RUNNING|CHILDREN|FINISHED|SKIPPED",
                }
            "id": int,
            "child": [node, ...],
            }

    Subscribers should expect the following events::

       queue.on('added', function (nodes, parentID, siblingID) {})
           add the nodes and all its children as a child of the parent node
           after the sibling node, or at the beginning if sibling is 0.
       queue.on('removed', function (nodeID) {})
           remove the node
       queue.on('removed children', function (nodeID) {})
           remove all children of the node
       queue.on('moved', function (nodeID, parentID, siblingID) {})
           remove the node and add it to parent after sibling
       queue.on('changed', function (nodeID, status) {})
           update the status of the node
       queue.on('reset', function (node) {})
           replace the queue with the given queue

    Rather than maintaining the state on the client, subscribers can
    simply resubmit the subscribe message to get an up-to-date version
    of the queue.
    """
    # TODO: browser clients should not be able to update state; we could either
    # sign the message using HMAC or somehow make some events require an
    # authenticated connection.
    @sio.event
    @capture
    def added(self, nodes, parentID, prevID):
        """
        Node added to the queue.  Forward the details to the
        clients.
        """
        queue_add(self.state, nodes, parentID, prevID)
        #print "queue add",[n['id'] for n in nodes]
        self.emit('added', nodes, parentID, prevID)

    @sio.event
    @capture
    def removed(self, nodeIDs, parentID, index):
        """
        Nodes removed from the queue.  Forward them to the clients.
        """
        if len(nodeIDs) == 1:
            #print "queue remove",nodeIDs[0]
            queue_remove(self.state, nodeIDs[0])
            self.emit('removed', nodeIDs[0])
        else:
            parent, index = queue_find(self.state, nodeIDs[0])
            parent['child'] = []
            #print "queue remove children",parent['id']
            self.emit('removed_children', parent['id'])

    @sio.event
    @capture
    def moved(self, nodeID, parentID, prevID):
        """
        Nodes moved from the instrument.  Forward their names to the clients.
        """
        #print "queue move",nodeID,parentID,prevID
        queue_move(nodeID, parentID, prevID)
        self.emit('moved', nodeID, parentID, prevID)

    @sio.event
    @capture
    def changed(self, nodeID, status):
        """
        Node value or properties changed.  Forward the details to the clients.
        """
        queue_update_status(self.state, nodeID, status)
        #print "queue change",nodeID
        self.emit('changed', nodeID, status)

def queue_update_status(queue, nodeID, status):
    """
    Update the status on a node.
    """
    try:
        parent, index = queue_find(queue, nodeID)
        existing_node = parent['child'][index]
        existing_node['status'] = status
    except KeyError:
        import pprint; pprint.pprint(queue)
        print "could not find",nodeID
        raise

def queue_move(queue, nodeID, parentID, prevID):
    """
    Move a node to a new position within the queue.
    """
    parent, index = queue_find(queue, nodeID)
    node = parent['child'][index]
    del parent['child'][index]
    queue_add(queue, [node], parentID, prevID)

def queue_remove(queue, nodeID):
    """
    Remove a set of nodes from the queue.
    """
    parent, index = queue_find(queue, nodeID)
    del parent['child'][index]

def queue_add(queue, nodes, parentID, prevID):
    """
    Add a node to the queue given its parent and elder sibling.
    """
    if parentID == 0:
        parent = queue
    else:
        grand_parent, parent_index = queue_find(queue, parentID)
        parent = grand_parent['child'][parent_index]
    sibling_index = queue_find_elder_sibling(parent, prevID)
    for i,node in enumerate(nodes):
        parent['child'].insert(sibling_index+1+i, node)

def queue_find(queue, nodeID):
    """
    Find nodeID within the queue.

    Uses a reverse depth first search since most changes happen at the
    near the end of the queue.

    Returns the parent node and the index within the children.

    Raise KeyError if the node is not found, or if node is the root node.
    """
    for index,node in reversed(list(enumerate(queue['child']))):
        if node['id'] == nodeID:
            return queue, index
        try:
            return queue_find(node, nodeID)
        except KeyError:
            pass
    raise KeyError("Node %s is not found"%nodeID)

def queue_find_elder_sibling(parent, siblingID):
    """
    Locate the index of the elder sibling within the children of the
    parent node.

    Return -1 if there is no elder sibling (i.e., if siblingID is 0).

    Raise KeyError if the elder sibling is not in the list of children.
    """
    if siblingID == 0:
        return -1
    for index,node in enumerate(parent['child']):
        if siblingID == node['id']:
            return index
    raise KeyError("Sibling node %s not found"%siblingID)

# Socket.io handler class for the given channel
CHANNELS = {
        'control': ControlChannel,
        'events': EventChannel,
        'console': ConsoleChannel,
        'data': DataChannel,
        'device': DeviceChannel,
        'queue': QueueChannel,
    }
    
from tornadio2.router import HandshakeHandler, TornadioRouter, version_info, ioloop, DEFAULT_SETTINGS, PROTOCOLS
from tornadio2 import persistent, polling, sessioncontainer, session, proto, preflight, stats

class BaseHandler(HandshakeHandler):
    def set_default_headers(self):
        #print "setting default headers"
        self.set_header("Access-Control-Allow-Origin", "drneutron.org")
        self.set_header("Access-Control-Allow-Credentials", "true")

class MyRouter(TornadioRouter):
    """TornadIO2 Router that allows specifying your own Handler"""

    def __init__(self,
                 connection,
                 user_settings=dict(),
                 namespace='socket.io',
                 io_loop=None,
                 handler=HandshakeHandler):
        """Constructor.

        `connection`
            SocketConnection class instance
        `user_settings`
            Settings
        `namespace`
            Router namespace, defaulted to 'socket.io'
        `io_loop`
            IOLoop instance, optional.
        """

        # TODO: Version check
        if version_info[0] < 2:
            raise Exception('TornadIO2 requires Tornado 2.0 or higher.')

        # Store connection class
        self._connection = connection

        # Initialize io_loop
        self.io_loop = io_loop or ioloop.IOLoop.instance()
        
        # set the handler
        self.handler = handler
        
        # Settings
        self.settings = DEFAULT_SETTINGS.copy()
        if user_settings:
            self.settings.update(user_settings)

        # Sessions
        self._sessions = sessioncontainer.SessionContainer()

        check_interval = self.settings['session_check_interval']
        self._sessions_cleanup = ioloop.PeriodicCallback(self._sessions.expire,
                                                         check_interval,
                                                         self.io_loop)
        self._sessions_cleanup.start()

        # Stats
        self.stats = stats.StatsCollector()
        self.stats.start(self.io_loop)

        # Initialize URLs
        self._transport_urls = [
            (r'/%s/(?P<version>\d+)/$' % namespace,
                self.handler,
                dict(server=self))
            ]

        for t in self.settings.get('enabled_protocols', dict()):
            proto = PROTOCOLS.get(t)

            if not proto:
                # TODO: Error logging
                continue

            # Only version 1 is supported
            self._transport_urls.append(
                (r'/%s/1/%s/(?P<session_id>[^/]+)/?' %
                    (namespace, t),
                    proto,
                    dict(server=self))
                )
        
class RouterConnection(sio.SocketConnection):
    """
    Manage the top level socket IO connection.
    """
    def on_open(self, request):
        pass
        #print "opened connection",request
    def on_close(self):
        pass
        #print "closed"
    def get_endpoint(self, endpoint):
        """
        Parse /insturment/channel into specific channel handlers.
        """
        try:
            _,instrument,channel = endpoint.split('/', 3)
            return CHANNELS[channel]
        except ValueError:
            pass # Not /instrument/channel
        except KeyError:
            pass # invalid channel name

    @sio.event
    def controller(self):
        return NICE_CONTROLLER_URL

def serve(debug=False, sio_port=8001):
    """
    Run the NICE repeater, forwarding subscription streams to the web.
    """
    # Create tornadio server
    Router = MyRouter(RouterConnection, handler=BaseHandler)
    ext_path='static/ext-all.js'
    routes = Router.apply_routes([
        (r"/", IndexHandler),
        (r"/state/(?P<instrument>[^/]*)/(?P<channel>[^/]*)",RestHandler),
    ])

    settings = dict(
        static_path = os.path.join(ROOT, "static"),
        #cookie_secret = cookie.get_cookie(),
        #xsrf_cookies = True,
        #login_url = "/login",
        gzip = True,
        flash_policy_port = 10843,
        flash_policy_file = os.path.join(ROOT, 'flashpolicy.xml'),
        socket_io_port = sio_port,
        debug = debug,
    )

    # Create socket application
    app = web.Application(routes, **settings)

    # Server application
    sio.SocketServer(app)

def usage():
    print """\
usage: server_daemon.py start|stop|restart [options]
  
  "stop" and "restart" do not require any options.

  --port=integer

       Port number for server connections.  Default is 8001

  --capture=filename

       Save the entire published data streams to a file so they can be replayed
       with test/playback.py

  --nice=URL

       URL for the NICE controller.  Defaults to the host that the server is running on.
    
  --debug

       Run the tornado server in debug mode, which provides error messages on the
       client and triggers restart when the server file changes.

"""

if __name__ == "__main__":
    import logging
    logging.getLogger().setLevel(logging.INFO)
    
    import sys
    import getopt
    from daemon import Daemon
    
    longopts = ["capture=","port=","controller=","debug"]
    try:
        opts, args = getopt.getopt(sys.argv[1:], "C:c:p:d", longopts)
        print opts, args
        if len(args) != 1:
            raise getopt.GetoptError("server_daemon.py requires one argument: start|stop|restart plus options")
    except getopt.GetoptError, exc:
        print str(exc)
        usage()
        sys.exit(1)
    

    debug=False
    NICE_CONTROLLER_URL = "http://%s:8001"%socket.gethostbyname(socket.gethostname())
    SIO_PORT=8001
    for name,value in opts:
        if name in ("-C", "--capture"):
            CAPTURE_FILE = open(value, 'w')
        elif name in ("-p", "--port"):  
            SIO_PORT = int(value)
        elif name in ("-d", "--debug"):
            debug = True
        elif name in ("-c", "--controller"):
            NICE_CONTROLLER_URL = value
        else:
            print "unknown option",name
    
    def run(self):
        serve(debug=debug, sio_port=SIO_PORT)

    Daemon.run = run
    daemon = Daemon('/tmp/niceweb_server_daemon.pid')

    if 'start' == args[0]:
        print "starting server: for PID, see /tmp/niceweb_server_daemon.pid"
        daemon.start()
    elif 'stop' == args[0]:
        print "stopping server"
        daemon.stop()
    elif 'restart' == args[0]:
        print "restarting server: for PID, see /tmp/niceweb_server_daemon.pid"
        daemon.restart()
    else:
        print "Unknown command"
        sys.exit(2)
	
    
    
    
    #debug = False if len(sys.argv)>1 and sys.argv[1]=='production' else True
    #if len(sys.argv) > 1 and sys.argv[1] == 'capture':
    #    CAPTURE_FILE = open(sys.argv[2], "w")
    #serve(debug=debug, sio_port=SIO_PORT)
    sys.exit(0)
