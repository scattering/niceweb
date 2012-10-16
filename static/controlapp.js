(function (){
            // socket.io connections are globals
            Devices = null;
            Controller = null;
            active_device = null; // for moving motors in jog panel
            shown_devices= null;
            update_devices = null;

            // shared state
            device_tree = {};
            device_hierarchy = {};
            shown_devices = [];
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
                    var nodeID;
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
                    ihtml += "<div class='ui-grid-b'>";
                    ihtml += "<div class='ui-block-a'>" + tree.nodeID + "</div><div class='ui-block-b' deviceid='"+ nodeID.replace('.', '_') +"'></div>";
                    ihtml += '<div class="ui-block-c move-button"><a data-role="button" data-theme="e" data-inline="false" data-transition="slide" onclick="jogPanel(\''+nodeID+'\');" data-icon="gear" data-iconpos="left" >Move</a></div>';
                    ihtml += "</div>";
                    shown_devices.push(nodeID);
                }
                return ihtml
            }
                  
            
            /*
            function treeToHTML(tree, ihtml) {
                var ihtml = ihtml ? ihtml : "";
                var elements = tree.children.elements;
                if (elements.length > 0) {
                    ihtml += "<div data-role='collapsible-set'>";
                    for (var i in elements) {                        
                        var el = elements[i];
                        if (el.children.elementClass == 'java.lang.Object') {
                            //ihtml += "<h4>" + el.nodeID + ": <span id='device_" + el.nodeID + "'></span></h4>";
                            split_name = el.nodeID.split('.');
                            var devname = split_name[0];
                            var nodeID;
                            if (split_name.length > 1) {
                                // then we have a node ID
                                nodeID = el.nodeID;
                            } else {
                                // we have a device name, look up the primary node ID
                                var device = device_tree[el.nodeID];
                                nodeID = device.nodes[device.primaryNodeID].id;
                            }
                            //ihtml += "<
                            ihtml += "<div class='ui-grid-b'>";
                            ihtml += "<div class='ui-block-a'>" + el.nodeID + "</div><div class='ui-block-b' id='device_"+ nodeID.replace('.', '_') +"'></div>";
                            ihtml += '<div class="ui-block-c"><a data-role="button" data-inline="false" data-transition="slide" href="jog.html" data-icon="gear" data-iconpos="left" >Move</a></div>';
                            ihtml += "</div>";
                            shown_devices.push(nodeID);
                        } 
                        else {
                            ihtml += "<div data-role='collapsible'>";
                            ihtml += '<h3>' + el.nodeID + "</h3>";
                            ihtml += treeToHTML(el);
                            ihtml += "</div>\n";
                        }
                    }
                    ihtml += "</div>";
                }
                return ihtml
            }
            */
            
            /*
            function getTreeDevices(tree, device_list) {
                var device_list = device_list ? device_list : [];
                var elements = tree.children.elements;
                if (elements.length > 0) {
                    for (var i in elements) {
                        var el = elements[i];
                        if (el.children.elementClass == 'java.lang.Object') {
                            device_list.push(el.nodeID);
                        }
                        else { 
                            device_list = device_list.concat(getTreeDevices(el));
                        }
                    }
                }
                return device_list
            }
            */
            
            //function getDeviceByDottedName(dottedname) {
            //    subnames = dottedname.split('.');
            //    if (!(device_tree.hasOwnProperty(subnames[0]))) { return null }
            //    var dev = device_tree[subnames[0]];
            //    for (var i=1; i<subnames.length; i++) {
            //        if (!(dev.nodes.hasOwnProperty(subnames[i]))) { return null }
            //        dev = dev.nodes[subnames[i]];
            //    }
            //    return dev      
            //}
            
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
                //console.log('setting ', dottedname, 'to', value);
                var names = dottedname.split('.', 2);
                var devname = names[0]; 
                if (!(device_tree.hasOwnProperty(devname))) { return }
                var dev = device_tree[devname];
                if (names.length == 2) {
                    var nodename = names[1];
                    if (dev.primaryNodeID && nodename == dev.primaryNodeID) {
                        $('div[deviceID|="'+dottedname.replace('.','_') +'"]').html(value.toString());
                    }
                } else { // only device name provided, so update display
                    if (dev.primaryNodeID && dev.primaryNodeID != "") { 
                        $('div[deviceID|="'+devname.replace('.','_') +'"]').html(value.toString());
                    }
                }
            }
            
            update_devices = function() {
                for (var i in shown_devices) {
                    var devname = shown_devices[i];
                    var val = getInitialDeviceValue(devname);
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
            
            jogUp = function() {
                var step = parseFloat($('#jog_step_value')[0].value);
                Controller.emit('move', [active_device.toString(), step.toString()], true);
            }
            jogDown = function() {
                var step = -1.0 * parseFloat($('#jog_step_value')[0].value);
                Controller.emit('move', [active_device.toString(), step.toString()], true);
            }
            moveToTarget = function() {
                var destination = $('#motor_target')[0].value;
                Controller.emit('move', [active_device.toString(), destination.toString()], false);
            }
            
            function connect() {
                var Instrument = jQuery.getUrlVar('instrument') ? jQuery.getUrlVar('instrument') : "BT4";
                $('#content').html('Loading...' + Instrument);
                var BaseURL = 'http://' + window.location.hostname + ':' + window.location.port;
                var Root = BaseURL + '/' +Instrument;
                document.title = Instrument + ' status';
                $('#instrument_header').html(Instrument);
             setTimeout(function(){  // give "Loading...instrument" time to render 
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
                        if (device_tree.hasOwnProperty(node.deviceID) && device_tree[node.deviceID].nodes.hasOwnProperty(node.nodeID)) {
                            device_tree[node.deviceID].nodes[node.nodeID] = node;
                        }
                        if (shown_devices.indexOf(node.id) >=0) {
                            var val = node.currentValue.val;
                            if (typeof(val) == "number") {
                                val = val.toFixed(4);
                            }
                            setDeviceDisplayValue(node.id, val);
                            
                            //$('#device_'+node.deviceID).html(node.currentValue.val.toString());
                        } 
                    }
                });
                Devices.emit('subscribe', function(tree, structure) {
                    $.extend(device_tree, tree, false);
                    $.extend(device_hierarchy, structure, false);
                    $('#content').html(treeToHTML(device_hierarchy)).trigger('create');
                    //$('#content').trigger('create');
                    //shown_devices = getTreeDevices(device_hierarchy);
                    update_devices();
                    if (controller_connected) $('.move-button').show();
                });
             },50);
                
                
                //$('#page1').html(treeToHTML(device_hierarchy));
    }

    $(document).ready(connect);
})();
