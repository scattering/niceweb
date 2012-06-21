from os import path as op

SOCKETIO_CLIENT = 'static/socket.io-0.9.6/socket.io.min.js'
from tornado import web
import tornadio2 as sio

ROOT = op.normpath(op.dirname(__file__))


class IndexHandler(web.RequestHandler):
    """Regular HTTP handler to serve the chatroom page"""
    def get(self):
        self.render('index.html')


class SocketIOHandler(web.RequestHandler):
    def get(self):
        self.render(SOCKETIO_CLIENT)


class DeviceConnection(sio.SocketConnection):
    def __init__(self, *args, **kw):
        super(DeviceConnection,self).__init__(*args, **kw)
        self.feeds = set()
        self.device_model = {}
        self.nodes = {}

    def on_open(self, info):
        print "open"
        pass  # Don't want to echo back to publishers, so delay until subscribe

    def on_close(self):
        print "close"
        #self.feeds.remove(self)

    @sio.event
    def subscribe(self):
        print "subscribe"
        #self.feeds.add(self)
        return self.nodes

    # These are server events that need to be restricted; we could either
    # sign the message using HMAC or somehow make some events require an
    # authenticated connection.
    @sio.event
    def started(self, nodes):
        self.broadcast('started', nodes)
    @sio.event
    def added(self, nodes):
        self.broadcast('added', nodes)
    @sio.event
    def removed(self, nodeIDs):
        self.broadcast('removed', nodeIDS)
    @sio.event
    def changed(self, nodes):
        self.broadcast('changed', nodes)

    def broadcast(event, *args):
        print "broadcast device",event
        for f in self.feeds:
            f['device'].emit(event, *args)

class RouterConnection(sio.SocketConnection):
    __endpoints__ = {
        '/device': DeviceConnection,
        }

def serve():
    # Create tornadio server
    Router = sio.TornadioRouter(RouterConnection)

    # Create socket application
    app = web.Application(
        Router.apply_routes([
            (r"/", IndexHandler),
            (r"/socket.io.js", SocketIOHandler),
            ]),
        flash_policy_port = 843,
        flash_policy_file = op.join(ROOT, 'flashpolicy.xml'),
        socket_io_port = 8001,
        )

    # Server application
    sio.SocketServer(app)

if __name__ == "__main__":
    import logging
    logging.getLogger().setLevel(logging.DEBUG)
    serve()

def _skip():
    # Create http server on port 8001
    http_server = tornado.httpserver.HTTPServer(http_app)
    http_server.listen(8001)

    # Create tornadio server on port 8002, but don't start it yet
    tornadio2.server.SocketServer(sock_app, auto_start=False)

    # Start both servers
    tornado.ioloop.IOLoop.instance().start()
