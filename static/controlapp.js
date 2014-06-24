(function (){
            // socket.io connections are globals
            PHP_BRIDGE_HOST = "http://nicedata.ncnr.nist.gov/nicephp/rpcp.php";
            CONTROL_INSTRUMENTS = {
                "cgdvm": "h123062.ncnr.nist.gov",
                "cgd": "magik.ncnr.nist.gov"
            }
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
            shown_devices= null;
            update_devices = null;

            // shared state
            device_hierarchy = {};
            shown_devices = {};
            controller_connected = false;
            no_control_warning_shown = false;
            
            $('#popupJog').popup();
            
            function treeToHTML(tree, ihtml) {
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
                    var nodeID = tree.id
                    /*
                    if (split_name.length > 1) {
                        // then we have a node ID
                        nodeID = tree.nodeID;
                    } else {
                        // we have a device name, look up the primary node ID
                        var device = device_tree[tree.nodeID];
                        if (device) {
                            nodeID = device.nodes[device.primaryNodeID].id;
                        } 
                    }
                    */
                    ihtml += "<li>";
                    ihtml += '<a  class="ui-grid-a move-button" onclick="jogPanel(\''+nodeID+'\');" data-icon="gear" data-iconpos="right" >';
                    ihtml += "<span class='ui-block-a device-name'>" + tree.nodeID + ':  </span>';
                    ihtml += "<span class='ui-block-b device-value' deviceid='"+ nodeID.replace('.', '_') +"'>"+tree.value+"</span>";
                    ihtml += "</a></li>";
                    shown_devices[nodeID] = tree.value;
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
            
            move = function(device, destination, host) {
                $.ajax({
                    url: PHP_BRIDGE_HOST,
                    type: "POST",
                    data: {
                        "hostname": host,
                        "function_name": "move",
                        "function_args": JSON.stringify([[device, destination.toString()], false])
                    },
                    dataType: "json",
                    //success: callback,
                    error: function (data) {
                        alert("ERROR: " + JSON.stringify(data));
                    }
                });
            }
            
            moveToTarget = function() {
                var destination = $('#motor_target')[0].value;
                //Controller.emit('move', [active_device.toString(), destination.toString()], false);
                move(active_device.toString(), destination.toString(), NICE_HOST);
            }
            jogUp = function() {
                var step = parseFloat($('#jog_step_value')[0].value);
                var current_destination = parseFloat($('#motor_target')[0].value);
                var new_destination = current_destination + step;
                $('#motor_target').attr('value', new_destination.toPrecision(4));
                // not doing relative move from NICE perspective - precalculating destination, so
                // 'relative' argument is false
                //Controller.emit('move', [active_device.toString(), new_destination.toString()], false);
                move(active_device.toString(), new_destination.toString(), NICE_HOST);
            }
            jogDown = function() {
                var step = -1.0 * parseFloat($('#jog_step_value')[0].value);
                var current_destination = parseFloat($('#motor_target')[0].value);
                var new_destination = current_destination + step;
                $('#motor_target').attr('value', new_destination.toPrecision(4));
                //Controller.emit('move', [active_device.toString(), new_destination.toString()], false);
                move(active_device.toString(), new_destination.toString(), NICE_HOST);
            }
            stopAll = function() {
                var host = NICE_HOST;
                $.ajax({
                    url: PHP_BRIDGE_HOST,
                    type: "POST",
                    data: {
                        "hostname": host,
                        "function_name": "stop",
                        "function_args": JSON.stringify([])
                    },
                    dataType: "json",
                    //success: callback,
                    error: function (data) {
                        alert("ERROR: " + JSON.stringify(data));
                    }
                });
                //Controller.emit('console', 'stop');
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
            
            getSampleEnvironment = function() {
                
            }
            
            function connect() {
                var Instrument = jQuery.getUrlVar('instrument') ? jQuery.getUrlVar('instrument') : "BT4";
                NICE_HOST = CONTROL_INSTRUMENTS[Instrument];
                $('#content').html('Loading...' + Instrument);
                var BaseURL = 'http://' + window.location.hostname + ':' + window.location.port;
                var Root = BaseURL + '/' +Instrument;
                document.title = Instrument + ' status';
                $('#instrument_header').html(Instrument);
                Devices = io.connect(Root + '/device', {
                    'connect timeout': 10000,
                    'transports': ['websocket', 'xhr-polling', 'htmlfile', 'jsonp-polling']
                });
                //var server = io.connect(BaseURL);
                //server.emit('controller', function(ControlHost) {
                /*
                var ControlHost = 'http://' + window.location.hostname + ':' + String(parseInt(window.location.port) + 1);
                //var ControlHost = BaseURL;
                    if (ControlHost) {
                        Controller = io.connect(ControlHost + '/' + Instrument + '/control', {
                            'rememberTransport': false,
                            'connect timeout': 10000,
                            'transports': ['websocket', 'xhr-polling', 'htmlfile', 'jsonp-polling']
                        });
                        controller_connected = true;

                        //Controller.emit('isactive', function(response) {
                        //    controller_connected = (response == "active");
                            if (controller_connected) {
                                $('.ui-icon-arrow-r').show();
                            } else {
                                $('.ui-icon-arrow-r').hide();
                            }
                        //});
                    }
                    // server.disconnect();
                //});
                */
                $.ajax({
                    url: PHP_BRIDGE_HOST,
                    type: "POST",
                    data: {
                        "hostname": NICE_HOST,
                        "function_name": "ls",
                        "function_args": JSON.stringify([".", "*", false])
                    },
                    dataType: "json",
                    async: false,
                    success: function(data) { 
                        controller_connected = true;
                        $('.ui-icon-arrow-r').show();
                    },
                    error: function (data) {
                        controller_connected = false;
                        alert("ERROR: " + JSON.stringify(data));
                        $('.ui-icon-arrow-r').hide();
                    }
                });
                
                Devices.on('reset', function(state) {
                    Devices.state=state;
                    var se_device_hierarchy = {
                        nodeID: "SampleEnvironment",
                        children: {
                            elementClass: "nice.general.json.JsonTreeNode",
                            elements: []
                        }
                    }
                    var device_names = state.devices.keys();
                    for (var devicename in state.devices) {
                        var device = state.devices[devicename]
                        if (SAMPLE_ENVIRONMENT_TYPES.indexOf(device.type._name) > -1) {
                            se_device_hierarchy.Devices.children.SampleEnvironment.children.elements.push({
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
                    $.extend(true, device_hierarchy, se_device_hierarchy);
                });

                Devices.on('changed', function (nodes) {
                    for (var n in nodes) {
                        // this has changed from list to obj
                        //var node = nodes[i];
                        //if (device_tree.hasOwnProperty(node.deviceID) && device_tree[node.deviceID].nodes.hasOwnProperty(node.nodeID)) {
                        //    device_tree[node.deviceID].nodes[node.nodeID] = node;
                        //}
                        var node = nodes[n];
                        if (shown_devices.hasOwnProperty(node.id)) {
                            var val = node.currentValue.userVal;
                            shown_devices[node.id] = val;
                            if (typeof(val) == "number") {
                                val = val.toFixed(4);
                            }
                            setDeviceDisplayValue(node.id, val);
                            
                            //$('#device_'+node.deviceID).html(node.currentValue.val.toString());
                        } 
                    }
                });
                //Devices.emit('subscribe', false);
                
                Devices.emit('filled_device_hierarchy', function(structure){
                    //$.extend(device_tree, tree, false);
                    $.extend(true, device_hierarchy, structure);
                    //$.extend(device_hierarchy, getSampleEnvironment(Devices), false);
                    $('#content').html(treeToHTML(device_hierarchy)).trigger('create');
                    update_devices();
                    if (controller_connected) { 
                        $('.ui-icon-arrow-r').show();
                    } else {
                        $('.ui-icon-arrow-r').hide();
                    }
                });
              
                Devices.on('reconnect', function() {
                    //Devices.emit('subscribe', false);
                    Devices.emit('filled_device_hierarchy', function(structure){
                        $.extend(device_hierarchy, structure, false);
                        update_devices();
                    });
                });
                
            }

    $(document).bind('pageinit', connect);
})();
