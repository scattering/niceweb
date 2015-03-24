function newContext(live_state) {
    // using the iframe trick
    // probably doesn't work under IE
    var iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    iframe.contentWindow.sandbox = function() {
        this.moving = {}; 
        this.inits = {};
        this.counters = {};
        this.metadata = {};
        this.eval = function(s) { 
            if (s.trim() == "") { return undefined } // catch the empty strings
            try { with(Math) with(this.moving) with(this.inits) with(this.counters) with(live_state) { return eval('('+s+')')} }
            catch(e) { console.log('Error: ' + e.toString()); console.log('string to parse: ', s); }
        }
        this.assign = function(k, v, namespace) {
            var parts = k.split('.');
            var basename = parts[0];
            if (parts.length > 1) {
                var remaining = k.slice(basename.length+1);
                if (!(basename in namespace)) {
                    namespace[basename] = new Object();
                }
                this.assign(remaining, v, namespace[basename]);
            } else {
                namespace[basename] = v;
            }
        }
        this.update = function(d) { parent.jQuery.extend(this.moving, d, true); };
        this.keys = function() { return Object.keys(this.moving); };
        this.destroy = function() { parent.jQuery(window).empty(); parent.jQuery(window).remove();}
        this.getTimeEstimate = function() { 
            var countAgainst = this.eval('counter.countAgainst');
            if (countAgainst == "'TIME'") { return this.eval('counter.timePreset'); }
            else if (countAgainst == "'MONITOR'") { return 1.0 / parseFloat(this.eval('counter.monitorPreset')); }
            else return null
        }
    }
    var sandbox = new iframe.contentWindow.sandbox();
    //var sandbox = iframe.contentWindow.newSandbox();
    sandbox.iframe = iframe; // handle so it can be deleted later
    iframe = null;
    return sandbox;
    //"var MSIE/*@cc_on =1@*/;"+ // sniff
    //"parent.sandbox=MSIE?this:{eval:function(s){return eval(s)}}"+
}

function type (object) {
    if (object === null) {
        return 'null';
    }
    if (object === undefined) {
        return 'undefined';
    }
    if ((object instanceof Number) || (typeof object === 'number')) {
        return 'number';
    }
    if ((object instanceof String) || (typeof object === 'string')) {
        return 'string';
    }
    if ((object instanceof Boolean) || (typeof object === 'boolean')) {
        return 'boolean';
    }
    if ((object instanceof RegExp) || (typeof object === 'regexp')) {
        return 'regexp';
    }
    if (Array.isArray(object)) {
        return 'array';
    }

    return 'object';
};

function dottedToObj(k,v) {
    var parts = k.split('.');
    var num = parts.length;
    var k_out = parts[0];
    var obj = {};
    obj[parts[num-1]] = v;
    var newobj;
    for (var i=num-2; i>0; i--) {
        newobj = new Object();
        newobj[parts[i]] = obj;
        obj = newobj;
    }
    return {k: k_out, v:obj}
}

function expandDevices(traj) {
    // make sure bare device names are expanded to device.primaryNodeID before dry run
    if (traj.init && traj.init.forEach) {
        traj.init.forEach( function(item) { 
            var lhs = item[0];
            var val = item[1];
            var dottednames = lhs.split('.');
            if (dottednames.length == 1 && dottednames[0] in devicesMonitor.devices && type(val) != 'object') {
                // detects when setting a bare devicename: substitute
                // the primary node for the namespace
                var basename = dottednames[0];
                item[0] = devicesMonitor.devices[basename].primaryNodeID;
            }
        });
    }
    if (traj.loops && traj.loops.forEach) {
        expandDevicesLoops(traj.loops);
    }
    return traj;
}

