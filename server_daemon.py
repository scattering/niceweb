#!/usr/bin/env python

from server import NICERepeater
import socket

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
        repeater = NICERepeater()
        repeater.web_settings['socket_io_port'] = SIO_PORT
        repeater.serve()
        ioloop.IOLoop.instance().start()
        #serve(debug=debug, sio_port=SIO_PORT)

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
