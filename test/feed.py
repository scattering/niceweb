#!/usr/bin/env python
# -*- coding: latin-1 -*-

"""
Test data feed for the server.

Requires socketIO client and ZeroC python bindings.
"""
import time

from sioclient import SocketIO

import Ice
Ice.loadSlice('-I. --all --underscore devices.ice')

from nice.api import data, devices

enums = set((data.StorageMode,
             data.DeviceState,
             data.CountAgainst,
             data.SansSampleMode,
             devices.ValidityT))

# about Jan 1 2012 in milliseconds since Jan 1 1970
T0 = int(42*365.2425*24*60*60*1000)

def deice(obj):
    if isinstance(obj, data.NullValue):
        return None
    elif isinstance(obj, data.Value):
        return deice(obj.val)
    elif type(obj) in enums:
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
    def __init__(self):
        self.devices = {}
        self.reset_notify()
    def reset_notify(self):
        self.added = set()
        self.removed = set()
        self.changed = set()
    def add(self, **kw):
        node = devices.DeviceNode(**kw)
        self.devices[node.id] = node
        self.added.add(node.id)
    def remove(self, id):
        del self.devices[id]
        if id in self.added:
            # recently added, and already disappeared so ignore
            self.removed.add(node.id)
        else:
            self.added.discard(node.id)
        self.changed.discard(node.id)
    def change(self, id, current=None, desired=None, timestamp=None):
        node = self.devices[id]
        if current:
            node.currentValue.val = current
            node.currentValue.timeStampBefore = timestamp
            node.currentValue.timeStampAfter = timestamp
        if desired:
            node.desiredValue.val = desired
            node.desiredValue.timeStampBefore = timestamp
            node.desiredValue.timeStampAfter = timestamp
        self.changed.add(id)
    def connect(self, channel):
        self.channel = channel
        self.channel.emit('started', 
                          [deice(v) for v in self.devices.values()])
        self.reset_notify()
    def update(self):
        if self.added:
            self.channel.emit('added', 
                              [deice(self.devices[id]) for id in self.added])
        if self.removed:
            self.channel.emit('removed', 
                              list(self.removed))
        if self.changed:
            self.channel.emit('changed', 
                              [deice(self.devices[id]) for id in self.changed])
        self.reset_notify()

class Instrument(object):
    def __init__(self, name):
        self.name = name
        self.device = Devices()
    def connect(self, socket):
        self.device.connect(socket.connect('/%s/device'%self.name))
        self.control = socket.connect('/%s/control'%self.name)
        self.control.on('message', self.perform_command)
        self.control.emit('listen')
    def update(self):
        self.device.update()
    def perform_command(self, line):
        print "performing",line
        parts = line.split()
        if parts[0] == 'move':
            self.device.change(parts[1], current=parts[2], desired=parts[2])
        print "done"
        self.update()

def main():
    sans10m = Instrument('sans10m')
    sans10m.device.add(
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
            timeStampBefore = T0,
            timeStampAfter = T0,
            ),
        currentValue = devices.DeviceValue(
            val = data.DoubleValue(3.0),
            validity = devices.ValidityT.GOOD,
            validityString = None,
            timeStampBefore = T0,
            timeStampAfter = T0,
            ),
        )
    sans10m.device.add(
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
            timeStampBefore = T0,
            timeStampAfter = T0,
            ),
        )

    socket = SocketIO('localhost', 8001)
    sans10m.connect(socket)
    time.sleep(1)
    sans10m.device.change('detector.counts', 
                          current=data.DoubleArrayValue([3,4,5]),
                          timestamp=T0+1)
    sans10m.update()
    time.sleep(1)
    sans10m.device.change('detector.counts', 
                          current=data.DoubleArrayValue([6,5,6]),
                          timestamp=T0+2)
    sans10m.update()
    time.sleep(1)
    sans10m.device.change('detector.counts', 
                          current=data.DoubleArrayValue([10,9,11]),
                          timestamp=T0+3)
    sans10m.update()
    time.sleep(1)
    sans10m.device.change('detector.counts', 
                          current=data.DoubleArrayValue([12,12,12]),
                          timestamp=T0+4)
    sans10m.update()
    time.sleep(100)
    
    
if __name__ == "__main__":
    main()