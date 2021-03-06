(function(Ice, nice){
    DevicesMonitorI = class extends nice.api.devices.DevicesMonitor {
        constructor(postSubscribeHooks, postChangedHooks) {
            super();
            var _resolve, _reject;
            this.subscribed = new Promise(function(resolve, reject) {
                _resolve = resolve;
                _reject = reject;
            })
            this.postSubscribeHooks = (postSubscribeHooks == null) ? [] : postSubscribeHooks;
            this.postChangedHooks = (postChangedHooks == null) ? [] : postChangedHooks;
            this.postSubscribeHooks.push(function() { _resolve() });       
        }
        
        onSubscribe(devices, nodes, staticNodeData, groups, __current) {
            this.devices = devices;
            this.nodes = nodes;
            var changed = this.nodes;
            this.groups = groups;
            this.staticNodeData = staticNodeData;
            this.postChangedHooks.forEach( function(callback) { callback(changed) });
            this.postSubscribeHooks.forEach(function(callback) { callback(changed) });
        }
        
        changed(nodes, __current) {
            var these_nodes = this.nodes;
            nodes.forEach(function(node, nodename) {
                these_nodes.set(nodename, node);
            })
            this._lastChanged = nodes;
            this.postChangedHooks.forEach( function(callback) { callback(nodes); });
        }
        
        dynamicDevicesAdded(addRemoveID, childDeviceIDs, __current) {
            //alert('device added: ' + addRemoveID + '\n' + 'children: ' + childDeviceIDs);
        }
        
        dynamicDevicesRemoved(addRemoveID, __current) {
            //alert('device removed: ' + addRemoveID);
        }
        
        removed(devices, nodes, __current) {
            this._lastDevicesRemoved = devices;
            this._lastNodesRemoved = nodes;
        }
        
        added(devices, nodes, __current) {
            this._lastDevicesAdded = devices;
            this._lastNodesAdded = nodes;
        }
        
        getAllDeviceNames() {
            var devices = [];
            for (var d of this.devices.keys()) {
                devices.push(d); 
            }
            return devices;
        }
        
        MapToObject(m) {
            var obj={}; 
            m.forEach( function(v,k) { 
                obj[k]= v;
            }); 
            return obj
        } 
    };
})(Ice, nice);

