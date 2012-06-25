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
    def get(self):
        self.render(SOCKETIO_CLIENT)

class ControlConnection(sio.SocketConnection):
    listener = None
    def __init__(self, *args, **kw):
        super(ControlConnection,self).__init__(*args, **kw)
    def on_message(self, line):
        print "recv'd control",line
        if self.listener:
            print "forwarding to", self.listener
            self.listener.send(line)
            
    @sio.event
    def listen(self):
        print "received listen"
        ControlConnection.listener = self
        
        
    
class DeviceConnection(sio.SocketConnection):
    # State shared across all connections
    # TODO: this won't work; need one set of feeds per instrument
    feeds = set()
    nodes = {}
    def __init__(self, *args, **kw):
        super(DeviceConnection,self).__init__(*args, **kw)

    def on_open(self, info):
        print "open"
        pass  # Don't want to echo back to publishers, so delay until subscribe

    def on_close(self):
        print "close"
        self.feeds.discard(self)

    @sio.event
    def subscribe(self):
        print "subscribe"
        self.feeds.add(self)
        return self.nodes

    # These are server events that need to be restricted; we could either
    # sign the message using HMAC or somehow make some events require an
    # authenticated connection.
    @sio.event
    def started(self, nodes):
        self.nodes.clear()
        self.nodes.update((n['id'],n) for n in nodes)
        self.broadcast('started', nodes)
    @sio.event
    def added(self, nodes):
        self.nodes.update((n['id'],n) for n  in nodes)
        self.broadcast('added', nodes)
    @sio.event
    def removed(self, nodeIDs):
        for nid in nodeIDS:
            del self.nodes[nid]
        self.broadcast('removed', nodeIDS)
    @sio.event
    def changed(self, nodes):
        self.nodes.update((n['id'],n) for n  in nodes)
        self.broadcast('changed', nodes)

    def broadcast(self, event, *args):
        #print "broadcast device",event
        for f in self.feeds:
            if f is not self:
                f.emit(event, *args)

class RouterConnection(sio.SocketConnection):
    # FIXME: server should allow arbitrary instruments
    __endpoints__ = {
        '/sans10m/device': DeviceConnection,
        '/sans10m/control': ControlConnection,
        }

def serve():
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
