onmessage = function(__event) {
    let __data = __event.data;
    if (__data.traj) {
      var __compiled = trajCompiler.compile(__data.traj, __data.monitorExpressionStr, __data.primaryNodeIDMap);
      var __executable = eval(__compiled);
      var __result = __executable(__data.live_state.live);
      __result.path = __event.data.path;
      __result.filename = __event.data.filename;
      postMessage(__result);
    }
    return;
}

var trajCompiler = (function () {
  let varyitem_counter = 0;
  var primaryNodeLookup = {};
  
  let convertTraj = function(t, monitorRateExpression, primaryNodeMap) {
    primaryNodeLookup = primaryNodeMap || {};
    var output = "(function(live) {\n";
    var indent = 1;
    output += compileTimeEstimator(monitorRateExpression, indent);
    output += prefix(indent) + "let __n__ = 0;\n";
    output += prefix(indent) + "let __total_time__ = 0;\n"
    output += compileInit(t.init || [], indent);
    output += prefix(indent) + "var __varyfuncs__ = [];\n"
    output += compileLoops(t.loops || [], indent);
    output += prefix(indent) + "console.log(__n__,__total_time__/3600);\n";
    output += prefix(indent) + "return {totalTime: __total_time__, numPoints: __n__}\n";
    output += "})"
    return output;
  }
  
  function compileTimeEstimator(monitorRateExpression, indent) {
    var output = prefix(indent) + "let __getTimeEstimate = function() {\n";
    output += prefix(++indent)
    output += [
    "let countAgainst = counter.countAgainst || live.counter.countAgainst;",
    "if (countAgainst == \"'TIME'\" || countAgainst == \"TIME\") {",
    "  return counter.timePreset",
    "} else if (countAgainst == \"'MONITOR'\" || countAgainst == \"MONITOR\") { ",
    "  let __monitorRate = " + (monitorRateExpression || "1")+ ";",
    "  var preset = counter.monitorPreset;",
    "  return parseFloat(counter.monitorPreset) / __monitorRate;",
    "} else {",
    "  return null;",
    "}"
    ].join("\n" + prefix(indent));
    output += "\n" + prefix(--indent) + "}\n";
    return output
  }

  function prepname(name) {
    let output = "";
    if (name in primaryNodeLookup && (/\./.test(name) == false)) {
      let primary = primaryNodeLookup[name];
      output += "var " + name + " = {valueOf: function() { return this." + primary + " }}; ";
      output += name + "." + primary;
    }
    else {
      var splitname = name.split(".");
      output += "var ";
      if (splitname.length > 1) {
        output += splitname[0] + " = " + splitname[0] + " || {}; ";
        for (let i=1; i<splitname.length - 1; i++) {
          var temp = splitname.slice(0, i+1).join(".");
          output += temp + " = " + temp + " || {}; ";
        }
      }
      output += name;
    }
    return output
  }

  function compileInit(init, indent) {
    var output = prefix(indent) + "// init block:\n";
    for (let i of init) {
      output += prefix(indent) + prepname(i[0]) + " = " + i[1] + ";\n";
    }
    return output;
  }

  function lazyArray(array) {
    //var output = "let __f__ = function(__i__) { return "; 
    var output = "__i__ => [" + array.map(a => '() => ' + a).join(',') + "]";
    output += "[__i__%" + array.length + "]()";
    //output += "[__i__]()";
    return output;
  }

  function lazyList(list) {
    var array = list.value;
    var output = "__i__ => [" + array.map(a => '() => ' + a).join(',') + "]";
    if (list.cyclic) {
      output += "[__i__%" + array.length + "]";
    }
    else {
      output += "[Math.min(__i__, " + array.length + " - 1)]";
    }
    output += "()";
    return output;
  }  

  function lazyRange(range) {
    var output = "(() => { let __range__ = __range_fill(" + js_stringify(range) + ");";
    output += " return (__i__) => __range__.start + ( __range__.step * Math.min(__i__, __range__.numPoints - 1)) })()"
    return output;
  }

  function prefix(indent) {
    return "   ".repeat(indent);
  }
  
  function compileLoops(loops, indent) {
    var output = "";
    for (let loop of loops) {
      if ('vary' in loop) {
        let pieces = compileVary(loop.vary, indent);
        if ('loops' in loop) {
          let innerloop = compileLoops(loop.loops, indent+1);
          pieces.splice(1, 0, innerloop);
        }
        else {
          pieces.splice(1, 0, prefix(indent+1) + "__n__++;\n" + prefix(indent+1) + "__total_time__ += __getTimeEstimate();");
        }
        output += pieces.join("\n");
      }
    }
    return output;
  }
  
  function js_stringify(item) {
    //console.log(item);
    if (Array.isArray(item)) {
      return `[${item.map(js_stringify).join(",")}]`;
    }
    else if (item instanceof Object) {
      return `{${Object.keys(item).map(k => String(k) + ":" + js_stringify(item[k])).join(",")}}`;
    }
    else {
      return String(item)
    }
  }
  
  function compileVary(vary, indent) {
    let items = [];
    if ((vary || []).length < 1) {
      return
    }
    //let numPoints = getNumPoints(vary[0][1]);
    for (pair of vary) {
      let lhs = pair[0];
      let item = pair[1];
      if (Array.isArray(item)) {
        items.push({lhs: lhs, expression: lazyArray(item)});
      }
      else if (item instanceof Object && 'list' in item) {
        items.push({lhs: lhs, expression: lazyList(item.list)});
      }
      else if (item instanceof Object && 'range' in item) {
        items.push({lhs: lhs, expression: lazyRange(item.range)});
      }
      else {
        items.push({lhs: lhs, expression: "__i__ => " + item});
      }
    }
    var output = prefix(indent++) + "{\n";
    output += prefix(indent) + "let __firstitem__ = " + js_stringify(vary[0][1]) + ";\n";
    output += prefix(indent) + "let __numpoints__ = __getNumPoints(__firstitem__);\n";
    output += prefix(indent) + "for (let __i__=0; __i__<__numpoints__; __i__++) {\n";
    output += prefix(++indent) + items.map(itm => prepname(itm.lhs) + " = (__varyfuncs__[" + varyitem_counter + "] || (__varyfuncs__[" + varyitem_counter++ + "] = " + itm.expression + "))(__i__)").join('\n' + prefix(indent)) + ";\n";
    var closing = prefix(--indent) + "}}\n";
    return [output, closing];
  }
  
  var __range_fill = function(params) {
    // params is an object containing keys from 
    // ["start", "stop", "step", "range", "center", "numPoints"]
    // 
    // It must contain: 
    // one of ["step", "numPoints"] and two of ["start", "stop", "center", "range"], 
    // or 
    // both "step" and "numPoints" and one of ["start", "stop", "center"]
    
    var params_copy = params;
    var params = {};
    for (let i in params_copy) {
        params[i] = params_copy[i];
    }
        
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
            // flip the sign of step if it doesn't match range:
            if (Math.sign(params.step) != Math.sign(params.range)) {
                params.step *= -1.0;
                console.log("flipping the sign on the step: ", params.step, params.range);
            }
            var step = parseFloat(params.step);
            var numPoints;
            if (step == 0) {
                numPoinst = 1;
            } else {
                numPoints = (params.range /step) + 1;
                if (Math.abs(Math.round(numPoints) - numPoints) <= Math.abs(Number.EPSILON / step)) {
                    numPoints = Math.round(numPoints);
                }
            }
            params.numPoints = Math.floor(numPoints);
        }
        else { // 'step' is missing
            params.step = params.range / (params.numPoints - 1);
        }
    }
    return params;
  }
  
  function __getNumPoints(item) {
    if (Array.isArray(item)) {
      return item.length;
    }
    else if (item instanceof Object && 'list' in item) {
      return item.list.length;
    }
    else if (item instanceof Object && 'range' in item) {
      return __range_fill(item.range).numPoints;
    }
    else {
      return 1;
    }
  }
  
  let test_traj = {
    "filePrefix": "live.sample.name",
    "entryName": "frontPolarization + '_' + backPolarization",
    "editor": "'MAGIK/PBR Editor'",
    "yAxis": "counter.liveROI",
    "description": "live.sample.description",
    "xAxis": "trajectoryData._q",
    "init": [
      [
        "_scanType",
        "'BGP'"
      ],
      [
        "_mon0",
        60
      ],
      [
        "_mon1",
        50000
      ],
      [
        "_pre",
        1
      ],
      [
        "_exp",
        2
      ],
      [
        "_fixedSlits",
        true
      ],
      [
        "slitAperture1",
        1
      ],
      [
        "slitAperture2",
        1
      ],
      [
        "slitAperture3",
        1
      ],
      [
        "slitAperture4",
        2.2
      ],
      [
        "_thetaOffset",
        0
      ],
      [
        "_detectorOffsetFactor",
        0
      ],
      [
        "counter.countAgainst",
        "'TIME'"
      ],
      [
        "_qstart",
        0.001
      ]
    ],
    "loops": [
      {
        "vary": [
          [
            "_q",
            {
              "range": {
                "start": "_qstart",
                "numPoints": 1e7,
                "stop": 0.25
              }
            }
          ],
          [
            "sampleAngle",
            "Math.asin(_q*live.wavelength.wavelength/(4.0 * Math.PI)) * 180.0 / Math.PI + ((_scanType == 'BGM')? -1 : 1) * _thetaOffset"
          ],
          [
            "detectorAngle",
            "(2.0 + ((_scanType == 'BGM')? -1 : 1) * _detectorOffsetFactor) * Math.asin(_q*live.wavelength.wavelength/(4.0 * Math.PI)) * 180.0 / Math.PI"
          ],
          [
            "counter.timePreset",
            "parseInt(_pre * ( _mon0 + _mon1* Math.pow(_q, _exp)))"
          ]
        ],
        "loops": [
          {
            "vary": [
              [
                "frontPolarization",
                [
                  "'DOWN'",
                  "'UP'"
                ]
              ],
              [
                "backPolarization",
                [
                  "'DOWN'",
                  "'UP'"
                ]
              ]
            ]
          }
        ]
      }
    ]
  }
  
  function test_run() {
    var a = this.compile(test_traj);
    trfunc = eval(a);
    trfunc({wavelength: {wavelength: 5.0}});
  }

  function test_compile() {
    var a = this.compile(test_traj);
    return a;
  }
  
  function dryrun(traj, live) {
    var a = this.compile(traj);
    var ac = eval(a);
    return ac(live);
  }
    

  return {compile: convertTraj, test_run: test_run, test_compile: test_compile};
})();


