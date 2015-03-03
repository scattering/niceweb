(function (Ice, Glacier2,signin,nice,$){
            // keep this synchronized with src/nice/general/util/DeviceUtils.java
            SAMPLE_ENVIRONMENT_TYPES = [
                "ELECTROMAGNET",
                "SUPERCONDUCTING_MAGNET",
                "TEMPERATURE_CONTROLLER",
                "POLARIZATION",
                "POWER_SUPPLY"
            ]
            Devices = null;
            Controller = null;
            active_device = null; // for moving motors in jog panel
            update_devices = null;
            
            devicesMonitor = null;
            
            var Promise = Ice.Promise;
            var RouterPrx = Glacier2.RouterPrx;
            // shared state
            device_hierarchy = {};
            sample_environment_devices = null;
            shown_devices = {};
            controller_connected = true;
            no_control_warning_shown = false;
            
            $('#popupJog').popup();
            
            treeToHTML = function(tree, ihtml) {
                var ihtml = ihtml ? ihtml : "";
                
                if (tree.children.elements.length > 0) {
                    ihtml += "<div data-role='collapsible'>";
                    ihtml += '<h3>' + tree.nodeID + "</h3>";
                    ihtml += "<div data-role='collapsible-set'>";
                    ihtml += '<ul data-role="listview" data-filter="false" data-theme="d">';
                    for (var i in tree.children.elements) {                        
                        ihtml += treeToHTML(tree.children.elements[i]);
                    }
                    ihtml += "</ul>";
                    ihtml += "</div>";
                    ihtml += "</div>\n";
                } else {
                    var split_name = tree.nodeID.split('.');
                    var devname = split_name[0];
                    //var nodeID = tree.id
                    
                    if (split_name.length > 1) {
                        // then we have a node ID
                        nodeID = tree.nodeID;
                    } else {
                        // we have a device name, look up the primary node ID
                        var device = devicesMonitor.devices[tree.nodeID];
                        if (device) {
                            nodeID = device.primaryNodeID || device.visibleNodeIDs[0];
                        } 
                    }
                    
                    var value = devicesMonitor.nodes[nodeID].currentValue.userVal.val;
                    ihtml += "<li>";
                    ihtml += '<a  class="ui-grid-a move-button" onclick="jogPanel(\''+nodeID+'\');" data-icon="gear" data-iconpos="right" >';
                    ihtml += "<span class='ui-block-a device-name'>" + tree.nodeID + ':  </span>';
                    ihtml += "<span class='ui-block-b device-value' deviceid='"+ nodeID.replace('.', '_') +"'>"+value+"</span>";
                    ihtml += "</a></li>";
                    shown_devices[nodeID] = value;
                }
                return ihtml
            }
            
            function getInitialDeviceValue(dottedname) {
                var names = dottedname.split('.', 2);
                var devname = names[0]; 
                if (!(device_tree.hasOwnProperty(devname))) { return ""; }
                var dev = device_tree[devname];
                if (names.length == 2) {

                    var nodename = names[1];
                    if (dev.nodes && dev.nodes[nodename] && dev.nodes[nodename].currentValue) {
                        return dev.nodes[nodename].currentValue.userVal;
                    } else { 
                        return "";
                    }
                } else {
                    if (dev.primaryNodeID && dev.primaryNodeID != "") { 
                        return dev.nodes[dev.primaryNodeID].currentValue.userVal;  
                    } else {
                        return ""; 
                    }
                }
            }
            
            function setDeviceDisplayValue(dottedname, value) {
                $('span[deviceID|="'+dottedname.replace('.','_') +'"]').html(value.toString());
            }
            
            update_devices = function() {
                for (var i in shown_devices) {
                    var devname = i;
                    var val = shown_devices[i];
                    if (typeof(val) == "number") {
                        val = val.toFixed(4);
                    }
                    $('span[deviceID|="'+devname.replace('.','_') +'"]').html(val.toString());
                }                
            }
            
            update_nodes = function(nodes) {
                for (var n in nodes) {
                    // this has changed from list to obj
                    //var node = nodes[i];
                    //if (device_tree.hasOwnProperty(node.deviceID) && device_tree[node.deviceID].nodes.hasOwnProperty(node.nodeID)) {
                    //    device_tree[node.deviceID].nodes[node.nodeID] = node;
                    //}
                    var node = nodes[n];
                    if (shown_devices.hasOwnProperty(node.id)) {
                        var val = node.currentValue.userVal.val;
                        shown_devices[node.id] = val;
                        if (typeof(val) == "number") {
                            val = val.toFixed(4);
                        }
                        setDeviceDisplayValue(node.id, val);
                        
                    } 
                }               
            }
            
            
            
            jogPanel = function(nodeID) {
                active_device = nodeID; // global 
                $('#jog_motor_name').html(nodeID.toString());
                $('#jog_motor_value').attr('deviceid', nodeID.replace('.','_'));
                update_devices();
                $('#motor_target').attr('value', $('#jog_motor_value').html());
                if (controller_connected == true) {
                    $('#popupJog').popup('open');
                }
                else if (no_control_warning_shown == false) {
                    $('#popupNoControl').popup('open');
                    no_control_warning_shown = true;
                }
            }
            
            move = function(device, destination) {
                return api.move([device, destination.toString()])
            }
            
            moveToTarget = function() {
                var destination = $('#motor_target')[0].value;
                //Controller.emit('move', [active_device.toString(), destination.toString()], false);
                move(active_device.toString(), destination.toString());
            }
            jogUp = function() {
                var step = parseFloat($('#jog_step_value')[0].value);
                var current_destination = parseFloat($('#motor_target')[0].value);
                var new_destination = current_destination + step;
                $('#motor_target').attr('value', new_destination.toPrecision(4));
                // not doing relative move from NICE perspective - precalculating destination, so
                // 'relative' argument is false
                //Controller.emit('move', [active_device.toString(), new_destination.toString()], false);
                move(active_device.toString(), new_destination.toString());
            }
            jogDown = function() {
                var step = -1.0 * parseFloat($('#jog_step_value')[0].value);
                var current_destination = parseFloat($('#motor_target')[0].value);
                var new_destination = current_destination + step;
                $('#motor_target').attr('value', new_destination.toPrecision(4));
                //Controller.emit('move', [active_device.toString(), new_destination.toString()], false);
                move(active_device.toString(), new_destination.toString());
            }
            stopAll = function() {
                return api.stop()
            }
            
            function get_ids(obj, ids) {
                var ids = (ids == null) ? [] : ids;
                for (var i in obj.children.elements) {
                    if (obj.children.elements[i].children.elements.length == 0) {
                        ids.push(obj.children.elements[i].id);
                    } else {
                        get_ids(obj.children.elements[i], ids);
                    }
                }
                return ids;
            }

            getSampleEnvironment = function(state, existing_ids) {
                var se_device_hierarchy = {
                    nodeID: "SampleEnvironment",
                    children: {
                        elementClass: "nice.general.json.JsonTreeNode",
                        elements: []
                    }
                }

                var device_names = Object.keys(state.devices);
                for (var devicename in state.devices) {
                    var device = state.devices[devicename];
                    var nodeID = devicename + '.' + device.primaryNodeID;
                    if (SAMPLE_ENVIRONMENT_TYPES.indexOf(device.type._name) > -1 && (existing_ids.indexOf(nodeID) == -1)) {
                        se_device_hierarchy.children.elements.push({
                            nodeID: devicename,
                            id:  devicename + '.' + device.primaryNodeID,
                            value: device.nodes[device.primaryNodeID].currentValue.userVal,
                            children: {
                                elementClass: "java.lang.Object",
                                elements: []
                            }
                        });
                    }
                }
                return se_device_hierarchy;
            }
            
            var DevicesMonitorI = Ice.Class(nice.api.devices.DevicesMonitor, {
                onSubscribe: function(devices, nodes, groups, __current) {
                    var devices = this.HashMapToObject(devices);
                    var nodes = this.HashMapToObject(nodes);
                    var groups = this.HashMapToObject(groups);
                    this.devices = devices;
                    this.nodes = nodes;
                    this.groups = groups;
                    this.postChangedHooks = (this.postChangedHooks == null) ? [] : this.postChangedHooks;
                    if (this.postSubscribeHooks) {
                        this.postSubscribeHooks.forEach( function(callback) { callback(devices, nodes, groups); });
                    }
                },
                changed: function(nodes, __current) {
                    var changed = this.HashMapToObject(nodes);
                    jQuery.extend(this.nodes, changed);
                    this._lastChanged = changed;
                    if (this.postChangedHooks) {
                        this.postChangedHooks.forEach( function(callback) { callback(changed); });
                    }
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
                    this.devices.forEach(function(d) { devices.push(d); });
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
            
            var setupDevicesMonitor = function(api, router, adapter) {
                //var setup = new Promise();

                //
                // Get the session timeout and the router client category, and
                // create the client object adapter.
                //
                // Use Ice.Promise.all to wait for the completion of all the
                // calls.
                //
                return Promise.all(
                    router.getSessionTimeout(),
                    router.getCategoryForClient()
                ).then(
                    function(timeoutArgs, categoryArgs, adapterArgs)
                    {
                        var timeout = timeoutArgs[0];
                        var category = categoryArgs[0];
                        //var adapter = adapterArgs[0];

                        //
                        // Create the ChatCallback servant and add it to the
                        // ObjectAdapter.
                        //
                        var dvmI = new DevicesMonitorI();
                        /*
                        dvmI.postSubscribeHooks = [
                            function(devices, nodes, groups) { 
                                $('#device_tree').jstree(devices_to_jstree(devices, true));
                                $('#device_tree').on("ready.jstree", function (e, data) { update_jstree(nodes) });
                             }
                        ]
                        */
                        dvmI.postChangedHooks = [update_nodes];
                        var dvmPrx = nice.api.devices.DevicesMonitorPrx.uncheckedCast(adapter.add(dvmI, new Ice.Identity("devicesMonitor", category)));
                        var p = api.subscribeToDevices(dvmPrx);
                        //
                        devicesMonitor = dvmI;
                        return p;
                    }
                );
            }
            
            remote_control = function(hostname, port, username, password) {
                var port = (port == null) ? 9999 : port;
                return signin("NiceGlacier2/router:ws -p " + port.toFixed() + " -h " + hostname, "1.0", true, username, password).then(
                    function(communicator, router, session, adapter) {
                        var mgr = nice.api.Glacier2ClientApiSessionPrx.uncheckedCast(session);
                        return mgr.getAPI('client').then(
                            function(ca) {
                                return nice.api.ClientApiPrx.checkedCast(ca).then(
                                    function(cam) {
                                        api = cam;
                                        return setupDevicesMonitor(cam, router, adapter)
                                });
                        });
                }).then(
                    function() {
                        return api.getDeviceHierarchy().then(
                            function(dh) {
                                dhstring=dh;
                                mydh = JSON.parse(dh);
                                //alert(treeToHTML(mydh));
                                $('#content').html(treeToHTML(mydh)).trigger('create');
                        });
                }).then(
                    function() {
                        return api.getRefreshTimeout().then(
                            function(timeout_sec) {
                                // trigger a refresh every 70% of timeout;
                                window.setInterval(api.refresh, timeout_sec * 0.7 * 1000);
                        });
                });
                
            }

    //$(document).bind('pageinit', connect);
})(Ice, Glacier2, signin, nice, jQuery);