function expandDevicesLoops(loops){
   loops.forEach( function(loop, index, array) {
        if (loop.vary && loop.vary.length > 0) {               
            loop.vary.forEach( function(item) { 
                var lhs = item[0];
                var val = item[1];
                var dottednames = lhs.split('.');
                // the check is a little harder, because we have to exclude 'range' and 'list' items:
                if (dottednames.length == 1 && 
                    dottednames[0] in devicesMonitor.devices && 
                        (type(val) != 'object' ||
                         (type(val) ==  'object' && (val.range || val.list)))) {
                    // detects when setting a bare devicename: substitute
                    // the primary node for the namespace
                    var basename = dottednames[0];
                    item[0] = devicesMonitor.devices[basename].primaryNodeID;
                }
            });
        }
        if (loop.loops) { 
            expandDevicesLoops(loops);
        }
    });
}


function parseInitItem(item) {
    var expression_str='';
    var lhs = item[0];
    var val = item[1];
    var dottednames = lhs.split('.');
    if (dottednames.length == 1 && dottednames[0] in devicesMonitor.devices && type(val) != 'object') {
        // detects when setting a bare devicename: substitute
        // the primary node for the namespace
        var basename = dottednames[0];
        lhs = devicesMonitor.devices[basename].primaryNodeID;
        
    }
    return {lhs: lhs, expression: JSON.stringify(val)}
    //else if (Array.isArray(val)) {
    //    expression_str = '['+val.toString() + ']';
    //}
    //else if (typeof val === 'string') {
    //    expression_str = val;
    //}
    //return {lhs: lhs, numPoints: numPoints, expression: expression_str}
}

var range_fill = function(params) {
    // params is an object containing keys from 
    // ["start", "stop", "step", "range", "center", "numPoints"]
    // 
    // It must contain: 
    // one of ["step", "numPoints"] and two of ["start", "stop", "center", "range"], 
    // or 
    // both "step" and "numPoints" and one of ["start", "stop", "center"]
    
    var params = $.extend(true, {}, params); // local copy
    
    if (!('step' in params || 'numPoints' in params)) {
        throw "need one or both of 'step' or 'numPoints'";
    }
    if ('step' in params && 'numPoints' in params) {
        params.range = (params.step * (params.numPoints - 1));
    }
    var posparams = ['start', 'stop', 'center', 'range'];
    var ppsum = 0;
    $.each(params, function(p, v) { ppsum += (posparams.indexOf(p) > -1) ? 1 : 0; });
    if (ppsum != 2) { throw "need two params from " + JSON.stringify(posparams); }
    
    // fill in the gaps
    if ('start' in params && 'stop' in params) { 
        params.range = params.stop - params.start;
        params.center = (params.stop + params.start) / 2.0
    }
    else if ('start' in params && 'center' in params) { 
        params.range = (params.center - params.start) * 2.0;
        params.stop = params.start + params.range;
    }
    else if ('start' in params && 'range' in params) {
        params.stop = params.start + params.range;
        params.center = (params.start + params.stop) / 2.0;
    }
    else if ('stop' in params && 'center' in params) {
        params.range = (params.stop - params.center) * 2.0;
        params.start = params.stop - params.range;
    }
    else if ('stop' in params && 'range' in params) {
        params.start = params.stop - params.range;
        params.center = (params.start + params.stop) / 2.0;
    }
    else if ('center' in params && 'range' in params) {
        params.start = params.center - (params.range / 2.0);
        params.stop = params.start + params.range;
    }
    else { throw "should never happen: logic error" }
    
    if (!('step' in params && 'numPoints' in params)) {
        // fill in missing one:
        if ('step' in params) { 
            params.numPoints = (params.range / parseFloat(params.step)) + 1 
        }
        else { // 'step' is missing
            params.step = params.range / (params.numPoints - 1);
        }
    }
    return params;
}

