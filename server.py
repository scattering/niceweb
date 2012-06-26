#!/usr/bin/env python
"""
Tornado server providing a socket.io repeater for NICE publish-subscribe
streams.
"""

import os
import re

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

class ControlChannel(sio.SocketConnection):
    """
    Forward control messages to listening instrument.
    """
    _all_listeners = {}
    def __init__(self, session, endpoint=None):
        super(ControlChannel,self).__init__(session, endpoint=endpoint)
        self.channel = endpoint
        self._all_listeners.setdefault(endpoint,None)

    @property
    def listener(self):
        return self._all_listeners[self.channel]
    
    @listener.setter
    def listener(self, value):
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
    """
    # Channel-specific subscribers and channel specific state
    _all_feeds = {}
    _all_state = {}
    def __init__(self, session, endpoint=None):
        super(SubscriptionChannel,self).__init__(session, endpoint=endpoint)
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
        self.feeds.add(self)
        return self.state
    
    @sio.event
    def publish(self, *args, **kw):
        # Note: tornadio has the weird notion that if a method is called
        # with a single dictionary as an argument, then it should be
        # treated as a set of keyword arguments.  Since publish state
        # will often use kw to represent state, we can hack around this
        # problem by intercepting the **kw argument if args is not present.
        if args:
            self.state = args[0]
        else:
            self.state = kw

    def emit(self, event, *args, **kw):
        """
        Send an event to all connected clients.
        """
        #print "_broadcast device",event
        for f in self.feeds:
            sio.SocketConnection.emit(f, event, *args, **kw)

    def send(self, message, callback=None):
        """
        Send a message to all connected clients.
        """
        #print "_broadcast device",event
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
        print "event channel is", self.channel
        self.emit('created', event)
    
class DeviceChannel(SubscriptionChannel):
    """
    NICE device model.
    """
    # TODO: browser clients should not be able to update state; we could either
    # sign the message using HMAC or somehow make some events require an
    # authenticated connection.
    @sio.event
    def added(self, nodes):
        """
        Nodes added to the instrument.  Forward their details to the
        clients.
        """
        self.state.update((n['id'],n) for n  in nodes)
        self.emit('added', nodes)
        
    @sio.event
    def removed(self, nodeIDs):
        """
        Nodes removed from the instrument.  Forward their names to the clients.
        """
        for id in nodeIDS:
            del self.state[id]
        self.emit('removed', nodeIDS)
        
    @sio.event
    def changed(self, nodes):
        """
        Node value or properties changed.  Forward the details to the clients.
        """
        self.state.update((n['id'],n) for n in nodes)
        self.emit('changed', nodes)

class RouterConnection(sio.SocketConnection):
    """
    Register the socket.io channel endpoints.
    """
    _channels = {
        'device': DeviceChannel,
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

def serve():
    """
    Run the NICE repeater, forwarding subscription streams to the web.
    """
    # Create tornadio server
    Router = sio.TornadioRouter(RouterConnection)
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
        )
    
    # Create socket application
    app = web.Application(routes, **settings)

    # Server application
    sio.SocketServer(app)

if __name__ == "__main__":
    import logging
    logging.getLogger().setLevel(logging.DEBUG)
    serve()
