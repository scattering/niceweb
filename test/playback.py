#!/usr/bin/env python
# -*- coding: latin-1 -*-
"""
Test data feed for the server.  This program feeds NICE events to the web repeater
so that they can be used to debug the web client.

Usage::

    playback.py capturefile.gz ...

where capturefile is a captured event stream for a particular instrument.  New
streams can be captured by starting the server with::

    server.py capture capturefile

The .gz extension will be added automatically.

Requires socketIO client.
"""
import time
import sys
import json
import gzip

import numpy

from sioclient import SocketIO

def run_log(socket, filename):
    channels = {}
    T0 = None
    for line in gzip.open(filename,"r"):
        #print "line",line
        T,channel_name,ev,args = json.loads(line)
        if T0 != None:
            time.sleep(T-T0)
        T0 = T
        if channel_name not in channels:
            channels[channel_name] = socket.connect(channel_name)
        channels[channel_name].emit(ev, *args)
    for ch in channels.values():
        ch.disconnect()

def main():
    if ':' in sys.argv[1]:
        url = sys.argv[1]
        files = sys.argv[2:]
    else:
        url = 'localhost:8001'
        files = sys.argv[1:]
    host,port = url.split(':')
    socket = SocketIO(host,int(port))
    for filename in files:
        run_log(socket, filename)

if __name__ == "__main__":
     main()