function __getNumPoints(item) {
  if (Array.isArray(item)) {
    return item.length;
  }
  else if (item instanceof Object && 'list' in item) {
    return item.list.length;
  }
  else if (item instanceof Object && 'range' in item) {
    return __range_fill(item.range).numPoints;
  }
  else {
    return 1;
  }
}

function __range_fill(params) {
    // params is an object containing keys from 
    // ["start", "stop", "step", "range", "center", "numPoints"]
    // 
    // It must contain: 
    // one of ["step", "numPoints"] and two of ["start", "stop", "center", "range"], 
    // or 
    // both "step" and "numPoints" and one of ["start", "stop", "center"]
    
    var params_copy = params;
    var params = {};
    for (let i in params_copy) {
        params[i] = params_copy[i];
    }
        
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
            // flip the sign of step if it doesn't match range:
            if (Math.sign(params.step) != Math.sign(params.range)) {
                params.step *= -1.0;
                console.log("flipping the sign on the step: ", params.step, params.range);
            }
            var step = parseFloat(params.step);
            var numPoints;
            if (step == 0) {
                numPoinst = 1;
            } else {
                numPoints = (params.range /step) + 1;
                if (Math.abs(Math.round(numPoints) - numPoints) <= Math.abs(Number.EPSILON / step)) {
                    numPoints = Math.round(numPoints);
                }
            }
            params.numPoints = Math.floor(numPoints);
        }
        else { // 'step' is missing
            params.step = params.range / (params.numPoints - 1);
        }
    }
    return params;
}


