#!/usr/bin/env python
"""
Tornado server providing a socket.io repeater for NICE publish-subscribe
streams.
"""

import sys
import os
import re
import time
import functools
import json

SOCKETIO_CLIENT = 'static/socket.io-0.9.6/socket.io.min.js'
from tornado import web
import tornadio2 as sio

import cookie

ROOT = os.path.normpath(os.path.dirname(__file__))


class IndexHandler(web.RequestHandler):
    """Regular HTTP handler to serve the index.html page"""
    def get(self):
        self.render('index.html')
        
class SocketIOHandler(web.RequestHandler):
    """Regular HTTP handler to serve socket.io.js"""
    def get(self):
        self.render(SOCKETIO_CLIENT)

class CaptureMessages(object):
    """
    Decorator for capturing certain types of events to a file so that they
    can be later replayed.

    Note: this would be better handled by modifying SubscriptionChannel so
    that every method doesn't need the decorator, and it could instead be a
    constructor option.  Consider doing so if other event streams need to be
    captured.
    """
    def __init__(self, filename):
        self.file = open(filename, "w")
        self.T0 = time.time()
    def __call__(self, fn):
       @functools.wraps(fn)
       def wrapper(obj, *args, **kw):
           if kw: args = [kw]
           self.file.write("[%d,\"%s\",%s]\n"
                           % (time.time()-self.T0,fn.func_name, json.dumps(args)))
           self.file.flush()
           return fn(obj, *args, **kw)
       return wrapper

#capture_queue = CaptureMessages("queue.dat")
capture_queue = lambda fn: fn
capture_device = CaptureMessages("device.dat")
#capture_queue = lambda fn: fn

class ControlChannel(sio.SocketConnection):
    """
    Forward control messages to listening client socket.

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

    def on_message(self, line):
        """
        Received message from browser which needs to be forwarded to
        NICE web proxy client.
        """
        if self.listener:
            return self.listener.send(line)
    def on_event(self, name, *args, **kw):
        """
        Received event from browser which needs to be forwarded to
        NICE web proxy client.  If the event is "listen", then this
        is the web proxy client, and it is registering itself to receive
        messages.
        """
        if name == "listen":
            # On connection to the internal server, the NICE web proxy will
            # register itself as a control listener  which can receive arbitrary
            # arbitrary events.
            # TODO: This needs to support multiple instruments
            self.listener = self
        elif self.listener:
            return self.listener.emit(name, *args, **kw)

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
    sent in response to the subscribe event.

    The *reset* event is emitted by the publisher to set the initial state
    of the channel.
    """
    # Channel-specific subscribers and channel specific state
    _all_feeds = {}
    _all_state = {}
    def __init__(self, session, endpoint=None):
        super(SubscriptionChannel,self).__init__(session, endpoint=endpoint)
        #print "session",session
        #self.session = session
        self.channel = endpoint
        self._all_feeds.setdefault(endpoint, set())
        self._all_state.setdefault(endpoint, None)

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
    def subscribe(self):
        #print "subscribing to",self.channel,self.session
        #print "channels",self._all_state.keys()
        self.feeds.add(self)
        return self.initial_state()

    @sio.event
    def reset(self, *args, **kw):
        # Note: tornadio has the weird notion that if a method is called
        # with a single dictionary as an argument, then it should be
        # treated as a set of keyword arguments.  Since the publisher state
        # will often use a dict to represent state, we need to hack around this
        # problem by intercepting the **kw arguments if args is not present.
        self.reset_state(args[0] if args else kw)
        self.emit('reset', self.state)

    def reset_state(self, state):
        """
        Initial state sent by the publisher.  Subclasses may override if
        they are preprocessing the state before feeding it to the
        subscriber channels.
        """
        self.state = state
        
    def initial_state(self):
        """
        Default the initial state returned on subscribe to the entire
        state of the channel.  Specific channel handlers can override
        and return a part of the state as the initial state, if for
        example they only want to send information to the browser one
        page at a time.
        """
        return self.state

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
    def created(self, **event):
        # Ick! tornadio2 treats single dict arg as keywords!
        self.state.append(event)
        #print "event channel is", self.channel
        self.emit('created', event)
EventChannel._events.update(SubscriptionChannel._events)

class Device(object):
    
    def __init__(self):
        self.nodes = {}
        self.primary = ''
        
    def addnode(self, name, node):
        self.nodes[name] = node
    
    def setprimary(self):
        if 'softPosition' in self.nodes.keys():
            self.primary = 'softPosition'
        else:
            self.primary = self.nodes.keys()[0]

