#!/usr/bin/env python
"""
Tornado server providing a socket.io repeater for NICE publish-subscribe
streams.
"""

import os
#import re

import channels
#from channels import ControlChannel, EventChannel, ConsoleChannel, DataChannel, DeviceChannel, QueueChannel
from channels import CHANNELS

from tornado import web, ioloop
import tornadio2 as sio
from tornadio2.router import HandshakeHandler, TornadioRouter, version_info, ioloop, DEFAULT_SETTINGS, PROTOCOLS
from tornadio2 import persistent, polling, sessioncontainer, session, proto, preflight, stats

ROOT = os.path.normpath(os.path.dirname(__file__))
SIO_PORT = 8001
DEBUG = False
WEB_SETTINGS = dict(
    static_path = os.path.join(ROOT, "static"),
    #cookie_secret = cookie.get_cookie(),
    #xsrf_cookies = True,
    #login_url = "/login",
    gzip = True,
    flash_policy_port = 10843,
    flash_policy_file = os.path.join(ROOT, 'flashpolicy.xml'),
    socket_io_port = SIO_PORT,
    debug = DEBUG,
)

DEFAULT_ROUTER = None

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
    CHANNELS = CHANNELS
    def get(self, instrument, channel):
        channel_class = self.CHANNELS[channel]
        state = channel_class.get_restful_state(self.request, "/".join(("",instrument,channel)))
        self.write(state)


class BaseHandler(HandshakeHandler):
    def set_default_headers(self):
        print "setting default headers"
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
    CHANNELS = CHANNELS
    def on_open(self, request):
        pass
        #print "opened connection",request
    def on_close(self):
        pass
        #print "closed"
    def get_endpoint(self, endpoint):
        """
        Parse /instrument/channel into specific channel handlers.
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

DEFAULT_ROUTER = MyRouter(RouterConnection, handler=BaseHandler)

class NICERepeater(object):
    """ system for serving a repeater for NICE data """
    def __init__(self,
                router=DEFAULT_ROUTER,
                web_settings=WEB_SETTINGS,
                index_handler=IndexHandler,
                rest_handler=RestHandler):               
               
        self.router = router
        self.web_settings = web_settings
        self.index_handler = index_handler
        self.rest_handler = rest_handler

    
    def serve(self):
        """
        Run the NICE repeater, forwarding subscription streams to the web.
        """
        # Create tornadio server
        #Router = MyRouter(RouterConnection, handler=BaseHandler)
        ext_path='static/ext-all.js'
        routes = self.router.apply_routes([
            (r"/", self.index_handler),
            (r"/state/(?P<instrument>[^/]*)/(?P<channel>[^/]*)",self.rest_handler),
        ])

        # Create socket application
        self.app = web.Application(routes, **self.web_settings)
        print self.web_settings
        # Server application
        #sio.SocketServer(self.app, auto_start=False)
        sio.SocketServer(self.app)


def usage():
    print """\
usage: server.py [options]

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
    import socket
    
    longopts = ["capture=","port=","controller=","debug"]
    try:
        opts, args = getopt.getopt(sys.argv[1:], "C:c:p:d", longopts)
        if args:
            raise getopt.GetoptError("server.py only accepts options")
    except getopt.GetoptError, exc:
        print str(exc)
        usage()
        sys.exit(1)
    
    debug=False
    channels.NICE_CONTROLLER_URL = "http://%s:8001"%socket.gethostbyname(socket.gethostname())
    SIO_PORT=8001
    for name,value in opts:
        if name in ("-C", "--capture"):
            channels.CAPTURE_FILE = open(value, 'w')
        elif name in ("-p", "--port"):  
            WEB_SETTINGS['socket_io_port'] = int(value)
        elif name in ("-d", "--debug"):
            WEB_SETTINGS['debug'] = True
        elif name in ("-c", "--controller"):
            channels.NICE_CONTROLLER_URL = value
        else:
            print "unknown option",name
    
    #debug = False if len(sys.argv)>1 and sys.argv[1]=='production' else True
    #if len(sys.argv) > 1 and sys.argv[1] == 'capture':
    #    CAPTURE_FILE = open(sys.argv[2], "w")
    
    repeater = NICERepeater()
    repeater.serve()
    ioloop.IOLoop.instance().start()