function parseVaryItem(item, counter_str) {
    var numPoints=0, expression_str='';
    var lhs = item[0];
    var val = item[1];
    if (val.hasOwnProperty('range')) {
        var range = val.range;
        var filled_range;
        try {
            filled_range = range_fill(range);
            numPoints = filled_range.numPoints;
            expression_str = filled_range.start.toString() + " + " + filled_range.step.toString() + "*" + counter_str;
        } 
        catch(err) {
            alert(err);
        }
    }
    else if (val.hasOwnProperty('list')) {
        var list = val.list;
        numPoints = list.value.length;
        if (list.hasOwnProperty('cyclic') && list.cyclic == true) {
            expression_str = '['+list.value.toString() + '][' + counter_str + ' % ' + numPoints + ']';
        } else {
            expression_str = '['+list.value.toString() + '][Math.min(' + counter_str + ', ' + numPoints + '-1)]';
        }
    }
    else if (Array.isArray(val)) {
        numPoints = val.length;
        expression_str = '['+val.toString() + '][Math.min(' + counter_str + ', ' + numPoints + '-1)]';
    }
    else if (typeof val === 'string' || typeof val === 'number') {
        numPoints = 0;
        expression_str = val;
    }
    else if (typeof val === 'object') {
        var output = [], k;
        for (k in val) {
            output = output.concat(parseVaryItem([lhs+'.'+k, val[k]], counter_str));
            //console.log(lhs+'.'+k, val[k], parseVaryItem([lhs+'.'+k, val[k]], counter_str));
        }
        return output;
        //expression_str = '';
        //for (var k in val) {
        //    expression_str += 
        //}
        //expression_str = JSON.stringify(val);
    }
    return [{lhs: lhs, numPoints: numPoints, expression: expression_str}]
}

function calcNumPoints(start, step, stop, numPoints) {
    if (step == 0) {return 1}
    else { return Math.floor( (stop - start) / step ) + 1 }
}

function dryRun(traj, context) {
    var context = context == null? newContext() : context;
    var pointNum = [0];
    var metadata = {
        // default values for metadata;
        'descr': '',
        'alwaysWrite': [],
        'neverWrite': [],
        '_fileGroup': "''",
        '_filePrefix': "trajName",
        '_fileName': "sprintf('%s%d',filePrefix,fileNum)",
        'entryName': "''",
        '_groups': []
    };
    var counter_str = '__counter';
    var numpoints_str = '__numPoints';
    var targetlist = new Array();
    var init_items = new Array();
    var names = new Array();
    for (var key in traj) { 
        if (key in metadata) {
            metadata[key] = traj[key];
        }        
    }
    if (traj.init && traj.init.forEach) {
        traj.init.forEach( function(item) { 
            var parsed = parseInitItem(item);
            context.assign(parsed.lhs, context.eval(parsed.expression), context.inits);
            //context.inits[parsed.lhs] = context.eval(parsed.expression);
        });
    }
    
    result = loopsRun(traj.loops, pointNum, context, counter_str, numpoints_str, targetlist, metadata.entryName);
    return result
    
}

function fastTimeEstimate(traj, context) {
    // can only work if counter.countAgainst is 'MONITOR' or 'TIME', 
    // and if 'MONITOR' requires the monitorRateEstimation formula.
    var context = context == null? newContext() : context;
    var pointNum = [0];
    var metadata = {
        // default values for metadata;
        'descr': '',
        'alwaysWrite': [],
        'neverWrite': [],
        '_fileGroup': "''",
        '_filePrefix': "trajName",
        '_fileName': "sprintf('%s%d',filePrefix,fileNum)",
        'entryName': "''",
        '_groups': []
    };
    var counter_str = '__counter';
    var numpoints_str = '__numPoints';
    var targetlist = new Array();
    var init_items = new Array();
    var timelist = new Array();
    var names = new Array();
    for (var key in traj) { 
        if (key in metadata) {
            metadata[key] = traj[key];
        }        
    }
    // make sure there is at least the currently-defined count information in the context:
    context.inits['counter'] = {
        "countAgainst": context.eval('live.counter.countAgainst'),
        "timePreset": context.eval('live.counter.timePreset'),
        "monitorPreset": context.eval('live.counter.monitorPreset')
    }
    
    if (traj.init && traj.init.forEach) {
        traj.init.forEach( function(item) { 
            var parsed = parseInitItem(item);
            context.assign(parsed.lhs, context.eval(parsed.expression), context.inits);
            //context.inits[parsed.lhs] = context.eval(parsed.expression);
        });
    }
    
    result = loopsRunWithTimeEstimate(traj.loops, pointNum, context, counter_str, numpoints_str, targetlist, metadata.entryName, timelist);
    var totalTime = 0;
    for (var i=0; i<timelist.length; i++) {
        totalTime += timelist[i];
    }
    return totalTime
    
}

