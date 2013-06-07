from pubsub import Channel, publisher, subscriber, restful

class Facility(object):
    def __init__(self):
        self.instruments = {}

    def add(self, instrument):
        self.instruments[name.name] = instrument

    def remove(self, name):
        del self.instrument[name]

class Instrument(object):
    def __init__(self, name):
        self.name = name
        CHANNELS = [
            ControlChannel, 
            EventChannel, 
            ConsoleChannel,
            DataChannel, 
            DeviceChannel, 
            QueueChannel,
        ]
        self.channel = dict((chan.name,chan()) for chan in CHANNELS)

class ControlChannel(Channel):
    """
    NICE controller.

    Publisher-subscriber relationship is reversed.
    """
    name = 'control'
    def __init__(self):
        Channel.__init__(self, fan_in=True, fan_out=False)

    def channel_state(self):
        return {}

    # No channel_reset since publisher should not send it in this case.

    @publisher
    def console(self, command):
	return self.emit('console', command)

    @publisher
    def complete(self, command):
        return self.emit('complete', command)

    @publisher
    def move(self, move_list, relative):
        return self.emit('move', move_list, relative)

    @publisher
    def read(self, nodeID):
        """
        Poll dependent device drivers for the value of a device node.
        
        Note: probably want to do a console read command instead so that
        you can poll multiple devices and use regular expressions to do so.  
        The new values will come through the device channel, so no need to 
        wait for the callback to return.
        """
        return self.emit('read', nodeID)

    @publisher      
    def echo(self, message):
        return self.emit('echo', message)

    @publisher
    def setUserBreak(self, commandID, flag):
        return self.emit('setUserBreak', commandID, flag)

    @publisher
    def setSystemBreak(self, commandID, flag):
        return self.emit('setSystemBreak', commandID, flag)

class EventChannel(Channel):
    """
    NICE logger interface.
    """
    name = 'events'
    def __init__(self):
        Channel.__init__(self, fan_in=False, fan_out=True)
        self.channel_reset([])

    def channel_reset(self, state):
        self.events = state[:10]

    def channel_state(self):
        return { 'events': self.events }

    @publisher
    def created(self, event):
        self.events.append(event)
        self.events = self.events[:10]
        #print "event channel is", self.channel
        self.emit('created', event)

    @publisher
    def acknowledged(self, event_id):
        pass

    @publisher
    def resolved(self, event_id, resolution):
        pass

class ConsoleChannel(Channel):
    name = 'console'

    def __init__(self):
        Channel.__init__(self, fan_in=False, fan_out=True)
        self.channel_reset([])

    def channel_reset(self, state):
        self.events = state

    def channel_state(self):
        return { 'events': self.events }

    @publisher
    def report(self, event):
        self.events.append(event)
        self.emit('report', event)

class DataChannel(Channel):
    name = 'data'

    def __init__(self):
        Channel.__init__(self, fan_in=False, fan_out=True)
        self.records = []

    def channel_state(self):
        return {'records':self.records}

    def channel_reset(self, state):
        self.records = state

    @publisher
    def data(self, record):
        # Note: may want instrument specific handling of the data so that we only send
        # a summary of the detector image to the server, not the whole detector.  We
        # will still want to store the individual detector frames so that we can
        # return them to the client on request..
        #print "data command",record['command']
        if record['command'] == "Configure":
            self.records = []
        # Ignore intermediate counts; client can pull them off the device stream
        if record['command'] == "Counts" and record['status'] not in ('complete','abort'):
            return
        self.records.append(record)
        #print "emitting data",record['command']
        self.emit('record', record)
         

class DeviceChannel(Channel):
    """
    NICE device model.
    """
    name = 'device'

    def __init__(self):
        Channel.__init__(self, fan_in=False, fan_out=True)
        self.devices = None
        self.nodes = None
        self.view = {}

    def channel_reset(self, state):
        #print "receiving device state"
        self.devices, self.nodes, self.view = state
        _fixup_devices(self.devices,self.nodes)

    def channel_state(self):
        #print "getting device state"
        return {'devices':self.devices, 'view':self.view}
    
    @subscriber
    def device_hierarchy(self):
        return self.view # take the "structure" part
    
    @subscriber
    def filled_device_hierarchy(self):
        from copy import deepcopy
        devices = self.devices
        nodes = self.nodes
        filled_structure = deepcopy(self.view)
        def get_value(dottedname):
            keys = dottedname.split('.')
        
        def fill_children(item):
            if len(item['children']['elements']) == 0:
                if item['nodeID'] in nodes.keys():
                    node = nodes[item['nodeID']]
                    # then we're a node
                    device = devices[node.deviceID]
                    value = node.currentValue.userVal.val
                    new_id = node['id']
                elif item['nodeID'] in devices: 
                    device = devices[item['nodeID']]
                    primaryNodeID = device['primaryNodeID']
                    if primaryNodeID == '': primaryNodeID = device['visibleNodeIDs'][0]
                    primaryNode = nodes[item['nodeID'] +'.'+ primaryNodeID]
                    value = primaryNode['currentValue']['userVal']
                    new_id = primaryNode['id']
                item['value'] = value
                item['id'] = new_id
            else:
                for i in item['children']['elements']:
                    fill_children(i)
        fill_children(filled_structure)
        return filled_structure

    @publisher
    def added(self, devices, nodes):
        """
        Nodes added to the instrument.  Forward their details to the
        clients.
        """
        _fixup_devices(devices, nodes)
        self.devices.update(devices)
        self.emit('added', devices)

    @publisher
    def removed(self, devices, nodes):
        """
        Nodes removed from the instrument.  Forward their names to the clients.
        """
        deviceIDs = devices.keys()
        for device in deviceIDs:
            del self.devices[device]
        self.emit('removed', deviceIDs)

    @publisher
    def changed(self, nodes):
        """
        Node value or properties changed.  Forward the details to the clients.
        """
        for node in nodes:
            #print node
            self.devices[node['deviceID']]['nodes'][node['nodeID']] = node
        # May want to do bandwidth limiting, an only send updates to big nodes
        # such as 2-D detector and ROI mask every minute rather than every
        # time they are updated.
        self.emit('changed', nodes)

