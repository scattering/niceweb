
class ForwardProxy(object):
    def __init__(self, url):
        self.connection = client.connect(url)

class DataMonitor(nice.api.data.DataMonitor):
    def emit(self, message, current=None):
        pass

class EventMonitor(nice.api.events.EventMonitor):
    def created(self, event, current=None):
        pass
    def acknowledged(self, id, current=None):
        pass
    def resolved(self, id, resolution, current=None):
        pass
    def onSubscribe(self, events, current=None):
        pass

class DeviceMonitor(nice.api.devices.DeviceMonitor):
    def added(self, nodes, current=None):
        nodes = dict((v.id,v) for v in nodes)
        print "added", nodes.keys()
        pass
    def removed(self, nodeIDs, current=None):
        print "removed", nodeIDs
        pass
    def changed(self, nodes, current=None):
        #print "changed", nodes
        nodes = dict((v.id,v) for v in nodes)
        print "changed", nodes.keys()
        pass
    def onSubscribe(self, nodes, current=None):
        nodes = dict((v.id,v) for v in nodes)
        print "subscribe", nodes.keys()
        pass

class NiceQueue(nice.api.queue.QueueMonitor):

    def nodesAdded(self, node, current=None):
        """ Called when a command node is added to the queue """

    def nodesRemoved(self, nodeIDs, oldParentID, oldIndex, current=None):
        """ Called when a command node is removed from the queue """
        with self._cv:
            self._handleRemoved(nodeIDs, current=None)

    def nodeMoved(self, node, oldParentID, oldIndex, current=None):
        """ Called when a command node is moved from one location to another """
        with self._cv:
            self._handleMoved(node)

    def nodeChanged(self, node, current=None):
        """ Called when an individual command's state changes """
        with self._cv:
            self._handleChanged(node)

    def onSubscribe(self, root, current=None):
        """ Called when we initially subscribe to the queue topic """
        with self._cv:
            self._root = root
            self._commands = dict()
            self._removed = set()
            self._addToMapRec(root.child)

