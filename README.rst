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

Installation
============

Install support packages for python and redis::

    sudo yum install python-virtualenvwrapper   # 2.3-3.el6
    sudo yum install python-redis               # 2.0.0-1
    sudo yum install redis                      # 2.4.10-1

Use virtualenv to isolate the python environment::

    export WORKON_HOME=$HOME/pyenv
    mkdir -p $WORKON_HOME
    source `which virtualenvwrapper.sh`

    mkvirutalenv --system-site-packages niceweb

To go back to this python enviroment later, or in another console::

    export WORKON_HOME=$HOME/pyenv
    source `which virtualenvwrapper.sh`
    workon niceweb


Install the socket.IO server.   We will try with both tornadio and with
gevent+gunicorn.


tornadio
--------
sudo yum install python-tornado             # 2.2.1-1.el6


gevent-socketio
---------------
sudo yum install libev-devel                # 4.03-3.el6.i686
sudo yum install python-anyjson             # 0.3.1-1.el6
sudo yum install python-greenlet            # 0.3.1-6.el6

# rhel has libev but not libevent, so need prerelease of gevent
curl http://gevent.googlecode.com/files/gevent-1.0b2.tar.gz > gevent-1.0b2.tar.gz
tar xzf gevent-1.0b2.tar.gz
cd gevent-1.0b2
python setup.py build
python setup.py test
python setup.py install

# Using "pip install" for gevent-socketio out of laziness.
# Could pull and install the dependencies directly like we did for gevent
pip install gevent-socketio
# Dependencies:
#  gevent-socketio-0.3.5-beta.tar.gz
#  gevent-websocket-0.3.6.tar.gz
#  anyjson already satisfied
#  gevent already satisfied
#  greenlet already satisfied

# check that gevent-socketio works
git clone https://github.com/abourget/gevent-socketio.git
cd gevent-socketio/examples
python chat.py

firefox &
# point your browser at 127.0.0.1:8080 from a couple of different tabs and
# chat away