def _fixup_devices(devices, nodes):
    for v in devices.values():
        v['nodes'] = {}
        #print v['primaryNodeID'],v['stateNodeID'],v['visibleNodeIDs']
        v['primaryNodeID'] = v['primaryNodeID'].split('.')[1] if v['primaryNodeID'] else ''
        v['stateNodeID'] = v['stateNodeID'].split('.')[1] if v['stateNodeID'] else ''
        v['visibleNodeIDs'] = [id.split('.')[1] for id in v['visibleNodeIDs']]
    for v in nodes.values():
        devices[v['deviceID']]['nodes'][v['nodeID']] = v


class QueueChannel(Channel):
    """
    NICE queue model.

    Publisher follows NICE queue API, but with linked list of children
    replaced by a normal list, and with parentID/prevID removed from the
    node details for ease in maintaining a consistent queue state on the
    client.

    Subscribers emit 'subscribe' when first connected, which returns the
    complete queue.  A queue node looks like::

        node = {
            "id": int,
            "parentID": int,
            "children": [node, ...],
            "status": {
                "commandStr": string,
                "errors": [string, ...],
                "isBreakPoint": boolean,
                "metaState": string,
                "state": "QUEUED|RUNNING|CHILDREN|FINISHED|SKIPPED",
                }
            },
            "origin": int,

    Queue path is a list of integers.

    Queue status is "IDLE|STOPPING|BUSY|SUSPENDED|SUSPENDING|SHUTDOWN".

    Subscribers should expect the following events::

       queue.on('added', function (path, node) {})
           add the nodes and all its children as a child of the parent node
           after the sibling node, or at the beginning if sibling is 0.
       queue.on('removed', function (path) {})
           remove the node
       queue.on('moved', function (oldpath, newpath, node) {})
           remove the node and add it to parent after sibling
       queue.on('changed', function (path, status) {})
           update the status of the node
       queue.on('status', function (queue_status) {})
           update the status of the queue
       queue.on('reset', function (node) {})
           replace the queue with the given queue

    Rather than maintaining the state on the client, subscribers can
    simply resubmit the subscribe message to get an up-to-date version
    of the queue.
    """
    name = 'queue'

    def __init__(self):
        Channel.__init__(self, fan_in=False, fan_out=True)
        self.queue_root = { 'children': [] }
        self.queue_status = 'IDLE'

    def channel_state(self):
        return { 'queue': self.queue_root, 'status': self.queue_status }

    def channel_reset(self, state):
        self.queue_root = state[0]
        self.queue_status = state[1]
        #print self.queue_root
        #print "queue status",self.queue_status

    @publisher
    def added(self, path, node):
        """
        Node added to the queue.  Forward the details to the
        clients.
        """
        queue_add(self.queue_root, path, node)
        #print "queue add",[n['id'] for n in nodes]
        self.emit('added', path, node)

    @publisher
    def removed(self, path, node):
        """
        Nodes removed from the queue.  Forward them to the clients.
        """
        #print "queue remove",nodeIDs[0]
        queue_remove(self.queue_root, path)
        self.emit('removed', path)

    @publisher
    def moved(self, old, new, node):
        """
        Nodes moved from the instrument.  Forward their names to the clients.
        """
        #print "queue move",nodeID,parentID,prevID
        queue_remove(self.queue_root, old)
        queue_add(self.queue_root, new, node)
        self.emit('moved', old, new, node)

    @publisher
    def changed(self, path, nodeID, status):
        """
        Node state changed.  Forward the details to the clients.
        """
        queue_update(self.queue_root, path, status)
        #print "queue change",nodeID
        self.emit('changed', path, status)

    @publisher
    def status(self, status):
        """
        Queue state changed.
        """
        self.queue_status = status 
        self.emit('status', status)

def queue_update(root, path, status):
    """
    Update the status on a node.
    """
    for idx in path: root = root['children'][idx]
    root['status'] = status

def queue_remove(root, path):
    """
    Remove a set of nodes from the queue.
    """
    for idx in path[:-1]: root = root['children'][idx]
    del root['children'][path[-1]]

def queue_add(root, path, node):
    """
    Add a node to the queue in a given position
    """
    for idx in path[:-1]: root = root['children'][idx]
    root['children'].insert(path[-1], node)


