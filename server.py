#!/usr/bin/env python
"""
Tornado server providing a socket.io repeater for NICE publish-subscribe
streams.
"""

import os
import logging
import sys
import getopt
#import socket
    
#import re

from tornado import web
from tornado.escape import json_encode
from tornado.httpclient import HTTPError
import tornadio2 as sio
from tornadio2.router import HandshakeHandler, TornadioRouter, version_info, ioloop, DEFAULT_SETTINGS, PROTOCOLS
from tornadio2 import persistent, polling, sessioncontainer, session, proto, preflight, stats

import instrument
import pubsub

from pubsub import Publisher, Subscriber

AVAILABLE_INSTRUMENTS = set("ng1|ngb|ngd|cgd|bt1|bt4|magik".split('|'))
INSTRUMENTS = {}  # Start without any instruments
SERVER = "drneutron.org"
ROOT = os.path.normpath(os.path.dirname(__file__))
SUBSCRIBER_PORT = 8001
CONTROLLER_PORT = SUBSCRIBER_PORT+1
PUBLISHER_PORT = SUBSCRIBER_PORT+2
DEBUG = False
NICE_SETTINGS = dict(
    gzip = True,
)
WEB_SETTINGS = dict(
    static_path = os.path.join(ROOT, "static"),
    #cookie_secret = cookie.get_cookie(),
    #xsrf_cookies = True,
    #login_url = "/login",
    gzip = True,
    flash_policy_port = 10843,
    flash_policy_file = os.path.join(ROOT, 'flashpolicy.xml'),
)


class IndexHandler(web.RequestHandler):
    """Regular HTTP handler to serve the index.html page"""
    def get(self):
        self.render('index.html')

class RestHandler(web.RequestHandler):
    """
    RESTful interface to channel state

    The router will be set up to take a url path such as::

        http://localhost:8001/bt4/device/state

    and translate this into a request for the current state on the
    device subscription for the bt4 instrument.
    """
    def get(self, instrument, channel, rest):
        # Allow mash-ups
        self.set_header("Access-Control-Allow-Origin", SERVER)
        INSTRUMENTS[instrument].channel[channel].call(rest, self)

class BaseHandler(HandshakeHandler):
    def set_default_headers(self):
        #print "allow requests from other parts of this server"
        self.set_header("Access-Control-Allow-Origin", SERVER)
        print "allow cookies (why?)"
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
        
class WebConnection(sio.SocketConnection):
    """
    Manage the top level socket IO connection.
    """
    def get_endpoint(self, endpoint):
        """
        Parse /instrument/channel into specific channel handlers.
        """
        if not endpoint.startswith('/'): return
        try:
            _,name,channel = endpoint.split('/', 3)
        except ValueError:
            return
        # Clients should not be able to create arbitrary instruments
        if name not in INSTRUMENTS:
            raise HTTPError(404,"Instrument %s is not online"%name)
        #print "Web connection to",name,channel,INSTRUMENTS[name],INSTRUMENTS[name].channel[channel]
        #print INSTRUMENTS[name].channel[channel].channel_state()
        # Don't allow control from the general web connection
        if channel != 'control':
            return lambda *args, **kw: Subscriber(INSTRUMENTS[name].channel[channel], *args, **kw)

class NiceConnection(sio.SocketConnection):
    """
    Manage the top level socket IO connection.
    """
    def get_endpoint(self, endpoint):
        """
        Parse /instrument/channel into specific channel handlers.
        """
        if not endpoint.startswith('/'): return
        try:
            _,name,channel = endpoint.split('/', 3)
        except ValueError:
            return
        if name not in INSTRUMENTS:
            INSTRUMENTS[name] = instrument.Instrument(name=name)
        #print "NICE connection to",name,channel,INSTRUMENTS[name],INSTRUMENTS[name].channel[channel]
        #print INSTRUMENTS[name].channel[channel].channel_state()
     
        # There is role reversal with publisher and subscriber for the control
        # channel: the instrument is acting as a single subscriber for all
        # the web clients who are publishing commands to control it.
        if channel == 'control':
            return lambda *args, **kw: Subscriber(INSTRUMENTS[name].channel[channel], *args, **kw)
        elif channel in INSTRUMENTS[name].channel:
            return lambda *args, **kw: Publisher(INSTRUMENTS[name].channel[channel], *args, **kw)

