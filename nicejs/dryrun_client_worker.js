__sandbox = function() {
    // live_state, monitorEstimateExpression, primaryNodesMap
    this.live_state = arguments[0];
    this.monitorEstimateExpression = arguments[1];
    this.primaryNodesMap = arguments[2];
    this.moving = {}; 
    this.inits = {};

    // counters have a special key name
    this.counters = {};
    this.metadata = {};
    
    this.eval = function(s) {
        if (typeof s == 'function') {
            return s(this); 
        } else {
        if (s.trim && s.trim() == "") { return undefined } // catch the empty strings
        try { with(Math) with(this.live_state) with(this.counters) with(this.moving) { return eval('('+s+')')} }
        catch(e) { console.log('Error: ' + e.toString()); console.log('string to parse: ', s); }
        }
    }
    // making only one namespace: moving
    this.assignFuncs = {};
    this.assign = function(k, v) {
        // make a cached function to assign values for each key
        // the first time the key is encountered...
        if (!(k in this.assignFuncs)){
            this.assignFuncs[k] = this.makeAssignFunc(k);
        }
        this.assignFuncs[k](v);
    };
    this.makeAssignFunc = function(k, namespace) {
        var namespace = (namespace == null) ? this.moving : namespace;
        var parts = k.split('.');
        var basename = parts[0];
        var target_key = basename;
        var target_obj = namespace;
        if (!(basename in namespace)) {
            namespace[basename] = new Object();
            if (basename in this.primaryNodesMap) {
                // if the name is a device name with a primary node, then make it 
                // automatically access the underlying primary node whenever it is get 
                // or set
                var primaryNodeID = this.primaryNodesMap[basename];
                namespace[basename].valueOf = function() { return this[primaryNodeID] }
                if (parts.length == 1) {
                    // then it's a bare device name: the assign function should set the primary node;
                    var assignFunc = function(v) {
                        namespace[basename][primaryNodeID] = v;
                    }
                    return assignFunc;
                }
            }
        }
        if (parts.length > 1) {
            target_obj = namespace[basename];
            var i=1;
            for (i=1; i<parts.length-1; i++) {
                var next_part = parts[i];
                target_obj[next_part] = {};
                target_obj = target_obj[next_part];
            }
            target_key = parts[i];
        }
        var assignFunc = function(v) { 
            target_obj[target_key] = v;
        }
        return assignFunc;
    }
    this.keys = function() { return Object.keys(this.moving); };
    this.destroy = function() { parent.jQuery(window).empty(); parent.jQuery(window).remove();}
    this.getTimeEstimate = function() {
        with(this.inits) with(this.moving) {
            var countAgainst = counter.countAgainst;
            if (countAgainst == "'TIME'" || countAgainst == "TIME") { 
                return counter.timePreset
            } else if (countAgainst == "'MONITOR'" || countAgainst == "MONITOR") { 
                var monitorRate = this.monitorEstimateExpression(this);
                var preset = counter.monitorPreset;
                //var preset = this.eval(counter.monitorPreset);
                return parseFloat(preset) / monitorRate;
                //return 1.0 / parseFloat(counter.monitorPreset); 
            }
            else { return null }
        }
    }
}

onmessage = function(event) {
    //console.log(event);
    var data = event.data;
    eval('var monitorEstimateExpressionFunc = function(namespace) { with(Math) with(namespace.live_state.live) with(namespace.moving) with(namespace.counters) return (' + data.monitorExpressionStr + ')};');
    var context = new __sandbox(data.live_state, monitorEstimateExpressionFunc, data.primaryNodeIDMap);
    var result = __fastTimeEstimate(data.traj, context);
    result.path = event.data.path;
    result.filename = event.data.filename;
    postMessage(result);
    return;
}

