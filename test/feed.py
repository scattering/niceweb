#!/usr/bin/env python
# -*- coding: latin-1 -*-

"""
Test data feed for the server.

Requires socketIO client and ZeroC python bindings.
"""
import time

import numpy

from sioclient import SocketIO

import Ice
Ice.loadSlice('-I. --all --underscore devices.ice')

from nice.api import data, devices

# about Jan 1 2012 in milliseconds since Jan 1 1970
T0 = 42*365.2425*24*60*60*1000
class SimulationTime(object):
    """
    Class to keep track of simulation time.
    
    *T* is the simulation time in milliseconds since epoch (Jan 1, 1970).
    """
    def __init__(self, T=T0):
        self.T = T
        
    def sleep(self, dT):
        """
        Sleep for *dT* seconds and update simulation clock.
        
        Note that *dT* is in seconds to be consistent with time.sleep(), 
        but *T* is in milliseconds to be consistent with NICE timestamps.
        """
        self.T += dT*1000
        time.sleep(dT)
SIM_TIME = SimulationTime()


# List of enumerated types in NICE interface
NICE_ENUMS = set((
    data.StorageMode,
    data.DeviceState,
    data.CountAgainst,
    data.SansSampleMode,
    devices.ValidityT,
    ))

def deice(obj):
    """
    Convert a NICE type into python primitives which can be pickled by JSON.
    """
    if isinstance(obj, data.NullValue):
        return None
    elif isinstance(obj, data.Value):
        return deice(obj.val)
    elif type(obj) in NICE_ENUMS:
        return str(obj)
    elif isinstance(obj, Ice.Object):
        return deice(obj.__dict__)
    elif isinstance(obj, dict):
        return dict( (k,deice(v)) for k,v in obj.items())
    elif isinstance(obj, list):
        return [deice(v) for v in obj]
    else:
        return obj

class Devices(object):
    """
    Set of devices associated with the instrument.  This corresponds
    roughly to the DeviceModel in NICE.
    """
    def __init__(self):
        self.devices = {}
        self._reset_notify()
        
    def add(self, **kw):
        """
        Add a node.  Keyword arguments match devices.DeviceNode.

        To add a whole device, each node needs to be added individually.
        
        The web proxy will not be updated until update() is called.
        """
        node = devices.DeviceNode(**kw)
        self.devices[node.id] = node
        self.added.add(node.id)
        
    def remove(self, id):
        """
        Remove a node from a running instrument.
        
        To remove a whole device, each node needs to be removed individually.
        
        The web proxy will not be updated until update() is called.
        """
        del self.devices[id]
        if id in self.added:
            # recently added, and already disappeared so ignore
            self.removed.add(node.id)
        else:
            self.added.discard(node.id)
        self.changed.discard(node.id)
        
    def change(self, id, current=None, desired=None, timestamp=None,
               validity=None, message=None):
        """
        Simulate a change in node value.  
        
        This only changes the desired and current value, not the metadata 
        such as units or precision.
        
        Timestamp is milliseconds since Jan 1, 1970.
    
        Validity is one of GOOD, BAD or SUSPECT in the namespace 
        devices.ValidityT.
        
        Any arguments not specified are left unchanged.
        
        The web proxy will not be updated until update() is called.
        """
        if timestamp is None: raise TypeError("need timestamp")
        node = self.devices[id]
        if current is not None:
            node.currentValue.val = current
            node.currentValue.timeStampBefore = timestamp.T
            node.currentValue.timeStampAfter = timestamp.T
        if validity is not None:
            node.currentValue.validity = validity
            node.currentValue.validityString = message
        if desired is not None:
            node.desiredValue.val = desired
            node.desiredValue.timeStampBefore = timestamp.T
            node.desiredValue.timeStampAfter = timestamp.T
        self.changed.add(id)
        
    def connect(self, channel):
        """
        Connect device to the appropriate proxy channel.
        
        This simulates instrument startup, which triggers the device model
        reset message that initializes all node values on the client.
        """
        self.channel = channel
        self.channel.emit('reset', 
                          [deice(v) for v in self.devices.values()])
        self._reset_notify()
        
    def update(self):
        """
        Send add/remove/change notification to the proxy.
        """
        if self.added:
            self.channel.emit('added', 
                              [deice(self.devices[id]) for id in self.added])
        if self.removed:
            self.channel.emit('removed', 
                              list(self.removed))
        if self.changed:
            self.channel.emit('changed', 
                              [deice(self.devices[id]) for id in self.changed])
        self._reset_notify()

    def _reset_notify(self):
        """
        Clear notification status
        """
        self.added = set()
        self.removed = set()
        self.changed = set()


