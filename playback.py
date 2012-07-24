#!/usr/bin/env python
# -*- coding: latin-1 -*-
"""
Test data feed for the server.  This program feeds NICE events to the web repeater
so that they can be used to debug the web client.

Usage::

    ./playback.py capturefile ...

where capturefile is a captured event stream for a particular
instrument and channel, such as *capture.sans10m.queue*.  The filename
must end with instrument.channel.

Requires socketIO client.
"""
import time
import sys
import json

import numpy

from sioclient import SocketIO

def run_log(socket, filename):
    instrument, channel_name = filename.split('.')[-2:]
    channel = socket.connect('/%s/%s'%(instrument,channel_name))
    T0 = None
    for line in open(filename,"r"):
        #print "line",line
        T,ev,args = json.loads(line)
        if T0 != None:
            time.sleep(T-T0)
        T0 = T
        channel.emit(ev, *args)

def main():
    socket = SocketIO('localhost', 8001)
    for filename in sys.argv[1:]:
        run_log(socket, filename)

if __name__ == "__main__":
     main()
