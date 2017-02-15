(function(Ice, nice){
    DevicesMonitorI = Ice.Class(nice.api.devices.DevicesMonitor, {
         __init__: function() {
            this.subscribed = new Promise();
        },
        onSubscribe: function(devices, nodes, staticNodeData, groups, __current) {
            this.devices = this.HashMapToObject(devices);
            this.nodes = this.HashMapToObject(nodes);
            var changed = this.nodes;
            this.groups = this.HashMapToObject(groups);
            this.staticNodeData = this.HashMapToObject(staticNodeData);
            this.postChangedHooks = (this.postChangedHooks == null) ? [] : this.postChangedHooks;
            this.postChangedHooks.forEach( function(callback) { callback(changed); });
            this.subscribed.succeed();
        },
        
        changed: function(nodes, __current) {
            var changed = this.HashMapToObject(nodes);
            jQuery.extend(this.nodes, changed);
            this._lastChanged = changed;
            this.postChangedHooks.forEach( function(callback) { callback(changed); });
        },
        dynamicDevicesAdded: function(addRemoveID, childDeviceIDs, __current) {
            //alert('device added: ' + addRemoveID + '\n' + 'children: ' + childDeviceIDs);
        },
        dynamicDevicesRemoved: function(addRemoveID, __current) {
            //alert('device removed: ' + addRemoveID);
        },
        removed: function(devices, nodes, __current) {
            this._lastDevicesRemoved = this.HashMapToObject(devices);
            this._lastNodesRemoved = this.HashMapToObject(nodes);
        },
        added: function(devices, nodes, __current) {
            this._lastDevicesAdded = this.HashMapToObject(devices);
            this._lastNodesAdded = this.HashMapToObject(nodes);
        },
        getAllDeviceNames: function() {
            var devices = [];
            for (var d in this.devices) {
                devices.push(d); 
            }
            return devices;
        },
        HashMapToObject: function(m) {
            var obj={}; 
            m.forEach( function(dn) { 
                obj[dn]=m.get(dn);
            }); 
            return obj
        } 
    });
})(Ice, nice);

