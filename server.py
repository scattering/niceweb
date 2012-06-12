from os import path as op

import tornado
import tornado.web
import tornado.httpserver
import tornadio2
import tornadio2.router
import tornadio2.server
import tornadio2.conn

ROOT = op.normpath(op.dirname(__file__))


class IndexHandler(tornado.web.RequestHandler):
    """Regular HTTP handler to serve the chatroom page"""
    def get(self):
        self.render('index.html')


class SocketIOHandler(tornado.web.RequestHandler):
    def get(self):
        self.render('../socket.io.js')


class DeviceConnection(tornadio2.conn.SocketConnection):
    # info shared across all class instances
    feeds = set() # shared across all instances
    device_model = {}
    
    def on_open(self, info):
        pass  # Don't want to echo back to publishers, so delay until subscribe
        
    def on_close(self):
        self.feeds.remove(self)

    @event
    def subscribe(self, nodes, current=None):
        self.feeds.add(self)
        return 

    def on_added(self, nodes, current=None):
        for f in self.feeds:
            f['device'].emit('added', nodes)
    def on_removed(self, nodeIDs, current=None):
        for f in self.feeds:
            f['device'].emit('removed', nodeIDs)
    def on_changed(self, nodes, current=None):
        for f in self.feeds:
            f['device'].emit('changed', nodes)



# Create tornadio server
ChatRouter = tornadio2.router.TornadioRouter(ChatConnection)

# Create socket application
sock_app = tornado.web.Application(
    ChatRouter.urls,
    flash_policy_port = 843,
    flash_policy_file = op.join(ROOT, 'flashpolicy.xml'),
    socket_io_port = 8002
)

# Create HTTP application
http_app = tornado.web.Application(
    [(r"/", IndexHandler), (r"/socket.io.js", SocketIOHandler)]
)

if __name__ == "__main__":
    import logging
    logging.getLogger().setLevel(logging.DEBUG)

    # Create http server on port 8001
    http_server = tornado.httpserver.HTTPServer(http_app)
    http_server.listen(8001)

    # Create tornadio server on port 8002, but don't start it yet
    tornadio2.server.SocketServer(sock_app, auto_start=False)

    # Start both servers
    tornado.ioloop.IOLoop.instance().start()
