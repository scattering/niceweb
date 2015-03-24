sandbox = function() {
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

function fastTimeEstimate(traj, context) {
    // can only work if counter.countAgainst is 'MONITOR' or 'TIME', 
    // and if 'MONITOR' requires the monitorRateEstimation formula.
    var context = context == null? new sandbox() : context;
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
            context.assign(item[0], context.eval(JSON.stringify(item[1])), context.inits);
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

onmessage = function(event) {
    var data = event.data;
    var live_state = data.live_state;
    var traj = data.traj;
    var context = new sandbox();
    var t = fastTimeEstimate(traj, context);
    postMessage({time: t});
    delete context;
    return
}
