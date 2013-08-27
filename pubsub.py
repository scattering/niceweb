"""
Manage a publsiher-subscriber architecture with channels.

Publishers and subscribers connect using socketIO to the
webserver implemented in tornadio2.

On connection, publishers emit a *reset* message with the
initial state.  Each channel has a set of messages that it
can receive to update the state of the channel.  Usually
these messages are forwarded to all connected subscribers.

On connection, subscribers receive a current copy of the
state.  The channel publisher methods will generally forward
the messages on to the subscriber so that the subscriber
can maintain its own copy of the state.

Instead of subscribing, clients can use a RESTful interface
to access the channel state.  The *state* request retrieves
the current state of the channel.  Individual channels may
provide other methods for accessing state properties that
are not sent in the initial message.

Channels are defined by subclassing the *Channel* object.
Individual methods in the channel object can be decorated
with @subscriber, @publisher depending on whether they are
available to subscribers or to publishers.  The returned
value from the method will be sent via socketIO back to
the caller if a callback is requested.

Channel methods can instead be marked with @restful if they
should be called in reponse to an http request.  For example,
the state method is implemented in the Channel class as:

    @restful
    def state(self, response):
        return self.restful_state(response)

This will be called in response to GET on the url.  The server
controls the mapping from url to resource, but it will probably
be something like:

    GET http://server/channel/state

The restful methods are called with a tornado RequestHandler object.
Request parameters are accessed as::

    response.get_argument('name', default=value)

The restful method can return a dictionary, in which case a JSON
response is created, or a string which is put into the response using
response.write(s).   You are free to compose the complete response
within the restful method, and return None.  You may want to
set the response headers along with the response, using
response.set_header.

To publish to a channel, the restful interface should use POST
requests.  Post requests are identified by tagging the resource
name with _POST.   In response to a post request, the channel method
should update the channel state, then emit the appropriate message
to the channel subscribers.  For example, you could update a channel
representing position using::

    POST http://server/channel/state?position=5

Within the Position channel, you would need the following method::

    @restful
    def state_POST(self, response):
        self.position = response.get_argument('position', default=0)
        self.emit('move',{'position':self.position})

Other request types (PUT, HEAD, DELETE, PATCH, OPTIONS) are handled
similarly.

Subclasses must call *Channel.__init__* to set the initial
data structures.  This happens by default if the subclass
does not provide an *__init__* method, otherwise the subclass
*__init__* must use either::

    super(SubclassName, self).__init__(self, *args, **kw)

or if it is a direct subclass, it can use the simpler form::

    Channel.__init__(self, *args, *kw)

The subclass must maintain the channel state.  The publisher
can call *reset(state)* on the connection before sending any
state changes, which will call *channel_reset(state)* in the
subclass.  The state is returned to the subscriber with
*channel_state()*.   If you want to provide a limited state option
to the restful interface, you can define *restful_state(response)*.
If not, the default GET request for state will return the full
channel state.
"""

import time
import datetime
import functools
import json
from inspect import ismethod, getmembers

from tornado.httpclient import HTTPError
import tornadio2 as sio

DEBUG = False

_CAPTURE_START = None
_CAPTURE_FILE = None
def start_capture(filename):
    global _CAPTURE_START, _CAPTURE_FILE
    _CAPTURE_START = time.time()
    _CAPTURE_FILE = open(filename,'wt')

def store_event(channel, event, args, kw):
    if _CAPTURE_FILE is not None:
        #print "storing",event,"from",channel,"to",CAPTURE_FILE
        if kw: args = [kw]
        _CAPTURE_FILE.write('[%g,"%s","%s",%s]\n'
                   % (time.time()-CAPTURE_START, channel,event, json.dumps(args)))
        _CAPTURE_FILE.flush()

def tagged_event(tag):
    """
    Decorator to mark a method as tagged with a particular handler class.
    """
    def handler(f):
         #print "adding tag",tag,"to",f.__name__
         f._tagged_event = tag, f.__name__
         return f
    return handler

# Decorator for subscriber events
subscriber = tagged_event('subscriber')
# Decorator for publisher events
publisher =  tagged_event('publisher')
# Decorator for restful requests
restful = tagged_event('restful')

