#!/usr/bin/env python
"""
Tornado server providing a socket.io repeater for NICE publish-subscribe
streams.
"""

import os

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

class ControlConnection(sio.SocketConnection):
    """
    Forward control messages to listening instrument.
    """
    listener = None
    def __init__(self, *args, **kw):
        super(ControlConnection,self).__init__(*args, **kw)
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
            ControlConnection.listener = self
        elif self.listener:
            return self.listener.emit(name, *args, **kw)
        
    
class DeviceConnection(sio.SocketConnection):
    """
    Maintain a copy of the device model and a list of client subscriptions.
    
    Broadcast state changes to all clients.
    """
    # TODO: state shared across all connections, but need per instrument state
    feeds = set()
    nodes = {}
    def __init__(self, *args, **kw):
        super(DeviceConnection,self).__init__(*args, **kw)
        print "starting device with", args, kw

    def on_open(self, info):
        """
        Respond to channel open event.
        
        Don't want to echo back to publishers, so don't do anything until
        the client subscribes.
        """
        print "open"

    def on_close(self):
        """
        Respond to channel close event.
        
        Release the subscriber from the list of clients.
        """
        print "close"
        self.feeds.discard(self)

    @sio.event
    def subscribe(self):
        """
        Respond to the subscribe event.
        
        Add the connection to the list of subscribers, and send the initial
        subscription state.
        """
        # TODO: make sure we don't have threading problems, where change
        # notification sent by NICE happens while a new client is subscribing.
        print "subscribe"
        self.feeds.add(self)
        return self.nodes

    # TODO: browser clients should not be able to update state; we could either
    # sign the message using HMAC or somehow make some events require an
    # authenticated connection.
    @sio.event
    def reset(self, nodes):
        """
        Reset the entire device model to the set of nodes provided.
        """
        self.nodes.clear()
        self.nodes.update((n['id'],n) for n in nodes)
        self._broadcast('started', nodes)
        
    @sio.event
    def added(self, nodes):
        """
        Nodes added to the instrument.  Forward their details to the
        clients.
        """
        self.nodes.update((n['id'],n) for n  in nodes)
        self._broadcast('added', nodes)
        
    @sio.event
    def removed(self, nodeIDs):
        """
        Nodes removed from the instrument.  Forward their names to the clients.
        """
        for nid in nodeIDS:
            del self.nodes[nid]
        self._broadcast('removed', nodeIDS)
        
    @sio.event
    def changed(self, nodes):
        """
        Node value or properties changed.  Forward the details to the clients.
        """
        self.nodes.update((n['id'],n) for n in nodes)
        self._broadcast('changed', nodes)

    def _broadcast(self, event, *args):
        """
        Send an event to all connected clients.
        """
        #print "_broadcast device",event
        for f in self.feeds:
            if f is not self:
                f.emit(event, *args)

class RouterConnection(sio.SocketConnection):
    """
    Register the socket.io channel endpoints.
    """
    # FIXME: server should allow arbitrary instruments
    # TODO: don't know how this differs from "Router.apply_routes" below.
    __endpoints__ = {
        '/sans10m/device': DeviceConnection,
        '/sans10m/control': ControlConnection,
        }

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
