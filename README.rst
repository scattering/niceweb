NiceWeb
*******

NiceWeb is a web viewer of the state of the instruments in the NCNR.

Going beyond livedata, we include the ability to see the set of queued
runs, individual motor movements and reported errors.

Design
======

NICE servers run on the individual instrument computers.  Each server
will start a specialized client which feeds two proxies.  One, running
on an internal server, will have access to the complete set of NICE 
client capabilities, including moving motors and modifying the run queue.
Another, running on an external server, will be view only, showing
a filtered version of the information the NICE server produces.

The proxies will gather information from all instruments and present it
using web push technology based on the socket.IO protocol.  Individual 
browsers may use websockets, flash, or ajax to implement the push, but the 
server doesn't care.

The state of the instruments will be stored in a persistent cache.
When a NICE server comes online it will update both the internal and
external proxy  with the instrument state.  As motors move and counters
count, the cache will be updated and the clients notified.  New clients
will receive a snapshot of the instrument state on connecting, and will
be notified with updates as the instrument changes.

The cache technology doesn't matter.  Either redis or memcached should
work fine.  We are using redis.  The socket.IO server could be implemented 
in anything that supports socket.IO, including python, erlang, java,
ruby or the node reference implementation.  We will use a python solution.

Current Status
==============

We have the repeater for the device model, and a primitive interface to
NICE command line.  The web page is minimal.

TODO: Start the web proxy automatically with the server.

TODO: Support reboot of the repeater.


Installation
============

Install support packages for python::

    Ubuntu:  sudo apt-get install python-virtualenvwrapper
    Ubuntu:  sudo apt-get install python-tornado

    RedHat:  sudo yum install python-virtualenvwrapper   # 2.3-3.el6
    RedHat:  sudo yum install python-tornado             # 2.2.1-1.el6

Use virtualenv to isolate the python environment::

    Ubuntu:  source /etc/bash_completion.d/virtualenvwrapper
    RedHat:  source `which virtualenvwrapper.sh`

Use virtualenv to isolate the python environment::

    mkvirutalenv --system-site-packages niceweb

Note that you can use this virtual environment from eclipse by setting
the pydev interpreter to ~/.virtualenvs/niceweb/bin/python.

To go back to this python enviroment later, or in another console, you
need to again source virtualenvwrapper.sh, then do::

    workon niceweb

We have a ZeroC python client to feed NICE status to our proxy server,
which requires our own socketIO client library to communicate.  This is 
only needed on the instrument computers, not on the webster repeater. 
Install the python client from here::

    git clone git://github.com/scattering/socketIO-client.git
    (cd socketIO-client && python setup.py install)

TornadIO2 needs to be installed from PyPI::

    pip install tornadio2


Example Usage
=============

Start the server using::

    cd niceweb
    ./server.py

Point your browser to localhost:8001.  You should see a mostly empty console.

In a separate terminal, start the fake instrument::

    cd niceweb/test
    ./feed.py

Back in the browser, you can see change notices every second.   After 4 seconds,
type "move A3.position 5" and click submit.  This will send the move command
through the proxy to the feed.py fake instrument script, which will then
pretend that the move was successful and send a new change notice.