def find_tags(channel, tag):
    """
    Set the socket events to those with the appropriate tag.
    """
    is_tagged_event = lambda x: ismethod(x) and getattr(x, '_tagged_event', (None, None))[0] == tag
    events = [(e._tagged_event[1], e)
              for _, e in getmembers(channel, is_tagged_event)]
    return dict(events)

def set_expiry(response, **kw):
    """
    Set the Cache-Control header for a tornado HTTP request handler response
    with an expiry time.

    Any combination of timedelta keywords can be used to specify the
    expiry time, including *weeks*, *days*, *hours*, *minutes*, *seconds*,
    *milliseconds* and *microseconds*.

    Raises ValueError if expiry is before now or after one year from now.
    """
    delta = datetime.timedelta(**kw)
    if not datetime.timedelta(0) <= delta <= datetime.timedelta(365):
        raise ValueError("Expiry time must be between 0 and 365 days")
    seconds = delta.days*24*3600 + delta.seconds
    if seconds > 0:
	    response.set_header("Cache-Control","max-age=%d,must-revalidate"%seconds)
    else:
        response.set_header("Cache-Control","no-cache")

class Subscriber(sio.SocketConnection):
    """
    Subscriber channel controls connections to the web client.

    *channel* defines the subscriber interface by marking all
    subscription methods with @subscriber.
    """
    def __init__(self, channel, *args, **kw):
        super(Subscriber,self).__init__(*args, **kw)
        self._events = find_tags(channel, 'subscriber')
        #print "subscriber events on",channel.name,self._events.keys()
        self.channel = channel

    def on_close(self):
        print "subscriber::%s"%self.endpoint, "close"
        self.channel._subscriber_disconnect(self)

    def on_open(self, request):
        print "subscriber::%s"%self.endpoint, "open"
        self.channel._subscriber_connect(self)
        return True

    def on_event(self, name, args=[], kwargs={}):
        #if self.tag == 'publisher':
        #    store_event(self.endpoint, name, args, kwargs)

        #print "%s::%s"%(self.tag,self.endpoint),name
        # Remove funky dict-only => keyword feature.
        if not args and kwargs: args,kwargs = [kwargs],{}
        #print "calling",name,"with",len(args),kwargs

        handler = self._events.get(name)
        if handler:
            return handler(*args)
        else:
            raise HTTPError(404,message='Invalid event name "%s" on channel %s' % (name,self.endpoint))

class Publisher(sio.SocketConnection):
    """
    Publisher connection that receives messages from the publisher.

    *channel* defines the publisher interface by marking all
    publication methods with @publisher.
    """
    def __init__(self, channel, *args, **kw):
        super(Publisher,self).__init__(*args, **kw)
        self._events = find_tags(channel, 'publisher')
        #print "publisher events on",channel.name,self._events.keys()
        self.channel = channel

    def on_close(self):
        print "publisher::%s"%self.endpoint, "close"
        self.channel._publisher_disconnect(self)

    def on_open(self, request):
        self.channel._publisher_connect(self)
        print "publisher::%s"%self.endpoint, "open"
        return True

    def on_event(self, name, args=[], kwargs={}):
        #print "publisher::%s"%self.endpoint,name
        store_event(self.endpoint, name, args, kwargs)
        # Remove funky dict-only => keyword feature.
        if not args and kwargs: args,kwargs = [kwargs],{}

        handler = self._events.get(name)
        if handler:
            return handler(*args)
        else:
            raise HTTPError(404,message='Invalid event name "%s" on channel %s' % (name,self.endpoint))

