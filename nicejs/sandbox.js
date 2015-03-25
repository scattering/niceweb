//importScripts('jquery-1.11.1.min.js');

sandbox = function(live_state) {
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
    Object.keys(params).forEach(function(p, v) { ppsum += (posparams.indexOf(p) > -1) ? 1 : 0; });
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
            console.log('error in parseVary: ', err);
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
                    context.assign(item.lhs, context.eval(JSON.stringify(item.expression)), context.moving);
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
                    context.assign(item.lhs, context.eval(JSON.stringify(item.expression)), context.moving);
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

function extend() {
  var options, name, src, copy, copyIsArray, clone, target = arguments[0] || {},
    i = 1,
    length = arguments.length,
    deep = false,
    toString = Object.prototype.toString,
    hasOwn = Object.prototype.hasOwnProperty,
    push = Array.prototype.push,
    slice = Array.prototype.slice,
    trim = String.prototype.trim,
    indexOf = Array.prototype.indexOf,
    class2type = {
      "[object Boolean]": "boolean",
      "[object Number]": "number",
      "[object String]": "string",
      "[object Function]": "function",
      "[object Array]": "array",
      "[object Date]": "date",
      "[object RegExp]": "regexp",
      "[object Object]": "object"
    },
    jQuery = {
      isFunction: function (obj) {
        return jQuery.type(obj) === "function"
      },
      isArray: Array.isArray ||
      function (obj) {
        return jQuery.type(obj) === "array"
      },
      isWindow: function (obj) {
        return obj != null && obj == obj.window
      },
      isNumeric: function (obj) {
        return !isNaN(parseFloat(obj)) && isFinite(obj)
      },
      type: function (obj) {
        return obj == null ? String(obj) : class2type[toString.call(obj)] || "object"
      },
      isPlainObject: function (obj) {
        if (!obj || jQuery.type(obj) !== "object" || obj.nodeType) {
          return false
        }
        try {
          if (obj.constructor && !hasOwn.call(obj, "constructor") && !hasOwn.call(obj.constructor.prototype, "isPrototypeOf")) {
            return false
          }
        } catch (e) {
          return false
        }
        var key;
        for (key in obj) {}
        return key === undefined || hasOwn.call(obj, key)
      }
    };
  if (typeof target === "boolean") {
    deep = target;
    target = arguments[1] || {};
    i = 2;
  }
  if (typeof target !== "object" && !jQuery.isFunction(target)) {
    target = {}
  }
  if (length === i) {
    target = this;
    --i;
  }
  for (i; i < length; i++) {
    if ((options = arguments[i]) != null) {
      for (name in options) {
        src = target[name];
        copy = options[name];
        if (target === copy) {
          continue
        }
        if (deep && copy && (jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)))) {
          if (copyIsArray) {
            copyIsArray = false;
            clone = src && jQuery.isArray(src) ? src : []
          } else {
            clone = src && jQuery.isPlainObject(src) ? src : {};
          }
          // WARNING: RECURSION
          target[name] = extend(deep, clone, copy);
        } else if (copy !== undefined) {
          target[name] = copy;
        }
      }
    }
  }
  return target;
}

$ = {extend: extend}

onmessage = function(event) {
    var data = event.data;
    var live_state = data.live_state;
    var traj = data.traj;
    var context = new sandbox(live_state);
    var t = fastTimeEstimate(traj, context);
    postMessage({time: t});
    delete context;
    return
}