class ControlConnection(sio.SocketConnection):
    """
    Put the instrument control web connection on its own port.
    """
    # TODO: may want per instrument restrictions on web access, perhaps through authentication
    def get_endpoint(self, endpoint):
        """
        Parse /instrument/channel into specific channel handlers.
        """
        if not endpoint.startswith('/'): return
        try:
            _,name,channel = endpoint.split('/', 3)
        except ValueError:
            return
        if name not in INSTRUMENTS:
            raise HTTPError(404,"Instrument %s is not online"%name)
     
        # There is role reversal with publisher and subscriber for the control
        # channel: here the instrument is acting as a single subscriber to
        # all of the web clients who are publishing commands to control it.
        if channel == 'control':
            return lambda *args, **kw: Publisher(INSTRUMENTS[name].channel[channel], *args, **kw)

def serve():
    """
    Run the NICE repeater, forwarding subscription streams to the web.
    """

    # Define the interface to the internal and external servers
    nice_router = MyRouter(NiceConnection, handler=BaseHandler)
    control_router = MyRouter(ControlConnection, handler=BaseHandler)
    web_router = MyRouter(WebConnection, handler=BaseHandler)
    web_routes = [
        (r"/", IndexHandler),
        # TODO: the following pattern is too generic it matches most /x/y/z
        # it only works because '.' is excluded from the matched patterns.
        (r"/(?P<instrument>[a-zA-Z0-9_]*)/(?P<channel>[a-z_]*)/(?P<rest>[a-z_]*)", RestHandler),
    ]

    # Point the servers to internal and external ports
    subscriber_app = web.Application(
            web_router.apply_routes(web_routes), 
            socket_io_port=SUBSCRIBER_PORT,
            debug=DEBUG,
            **WEB_SETTINGS)
    controller_app = web.Application(
            nice_router.apply_routes([]), 
            socket_io_port=CONTROLLER_PORT, 
            debug=DEBUG,
            **NICE_SETTINGS)
    publisher_app = web.Application(
            nice_router.apply_routes([]), 
            socket_io_port=PUBLISHER_PORT, 
            debug=DEBUG,
            **NICE_SETTINGS)

    # Server application
    loop = ioloop.IOLoop.instance()
    sio.SocketServer(subscriber_app, auto_start=False, io_loop=loop)
    sio.SocketServer(controller_app, auto_start=False, io_loop=loop)
    sio.SocketServer(publisher_app, auto_start=False, io_loop=loop)

    logging.info('Entering IOLoop...')
    loop.start()

def usage():
    print """\
usage: server.py [options]

  --port=integer

       Port number for web connections.  Default is 8001.  Controllers
       connect on port+1 and publishers on port+2

  --capture=filename

       Save the entire published data streams to a file so they can be replayed
       with test/playback.py

  --debug

       Run the tornado server in debug mode, which provides error messages on the
       client and triggers restart when the server file changes.

The web port should be widely accessible, the publisher port should only be
accessible to instrument computers and the control port should only be
accesible to computers that are allowed to control the instruments.  These
port permissions should be configured within the firewall.
"""

def main():
    logging.getLogger().setLevel(logging.INFO)
    
    try:
        longopts = ["capture=","port=","debug"]
        opts, args = getopt.getopt(sys.argv[1:], "c:p:d", longopts)
        if args:
            raise getopt.GetoptError("server.py only accepts options")
    except getopt.GetoptError, exc:
        print str(exc)
        usage()
        sys.exit(1)
    
    DEBUG=False
    for name,value in opts:
        if name in ("-c", "--capture"):
            pubsub.start_capture(value)
        elif name in ("-p", "--port"):  
            SUBSCRIBER_PORT = int(value)
            CONTROLLER_PORT = SUBSCRIBER_PORT+1
            PUBLISHER_PORT = SUBSCRIBER_PORT+2
        elif name in ("-d", "--debug"):
            DEBUG = True
        else:
            print "unknown option",name
    
    serve()

if __name__ == "__main__":
    main()