class DeviceChannel(SubscriptionChannel):
    """
    NICE device model.
    """
    
    def reset_state(self, state):
        # Convert node list into device list where each device has a
        # set of nodes.
        
        # for each node:
        #   split node into device_name . node_name
        #   if device_name not in set of defined devices
        #     create new device
        #   add node to device
        #
        # for each device
        #    guess primary node
        devices = {}
        for name in state.keys():
            device_name = name.split('.')[0]
            node_name = name.split('.')[1]
            if device_name not in devices.keys():
                devices[device_name] = Device()
            node = state[name]
            devices[device_name].addnode(name, node)
        dev_dict={}
        for key, value in devices.items():
            devices[key].setprimary()
            dev_dict[key] = value.__dict__
            #devices[key] = value.nodes
        self.state = dev_dict
        #self.state = state
    
    def initial_state(self):
        #state = self.state
        #devices = {}
        #for name in state.keys():
            #device_name = name.split('.')[0]
            #node_name = name.split('.')[1]
            #if device_name not in devices.keys():
                #devices[device_name] = {}
            #devices[device_name][node_name] = state[name]     
        #self.state = devices
        return self.state
        # create initial state as [(device,primary node value)]
        #return [(name,device.primary) for name,device in self.state.items()]
        

    @sio.event
    def panel(self, device_name):
        return self.state[device_name]
        
        
    # TODO: browser clients should not be able to update state; we could either
    # sign the message using HMAC or somehow make some events require an
    # authenticated connection.
    @sio.event
    @capture_device
    def reset(self, *args, **kw):
        SubscriptionChannel.reset(self, *args, **kw)
        #print "queue subscribe",self.state

    @sio.event
    @capture_device
    def added(self, nodes):
        """
        Nodes added to the instrument.  Forward their details to the
        clients.
        """
        self.state.update((n['id'],n) for n  in nodes)
        self.emit('added', nodes)

    @sio.event
    @capture_device
    def removed(self, nodeIDs):
        """
        Nodes removed from the instrument.  Forward their names to the clients.
        """
        for id in nodeIDS:
            del self.state[id]
        self.emit('removed', nodeIDS)

    @sio.event
    @capture_device
    def changed(self, nodes):
        """
        Node value or properties changed.  Forward the details to the clients.
        """
        self.state.update((n['id'],n) for n in nodes)
        self.emit('changed', nodes)

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
    @sio.event
    @capture_queue
    def reset(self, *args, **kw):
        SubscriptionChannel.reset(self, *args, **kw)
        #print "queue subscribe",self.state

    # TODO: browser clients should not be able to update state; we could either
    # sign the message using HMAC or somehow make some events require an
    # authenticated connection.
    @sio.event
    @capture_queue
    def added(self, nodes, parentID, prevID):
        """
        Node added to the queue.  Forward the details to the
        clients.
        """
        queue_add(self.state, nodes, parentID, prevID)
        #print "queue add",[n['id'] for n in nodes]
        self.emit('added', nodes, parentID, prevID)

    @sio.event
    @capture_queue
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
    @capture_queue
    def moved(self, nodeID, parentID, prevID):
        """
        Nodes moved from the instrument.  Forward their names to the clients.
        """
        #print "queue move",nodeID,parentID,prevID
        queue_move(nodeID, parentID, prevID)
        self.emit('moved', nodeID, parentID, prevID)

    @sio.event
    @capture_queue
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

class RouterConnection(sio.SocketConnection):
    """
    Register the socket.io channel endpoints.
    """
    _channels = {
        'device': DeviceChannel,
        'queue': QueueChannel,
        'control': ControlChannel,
        'events': EventChannel,
         }
    def get_endpoint(self, endpoint):
        """
        Parse /insturment/channel into specific channel handlers.
        """
        try:
            _,instrument,channel = endpoint.split('/', 3)
            return self._channels[channel]
        except ValueError:
            pass # Not /instrument/channel
        except KeyError:
            pass # invalid channel name

def serve(debug=False):
    """
    Run the NICE repeater, forwarding subscription streams to the web.
    """
    # Create tornadio server
    Router = sio.TornadioRouter(RouterConnection)
    ext_path='static/ext-all.js'
    routes = Router.apply_routes([
            (r"/", IndexHandler),
            (r"/socket.io.js", SocketIOHandler),
            ])

    settings = dict(
        static_path = os.path.join(ROOT, "static"),
        #cookie_secret = cookie.get_cookie(),
        #xsrf_cookies = True,
        #login_url = "/login",
        flash_policy_port = 843,
        flash_policy_file = os.path.join(ROOT, 'flashpolicy.xml'),
        socket_io_port = 8001,
        debug = debug,
        )

    # Create socket application
    app = web.Application(routes, **settings)

    # Server application
    sio.SocketServer(app)

if __name__ == "__main__":
    import logging
    logging.getLogger().setLevel(logging.INFO)
    debug = False if len(sys.argv)>1 and sys.argv[1]=='production' else True
    serve(debug=debug)
