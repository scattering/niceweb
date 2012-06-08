#!/usr/bin/env python
# encoding: utf-8
"""
client.py

Based heavily on:
- https://github.com/mtah/python-websocket/blob/master/examples/echo.py
- http://stackoverflow.com/a/7586302/316044

Created by Drew Harry on 2011-11-28.
"""

import sys
import httplib
import json
import websocket

def connect(server, port, **kw):
    '''
    connect to the socketio server

    1. perform the HTTP handshake
    2. open a websocket connection
    '''
    print "connecting to %s:%d" %(server, port)
    
    conn = httplib.HTTPConnection(server + ":" + str(port))
    conn.request('POST','/socket.io/1/')
    resp = conn.getresponse()
    hskey = resp.read().split(':')[0]

    url = 'ws://'+server+':'+str(port)+'/socket.io/1/websocket/'+hskey
    print "resp",resp
    print "hskey",hskey
    print "url",url
    return websocket.create_connection(url)


def encode_for_socketio(message):
    """
    Encode 'message' string or dictionary to be able
    to be transported via a Python WebSocket client to
    a Socket.IO server (which is capable of receiving
    WebSocket communications). This method taken from
    gevent-socketio.
    """

    MSG_FRAME = "~m~"
    HEARTBEAT_FRAME = "~h~"
    JSON_FRAME = "~j~"
    if isinstance(message, basestring):
            encoded_msg = message
    elif isinstance(message, (object, dict)):
            return encode_for_socketio(JSON_FRAME + json.dumps(message))
    else:
            raise ValueError("Can't encode message.")
    return MSG_FRAME + str(len(encoded_msg)) + MSG_FRAME + encoded_msg    

def send(ws, msg):
    dir(ws)
    ws.send(encode_for_socketio({'message':msg}))

def demo():
    if len(sys.argv) != 3:
        sys.stderr.write('usage: python client.py <server> <port>\n')
        sys.exit(1)
    
    server = sys.argv[1]
    port = int(sys.argv[2])
    
    def on_open(ws):
        print "opened!"
    def on_close(ws):
        print "closed!"
    def on_message(ws, msg):
        print "msg: "+str(msg)
    def on_error(ws, msg):
        print "err: "+str(msg)

    ws = connect(server, port, 
                 on_open=on_open, 
                 on_error=on_error, 
                 on_message=on_message,
                 on_close=on_close)
    send(ws,{'nickname': 'bot'})
    send(ws,{'user message': 'autogen'})
    ws.close()

if __name__ == '__main__':
    demo()