// closure to keep helper functions out of namespace:
var __fastTimeEstimate = (function() {

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

    
    function parseInitItem(item) {
        var expression_str='';
        var lhs = item[0];
        var val = item[1];
        var dottednames = lhs.split('.');
        return {lhs: lhs, expression: JSON.stringify(val)}
    }

    

    function range_fill(params) {
        // params is an object containing keys from 
        // ["start", "stop", "step", "range", "center", "numPoints"]
        // 
        // It must contain: 
        // one of ["step", "numPoints"] and two of ["start", "stop", "center", "range"], 
        // or 
        // both "step" and "numPoints" and one of ["start", "stop", "center"]
        
        var params = extend(true, {}, params); // local copy
        
        if (!('step' in params || 'numPoints' in params)) {
            throw "need one or both of 'step' or 'numPoints'";
        }
        if ('step' in params && 'numPoints' in params) {
            params.range = (params.step * (params.numPoints - 1));
        }
        var posparams = ['start', 'stop', 'center', 'range'];
        var ppsum = 0;
        var pkeys = Object.keys(params);
        pkeys.forEach(function(p, v) { ppsum += (posparams.indexOf(p) > -1) ? 1 : 0; });
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
                var step = parseFloat(params.step);
                params.numPoints = (step == 0) ? 1 : (params.range /step) + 1;
            }
            else { // 'step' is missing
                params.step = params.range / (params.numPoints - 1);
            }
        }
        return params;
    }

    function eval_range(range, context) {
        var output = {}
        for (var item in range) {
            output[item] = context.eval(range[item]);
        }
        return output;
    }

    function parseVaryItemF(item, counter_str, context) {
        var numPoints=0, expression_str='';
        var lhs = item[0];
        var val = item[1];
        if (val.hasOwnProperty('range')) {
            var range = val.range;
            var evaluated_range, filled_range, range_start, range_step;
            evaluated_range = eval_range(range, context);
            try {
                filled_range = range_fill(evaluated_range);
                range_start = filled_range.start;
                range_step = filled_range.step;
                numPoints = filled_range.numPoints;
                //expression_str = function(counters) { return range_start + (range_step * counters[counter_str]) }
                expression_str = filled_range.start.toString() + " + " + filled_range.step.toString() + "*" + counter_str; 
            } 
            catch(err) {
                console.log('error in parseVaryItemF:', err);
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
        else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
            numPoints = 0;
            expression_str = val;
        }
        else if (typeof val === 'object') {
            var output = [], k;
            for (k in val) {
                output = output.concat(parseVaryItemF([lhs+'.'+k, val[k]], counter_str));
                //console.log(lhs+'.'+k, val[k], parseVaryItem([lhs+'.'+k, val[k]], counter_str));
            }
            return output;
        }
        eval('var expression_func = function(namespace) { with(Math) with(namespace.live_state) with(namespace.moving) with(namespace.counters) return (' + expression_str + ')};');
        return [{lhs: lhs, numPoints: numPoints, expression: expression_func}];
    }
    
    // this is the only function that is exposed:
    function fastTimeEstimate(traj, context) {
        // can only work if counter.countAgainst is 'MONITOR' or 'TIME', 
        // and if 'MONITOR' requires the monitorEstimateExpression formula.
        //
        // an example for reflectometers is this:
        // monitorEstimateExpression = '(slitAperture1.softPosition / 1000.0) / 198000'
        // where 198000 is the persistent_config value 'estimatedMonitorRate', and is 
        // in units of monitorRate / slitAperture1 (in meters), while slitAperture1 is in mm
        // in user units (hence the factor of 1000.0 in the formula)
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
            'entryName': "'entry'",
            '_groups': []
        };
        var counter_str = '__counter';
        var numpoints_str = '__numPoints';
        var targetlist = new Array();
        var init_items = new Array();
        var timelist = new Array();
        var names = new Array();
        for (var key in traj) { 
            if (key in metadata && (traj[key] != "")) {
                metadata[key] = traj[key];
            }        
        }
        // make sure there is at least the currently-defined count information in the context:
        context.assign('counter.countAgainst', context.eval('live.counter.countAgainst'), context.moving);
        context.assign('counter.timePreset', context.eval('live.counter.timePreset'), context.moving);
        context.assign('counter.monitorPreset', context.eval('live.counter.monitorPreset'), context.moving);
        
        // eval('var monitorEstimateExpressionFunc = function(namespace) { with(Math) with(namespace.live_state.live) with(namespace.moving) with(namespace.counters) return (' + expression_str + ')};');
        var items = [], cstr = '__initctr';
        if (traj.init && traj.init.forEach) {
            traj.init.forEach( function(item) { 
                //var parsed = parseInitItem(item);
                items = items.concat(parseVaryItemF(item, cstr, context));
                //var parsed = parseVaryItemF(item, '__initctr', context);
                //console.log(parsed);
                //context.assign(parsed.lhs, context.eval(parsed.expression), context.moving);
                //context.inits[parsed.lhs] = context.eval(parsed.expression);
            });
        }
        items.forEach( function(item) {
            context.assign(item.lhs, context.eval(item.expression), context.moving);
        });
        
        result = loopsRunWithTimeEstimate(traj.loops, pointNum, context, counter_str, numpoints_str, targetlist, metadata.entryName, timelist);
        var totalTime = 0;
        for (var i=0; i<timelist.length; i++) {
            totalTime += timelist[i];
        }

        return {totalTime: totalTime, numPoints: pointNum[0]}
        
    }


    function loopsRunWithTimeEstimate(loops, depth, context, counterstring, npstring, targetlist, entry_expr, timelist) {
        eval('var entry_func = function(namespace) { with(Math) with(namespace.live_state) with(namespace.counters) with(namespace.moving) return (' + entry_expr + ')};');
        //eval ('var entry_func = function(counters) { return ' + entry_expr + ' }');
        loops.forEach( function(loop, index, array) {
            if (loop.vary && loop.vary.length > 0) {               
                var cstr = counterstring + '_' + index.toString();
                var nstr = npstring + '_' + index.toString();
                var items = [];
                loop.vary.forEach( function(item) { items = items.concat(parseVaryItemF(item, cstr, context)); });
                //context.assign(nstr, items[0].numPoints)
                context.counters[nstr] = items[0].numPoints;
                for (context.counters[cstr] = 0; context.counters[cstr] < context.counters[nstr]; context.counters[cstr]++) {
                    items.forEach( function(item) {
                        //context.moving[item.lhs] = context.eval(item.expression);
                        //console.log(item.lhs, context.eval(item.expression));
                        context.assign(item.lhs, context.eval(item.expression), context.moving); //, context.inits);
                    });
                    if (loop.loops) { loopsRunWithTimeEstimate(loop.loops, depth, context, cstr, nstr, targetlist, entry_expr, timelist); }
                    else {
                        var entry_str = context.eval(entry_func);
                        var time_estimate = context.getTimeEstimate();
                        timelist.push(time_estimate);
                        // make a copy:
                        var target_item = extend(true, {}, context.moving);
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
       
    return fastTimeEstimate

})();