class Instrument(object):
    """
    NICE instrument.  This is a collection of devices, queue, data stream
    and controls associated with the instrument.
    
    *name* is the name of the instrument.
    """
    def __init__(self, name):
        self.name = name
        self.device = Devices()
        
    def connect(self, socket):
        """
        Connect the NICE pub-sub channels and the control channel to the
        web proxy *socket*.
        """
        self.device.connect(socket.connect('/%s/device'%self.name))
        self.control = socket.connect('/%s/control'%self.name)
        self.control.on('message', self.perform_command)
        self.control.emit('listen')
        
    def perform_command(self, line):
        parts = line.split()
        if parts[0] == 'move':
            self.device.simulate(parts[1], SIM_TIME, desired=parts[2])


def device_init(device, timestamp):
    """
    Create a simple instrument with the following nodes::
    
        A3.position = 3
        detector.counts = [0,0,0]
    """
    device.add(
        id = "A3.position",
        description = "Incident angle",
        units = u"°",
        precision = 0.01,
        isScannable = True,
        storageMode = data.StorageMode.STATE,
        isStored = True,
        isUserLocked = False,
        isAdminLocked = False,
        desiredValue = devices.DeviceValue(
            val = data.DoubleValue(3.0),
            validity = devices.ValidityT.GOOD,
            validityString = None,
            timeStampBefore = timestamp.T,
            timeStampAfter = timestamp.T,
            ),
        currentValue = devices.DeviceValue(
            val = data.DoubleValue(3.0),
            validity = devices.ValidityT.GOOD,
            validityString = None,
            timeStampBefore = timestamp.T,
            timeStampAfter = timestamp.T,
            ),
        )
    device.add(
        id = "detector.counts",
        description = "Counts on the detector",
        units = "",
        precision = 0.01,
        isScannable = False,
        storageMode = data.StorageMode.COUNTS,
        isStored = True,
        isUserLocked = False,
        isAdminLocked = False,
        desiredValue = data.NullValue(),
        currentValue = devices.DeviceValue(
            val = data.DoubleArrayValue([0,0,0]),
            validity = devices.ValidityT.GOOD,
            validityString = None,
            timeStampBefore = timestamp.T,
            timeStampAfter = timestamp.T,
            ),
        )

def simulate_move(device, timestamp, desired, 
                  duration=1, dT=0.1, node="A3.position"):
    """
    Simulate move.
    
    *device* is the device to move
    *timestamp* is the clock
    *desired* is the target value.    
    *duration* is the total duration of the move (default is 1 s)
    *dT* is the move update frequency (default is 0.1 s)
    *node* is the node to move (default is A3.position)
    """    
    current = device.devices[node].currentValue.val.val;
    N = int(duration/0.01)
    step = (desired-current)/N
    device.change(node, desired=desired, timestamp=timestamp)
    for _ in range(N):
        timestamp.sleep(0.01)
        current += step
        device.change(node, current=current, timestamp=timestamp)
        device.update()
    
def simulate_count(device, timestamp):
    """
    Simulate detector counts on the instrument over four seconds.
    """
    timestamp.sleep(1)
    device.change('detector.counts', 
                  current=data.DoubleArrayValue([3,4,5]),
                  timestamp=timestamp)
    device.update()
    
    timestamp.sleep(1)
    device.change('detector.counts', 
                  current=data.DoubleArrayValue([6,5,6]),
                  timestamp=timestamp)
    device.update()
    
    timestamp.sleep(1)
    device.change('detector.counts', 
                  current=data.DoubleArrayValue([10,9,11]),
                  timestamp=timestamp)
    device.update()
    
    timestamp.sleep(1)
    device.change('detector.counts', 
                  current=data.DoubleArrayValue([12,12,12]),
                  timestamp=timestamp)
    device.update()

def main():
    """
    Run the simulation.
    """
    sans10m = Instrument('sans10m')
    device_init(sans10m.device, SIM_TIME)
    socket = SocketIO('localhost', 8001)
    sans10m.connect(socket)
    
    simulate_move(sans10m.device, SIM_TIME, desired=7)
    simulate_count(sans10m.device, SIM_TIME)
    
    # sleep forever so that controller can run
    while True: time.sleep(1)

if __name__ == "__main__":
    main()