function loopsRun(loops, depth, context, counterstring, npstring, targetlist, entry_expr) {
    loops.forEach( function(loop, index, array) {
        if (loop.vary && loop.vary.length > 0) {               
            var cstr = counterstring + '_' + index.toString();
            var nstr = npstring + '_' + index.toString();
            var items = [];
            loop.vary.forEach( function(item) { items = items.concat(parseVaryItem(item, cstr)); });
            //context.assign(nstr, items[0].numPoints)
            context.counters[nstr] = items[0].numPoints;
            for (context.counters[cstr] = 0; context.counters[cstr] < context.counters[nstr]; context.counters[cstr]++) {
                items.forEach( function(item) {
                    //context.moving[item.lhs] = context.eval(item.expression);
                    //console.log(item.lhs, context.eval(item.expression));
                    context.assign(item.lhs, context.eval(item.expression), context.moving);
                });
                if (loop.loops) { loopsRun(loop.loops, depth, context, cstr, nstr, targetlist, entry_expr); }
                else {
                    var entry_str = context.eval(entry_expr);
                    // make a copy:
                    var target_item = $.extend(true, {}, context.moving);  
                    // = JSON.parse(JSON.stringify(context.moving));
                    target_item['entry'] = entry_str;
                    //targetlist.push(JSON.parse(JSON.stringify(context.moving)));
                    targetlist.push(target_item);
                    depth[0]++;
                }
            } 
        }
    });
    return {targetlist: targetlist, names: context.keys()};
}

function loopsRunWithTimeEstimate(loops, depth, context, counterstring, npstring, targetlist, entry_expr, timelist) {
    loops.forEach( function(loop, index, array) {
        if (loop.vary && loop.vary.length > 0) {               
            var cstr = counterstring + '_' + index.toString();
            var nstr = npstring + '_' + index.toString();
            var items = [];
            loop.vary.forEach( function(item) { items = items.concat(parseVaryItem(item, cstr)); });
            //context.assign(nstr, items[0].numPoints)
            context.counters[nstr] = items[0].numPoints;
            for (context.counters[cstr] = 0; context.counters[cstr] < context.counters[nstr]; context.counters[cstr]++) {
                items.forEach( function(item) {
                    //context.moving[item.lhs] = context.eval(item.expression);
                    //console.log(item.lhs, context.eval(item.expression));
                    context.assign(item.lhs, context.eval(item.expression), context.moving);
                });
                if (loop.loops) { loopsRun(loop.loops, depth, context, cstr, nstr, targetlist, entry_expr, timelist); }
                else {
                    var entry_str = context.eval(entry_expr);
                    var time_estimate = context.getTimeEstimate();
                    timelist.push(time_estimate);
                    // make a copy:
                    var target_item = $.extend(true, {}, context.moving);
                    // = JSON.parse(JSON.stringify(context.moving));
                    target_item['entry'] = entry_str;
                    //targetlist.push(JSON.parse(JSON.stringify(context.moving)));
                    targetlist.push(target_item);
                    depth[0]++;
                }
            } 
        }
    });
    return {targetlist: targetlist, names: context.keys(), timelist: timelist};
}


show_dry_run = function(traj, live_state) {
    var dry = dryRun(traj, newContext(live_state));
    display_dry_run(dry);
}