class Channel(object):
    """
    Individual channels should subclass this class to add channel specific
    publisher event handlers.

    Each channel may have state information stored with it, such as the
    last 1000 transactions or the current list of queued jobs.  This
    state is initialized by the publisher with a *reset* message when
    the publisher connects.  As new publisher messages arrive, this state
    must be maintained and updated by the channel so that new subscribers
    receive the current state.

    *fan_in* is True if multiple publishers can be connected.

    *fan_out* is True if multiple subscribers can be connected.

    *expiry* is the default expiry time in seconds for returned restful
    objects.  restful methods can use set_expiry(response, days=365) to
    for unlimited expiry, or set_expiry(response, days=0) for immediate
    expiry, and no caching.
    """
    name = 'unnamed channel'
    def __init__(self, name=None, fan_in=False, fan_out=True, expiry=60):
        self.expiry = expiry
        self._fan_in = fan_in
        self._fan_out = fan_out
        self._subscribers = set()
        self._publishers = set()
        # set self._events to a dictionary of RESTful methods
        self._rest_methods = find_tags(self, 'restful')

    def _subscriber_connect(self, client):
        """
        Called on close connection.  This removes the
        subscriber from the subscription list.

        Subclasses if len(self.subscribers)>=1 if you
        want to restrict the services to a fan-in architecture that
        has a single subscriber for multiple publishers.
        """
        if not self._fan_out and len(self._subscribers) == 1:
            raise IOError("Only one subscriber permitted for channel "+self.name)
        self._subscribers.add(client)
        #print self.channel_state()
        #print "send initial state",self.name
        client.emit('reset', self.channel_state())
        return self.channel_state()

    def _subscriber_disconnect(self, client):
        """
        Called by subscriber on open connection.  This adds the
        subscriber to the subscription list and returns the initial
        channel state.

        Override this and check if len(self.subscribers)>=1 if you
        want to restrict the services to a fan-out architecture that
        has a single publisher for multiple subscribers.
        """
        # Ignore disconnect for unconnected clients
        try: self._subscribers.remove(client)
        except KeyError: pass

    def _publisher_connect(self, server):
        if not self._fan_in and len(self._publishers) == 1:
            raise IOError("Only one publisher permitted for channel "+self.name)
        self._publishers.add(server)
    def _publisher_disconnect(self, server):
        self._publishers.remove(server)

    def rest(self, response, action, resource):
        """
        Perform a RESTful request on the channel.

        Raises HTTPError(404) if the method does not exist.
        """
        if action != "GET": resource += "_" + action
        #print "restful::%s"%resource,self._rest_methods
        if resource not in self._rest_methods:
            raise HTTPError(404)
        set_expiry(response, seconds=self.expiry)
        result = self._rest_methods[resource](response)
        if result is not None:
            # Note: dictionary results are automatically converted to JSON
            response.write(result)

    def emit(self, event, *args):
        """
        Called by publisher methods to send a socketIO event
        to all connected clients.
        """
        for f in self._subscribers:
            #print "args",args
            #print "sending",event,"to",f.channel,f.session
            f.emit(event, *args)

    def send(self, message, callback=None):
        """
        Called by publisher methods to send a socketIO message
        to all connected clients.
        """
        for f in self._subscribers:
            f.send(f, message, callback=callback)

    def channel_reset(self, state):
        """
        Reset the channel state from the publisher.

        Must be implemented in Channel subclass.
        """
        raise NotImplementedError

    def channel_state(self):
        """
        Initial state returned to channel subscribers.

        Must be implemented in Channel subclass.
        """
        raise NotImplementedError

    def restful_state(self, response):
        """
        State to return on RESTful request for the channel state.

        The default is to return self.channel_state, as is seen by
        the subscribers to the push service.

        May be overridden by Channel subclass.
        """
        return self.channel_state()

    @restful
    def state(self, response):
        """
        Return the current channel state.  Specific channels may
        process request parameters, such as page number or other
        range information.
        """
        return self.restful_state(response)

    @subscriber
    def publisher_count(self):
        """
        Return number of publishers connected to the channel.
        """
        return len(self._publishers)

    @publisher
    def subscriber_count(self):
        """
        Return number of subscribers connected to the channel.
        """
        return len(self._subscribers)

    @publisher
    def reset(self, state=None):
        """
        Reset the stream.

        In a fan-out system, the publisher should issue a reset whenever the
        system reconnects.  In fan-in/fan-out architectures (i.e., multiple
        publishers and multiple subscribers), state will need to be maintained
        by the channel, possibly across server reset.
        """
        self.channel_reset(state)
        #print "broadcast reset on",self.name
        self.emit('reset', self.channel_state())

