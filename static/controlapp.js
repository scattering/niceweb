(function (){
            // socket.io connections are globals

            Devices = null;
            Controller = null;
            active_device = null; // for moving motors in jog panel
            shown_devices= null;
            update_devices = null;

            // shared state
            device_hierarchy = {};
            shown_devices = {};
            var controller_connected = false;
            
            $('#popupJog').popup();
            
            
            
            function treeToHTML(tree, ihtml) {
                var ihtml = ihtml ? ihtml : "";
                
                if (tree.children.length > 0) {
                    ihtml += "<div data-role='collapsible'>";
                    ihtml += '<h3>' + tree.nodeID + "</h3>";
                    ihtml += "<div data-role='collapsible-set'>";
                    for (var i in tree.children) {                        
                        ihtml += treeToHTML(tree.children[i]);
                    }
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
                    ihtml += "<div class='ui-grid-b'>";
                    //ihtml += "<div class='ui-block-a'>" + tree.nodeID + "</div>";
                    //ihtml += "<div class='ui-block-b' deviceid='"+ nodeID.replace('.', '_') +"'>"+tree.value+"</div>";
                    ihtml += "<div class='device-name'>" + tree.nodeID + "</div>";
                    ihtml += "<div class='device-value' deviceid='"+ nodeID.replace('.', '_') +"'>"+tree.value+"</div>";
                    ihtml += '<div class="ui-block-c move-button"><a data-role="button" data-theme="e" data-inline="false" onclick="jogPanel(\''+nodeID+'\');" data-icon="gear" data-iconpos="left" >Move</a></div>';
                    ihtml += "</div>";
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
                        return dev.nodes[nodename].currentValue.val;
                    } else { 
                        return "";
                    }
                } else {
                    if (dev.primaryNodeID && dev.primaryNodeID != "") { 
                        return dev.nodes[dev.primaryNodeID].currentValue.val;  
                    } else {
                        return ""; 
                    }
                }
            }
            
            function setDeviceDisplayValue(dottedname, value) {
                $('div[deviceID|="'+dottedname.replace('.','_') +'"]').html(value.toString());
            }
            
            update_devices = function() {
                for (var i in shown_devices) {
                    var devname = i;
                    var val = shown_devices[i];
                    if (typeof(val) == "number") {
                        val = val.toFixed(4);
                    }
                    $('div[deviceID|="'+devname.replace('.','_') +'"]').html(val.toString());
                }
                
            }
            
            
            
            jogPanel = function(nodeID) {
                active_device = nodeID; // global 
                $('#jog_motor_name').html(nodeID.toString());
                $('#jog_motor_value').attr('deviceid', nodeID.replace('.','_'));
                update_devices();
                $('#motor_target').attr('value', $('#jog_motor_value').html());
                $('#popupJog').popup('open');
            }
            
            moveToTarget = function() {
                var destination = $('#motor_target')[0].value;
                Controller.emit('move', [active_device.toString(), destination.toString()], false);
            }
            jogUp = function() {
                var step = parseFloat($('#jog_step_value')[0].value);
                var current_destination = parseFloat($('#motor_target')[0].value);
                var new_destination = current_destination + step;
                $('#motor_target').attr('value', new_destination.toPrecision(4));
                // not doing relative move from NICE perspective - precalculating destination, so
                // 'relative' argument is false
                Controller.emit('move', [active_device.toString(), new_destination.toString()], false);
            }
            jogDown = function() {
                var step = -1.0 * parseFloat($('#jog_step_value')[0].value);
                var current_destination = parseFloat($('#motor_target')[0].value);
                var new_destination = current_destination + step;
                $('#motor_target').attr('value', new_destination.toPrecision(4));
                Controller.emit('move', [active_device.toString(), new_destination.toString()], false);
            }
            
            
            function connect() {
                var Instrument = jQuery.getUrlVar('instrument') ? jQuery.getUrlVar('instrument') : "BT4";
                $('#content').html('Loading...' + Instrument);
                var BaseURL = 'http://' + window.location.hostname + ':' + window.location.port;
                var Root = BaseURL + '/' +Instrument;
                document.title = Instrument + ' status';
                $('#instrument_header').html(Instrument);
                Devices = io.connect(Root + '/device', {
                    'connect timeout': 10000,
                    'transports': ['websocket', 'xhr-polling', 'htmlfile', 'jsonp-polling']
                });
                var server = io.connect(BaseURL);
                server.emit('controller', function(ControlHost) {
                    if (ControlHost) {
                        Controller = io.connect(ControlHost + '/' + Instrument + '/control', {
                            'connect timeout': 10000,
                            'transports': ['websocket', 'xhr-polling', 'htmlfile', 'jsonp-polling']
                        });
                        Controller.emit('isactive', function(response) {
                            controller_connected = (response == "active");
                            if (controller_connected) {
                                $('.move-button').show();
                            } else {
                                $('.move-button').hide();
                            }
                        });
                    }
                    // server.disconnect();
                });
                
                Devices.on('changed', function (nodes) {
                    for (var i=0; i < nodes.length; i++) {
                        var node = nodes[i];
                        //if (device_tree.hasOwnProperty(node.deviceID) && device_tree[node.deviceID].nodes.hasOwnProperty(node.nodeID)) {
                        //    device_tree[node.deviceID].nodes[node.nodeID] = node;
                        //}
                        if (shown_devices.hasOwnProperty(node.id)) {
                            var val = node.currentValue.val;
                            shown_devices[node.id] = val;
                            if (typeof(val) == "number") {
                                val = val.toFixed(4);
                            }
                            setDeviceDisplayValue(node.id, val);
                            
                            //$('#device_'+node.deviceID).html(node.currentValue.val.toString());
                        } 
                    }
                });
                Devices.emit('subscribe', false);
                Devices.emit('filled_device_hierarchy', function(structure){
                    //$.extend(device_tree, tree, false);
                    $.extend(device_hierarchy, structure, false);
                    $('#content').html(treeToHTML(device_hierarchy)).trigger('create');
                    //$('#content').trigger('create');
                    //shown_devices = getTreeDevices(device_hierarchy);
                    //update_devices();
                    if (controller_connected) $('.move-button').show();
                });
                
            }

    $(document).bind('pageinit', connect);
})();