function make_getter(value) {
    var output_value;
    if (typeof value != 'object') {
        output_value = value;
    }
    else if (value instanceof Ice.EnumBase) {
        output_value = "'" + value._name + "'";
    }
    else if (value.toNumber) {
        // for Ice.Long type
        output_value = value.toNumber();
    }
    var f = function() { return output_value }
    return f
}

get_live_state = function(php_bridge_host, instrument) {
    var live = {};
    var device_ids = Object.keys(devicesMonitor.devices);
    for (var i=0; i<device_ids.length; i++) {
        var device_id = device_ids[i];
        //console.log(device_id);
        var device_proxy = {};
        var device = devicesMonitor.devices[device_id];
        if ('primaryNodeID' in device && device.primaryNodeID) {
            //console.log(device.primaryNodeID, devicesMonitor.nodes[device.primaryNodeID]);
            var value = devicesMonitor.nodes[device.primaryNodeID].currentValue.userVal.val;
            device_proxy = {
                valueOf: make_getter(value)
            }
        }
        if ('visibleNodeIDs' in device) {
            for (var j=0; j<device.visibleNodeIDs.length; j++) {
                var node_id = device.visibleNodeIDs[j];
                var node_name = node_id.split('.')[1];
                //console.log(node_name);
                var node = devicesMonitor.nodes[node_id];
                if (node.currentValue && node.currentValue.userVal) {
                    var value = node.currentValue.userVal.val;
                    Object.defineProperty(device_proxy, node_name, {get: make_getter(value)});
                } else if (node.desiredValue && node.desiredValue.userVal) {
                    var value = node.desiredValue.userVal.val;
                    Object.defineProperty(device_proxy, node_name, {get: make_getter(value)});
                }
            }
        }
        live[device_id] = device_proxy;
    }
    return {live: live}
}

display_dry_run = function(dry) {
    //var traj_obj = editor.getValue();
    //var dry = dryRun(traj);
    var k, v, item;
    scriptwin = window.open("", "_blank");
    scriptwin.document.title = "Dry run: ";
    var css = scriptwin.document.createElement("style");
    css.type = "text/css";
    csstext = ".ui-state-default { border: 1px solid #d3d3d3; font-family: Arial, sans; background: #e6e6e6; font-weight: normal; color: #555555; }\n";
    csstext += ".ui-widget-content {border: 1px solid #aaaaaa; font-family: Arial, sans; background: #ffffff; color: #222222; }\n";
    css.innerHTML = csstext;
    scriptwin.document.body.appendChild(css);
    var table = scriptwin.document.createElement('table');
    table.border = "1px";
    scriptwin.document.body.appendChild(table);
    var headers = scriptwin.document.createElement('tr');
    var header;
    var header = scriptwin.document.createElement('th');
    header.textContent = 'pointNum';
    header.classList.add('ui-state-default');
    headers.appendChild(header);
    for (var i=0; i<dry.names.length; i++) {
        header = scriptwin.document.createElement('th');
        header.textContent = dry.names[i];
        header.classList.add('ui-state-default');
        headers.appendChild(header);}
    header = scriptwin.document.createElement('th');
    header.textContent = "entryName";
    header.classList.add('ui-state-default');
    headers.appendChild(header);
    table.appendChild(headers);
    var row, point, entry, item;
    for (var j=0; j<dry.targetlist.length; j++) {
        row = scriptwin.document.createElement('tr');
        item = scriptwin.document.createElement('td');
        item.textContent = (j+1).toString();
        row.appendChild(item);
        point = dry.targetlist[j];
        for (var i=0; i<dry.names.length; i++) {
            var item = scriptwin.document.createElement('td');
            entry = point[dry.names[i]];
            item.textContent = JSON.stringify(entry);
            item.classList.add('ui-widget-content');
            row.appendChild(item);
        }
        item = scriptwin.document.createElement('td');
        item.textContent = point['entry'];
        item.classList.add('ui-widget-content');
        row.appendChild(item);
        table.appendChild(row);
    }       
}
