"use strict";

var trajectory_editor = window.trajectory_editor || {};

$(function() {
    
    var TRAJECTORY_PATH = "trajectories";
    var COMMON_PATH = "../../common/trajectories";
    var NICE_HOST = window.NICE_HOST ? window.NICE_HOST : "h123062.ncnr.nist.gov";
    
    var EMPTY_TRAJ = "{'init': {}, 'loops': [{'vary': []}]}";
    var MONITOR_RATE_ESTIMATE_EXPRESSION = 'slitAperture1.softPosition / 1000.0 * <cached_monitor>';
    var device_list;
    
    // add buttons for functionality
    var buttons = {};
    
    var bd = $('#buttons');
    bd.append($('<span />', {'text': 'Load (*.json): '}));
    buttons['load'] = bd.append($('<input />', {
        'type': 'file', 
        'multiple':'false', 
        'id':'trajfile', 
        'name':'trajfile',
        'onchange': 'loadLocalFile()'}));
    buttons['refresh'] = bd.append($('<button />', {
        'text': 'Refresh files',
        'onclick': 'trajectory_editor.refreshFileSystem()'}));
    bd.append($('<label />', {'text': 'Sort files', 'for': 'sort_files'}));
    buttons['sort'] = bd.append($('<input />', {
        'type': 'checkbox', 
        'id':'sort_files',
        'checked': true}));
    buttons['showtraj'] = bd.append($('<button />', {
        'text': 'Show trajectory'})
        .click(show_traj));
    buttons['dryrun'] = bd.append($('<button />', {
        'text': 'Dry run'})
        .click(function() {server_dry_run()}));
    buttons['enqueue'] = bd.append($('<button />', {
        'text': 'Enqueue'})
        .click(function() {enqueue()}));
    buttons['save'] = bd.append($('<button />', {
        'text': 'Save'})
        .click(function() {save()}));
    buttons['delete'] = bd.append($('<button />', {
        'text': 'Delete'})
        .click(function() {deleteFile()}));
    buttons['saveAs'] = bd.append($('<button />', {
        'text': 'Save as'})
        .click(function() {saveAs()}));
    //bd.append($('<label />', {'text': 'Show common', 'for': 'show_common'}));
    //buttons['show_common'] = bd.append($('<input />', {
    //    'type': 'checkbox', 
    //    'id':'show_common',
    //    'checked': false,
    //    'onchange': 'refreshBoth()'}));
    bd.append($('<label />', {'text': 'Edit structure', 'for': 'interactive'}));
    buttons['interactive'] = bd.append($('<input />', {
        'type': 'checkbox', 
        'id':'interactive',
        'checked': false})
        .change(function() {update_interactiveness()}));
    /*
    bd.append($('<label />', {'text': 'Instrument:', 'for': 'nice_host'}));
    buttons['nice_host'] = bd.append($('<input />', {
        'type': 'text',
        'id': 'nice_host',
        'value': NICE_HOST,
        'onchange': 'getDevices().then(refreshBoth());'}));
    */
        
    var bb = $('#bulk_edit_buttons');
    buttons['bulk_save'] = bb.append($('<button />', {
        'id': 'bulk_save',
        'text': 'Commit changes',
        'onclick': 'commitChanges();'}));
    
    
    bb.hide();
    
    //var eb = $('#catalog');
    var wt = {'variable_names': {}}; // global
    var editor; // to be used later
    
    function update_interactiveness() {
        var interactive = document.getElementById('interactive').checked;
//        if (!(interactive)) { 
//            eb.hide(); 
//        } else {
//            eb.show();
//        }
        if (wt.raw) { // && wt.filename) {
            var filename = wt.filename;
            var new_editor = set_data(wt.raw);
            new_editor.filename = filename;
        }
    }
    
    update_interactiveness();
    
    function resizeInput() {
        $(this).attr('size', Math.max($(this).val().length + 1, 10));
    }

    $('.text-entry input')
        // event handler
        .keyup(resizeInput)
        // resize on page load
        .each(resizeInput);
    
    
    var set_data = function(raw) {
        var parsed_data = eval('(function(){ var result =' + raw + '; return result})();')
        $("#editor").empty();
        //loops = loopsList(parsed_data.loops);
        var interactive = document.getElementById('interactive').checked;
        wt = interactive ? new webtraj_interactive() : new webtraj();
        editor = wt.mainList(parsed_data);
        wt.variable_names['devices'] = (devicesMonitor && devicesMonitor.devices)? Object.keys(devicesMonitor.devices).sort() : [];
        wt.variable_names['init'] = init_keywords;
        wt.source_trajectory = parsed_data;
        wt.raw = raw;
        document.getElementById('editor').appendChild(editor);
        $('.text-entry input')
            // event handler
            .keyup(resizeInput)
            // resize on page load
            .each(resizeInput);
        return wt;     
    }
    
    var loadLocalFile = function() {
        var file = document.getElementById('trajfile').files[0]; // only one file allowed
        var datafilename = file.name;
        var result = null;
        var reader = new FileReader();
        reader.onload = function(e) {
            $('#filelist ol li').removeClass("ui-selected");
            $('#statusline').html('<b>Editing local: ' + datafilename + '</b>');
            wt = set_data(this.result);
            wt.filename = datafilename;
        }
        reader.readAsText(file);
    }
    
    //var fileinput = document.getElementById('trajfile');
    //fileinput.onchange = loadData;  
    
    function show_traj() {
        var traj_obj = editor.getValue();
        var traj = JSON.stringify(traj_obj, null, "  ");
        var scriptwin = window.open("", "_blank");
        scriptwin.traj_obj = traj_obj;
        scriptwin.document.title = "Trajectory: ";
        var code = scriptwin.document.createElement('pre');
        scriptwin.document.body.appendChild(code);
        code.innerHTML = traj;
        return scriptwin
    }
    
    set_data(EMPTY_TRAJ);
    
    $('#files').resizable({
      handles: 's',
      alsoResize: '#filelist',
      minHeight: 150
    });
    
    
    
    var loadFile = function(path, filename) {
        return api.readFileAsText(path + '/' + filename).then(
            function (data) {
                wt = set_data(data);
                wt.filename = filename;
                wt.path = path;
                $('#statusline').html('<b>Editing: ' + path + filename + '</b>');
                $('.lockrange').prop('checked', true).trigger('change');;
                //document.getElementById('result').innerHTML = result.val.me;
                msg = null;
                //result = null;
                bb.hide();
                bd.show();
            }
        );
    }
    
    var saveFile = function(filename, overWrite) {
        if (filename == null || filename == '') {
            var filename = wt.filename;
        }
        wt.filename = filename;
        var trajectories_path = getTrajectoriesPath();
        wt.path = trajectories_path;
        $('#statusline').html('<b>Editing: ' + filename + '</b>');
        var traj_obj = editor.getValue();
        var filecontents = JSON.stringify(traj_obj, null, "  ");
        var path = trajectories_path + filename;
        var ov = true; // overWrite
        var ap = false; // append
        return api.writeFileFromText(path, filecontents, ov, ap);   
    }
    
    function saveAs(checkExisting, filename) {
        var checkExisting = (checkExisting == null) ? true : false;
        if (filename == null) {
            var prompt_file = "";
            if (wt && wt.filename) { prompt_file = wt.filename }; 
            var filename = prompt("Save file as:", prompt_file);
        }
        var trajectories_path = getTrajectoriesPath();
        getFiles(trajectories_path, true, function(filenames) {
            if (checkExisting && filenames.indexOf(filename) > -1) {
                var yn = confirm("Filename: " + filename + " exists.  Overwrite?");
                if (yn == true) { saveFile(filename, true); }
                else {} // do nothing
            }
            else {
                saveFile(filename, true);
                refreshBoth();
                //FileList(getFiles(TRAJECTORY_PATH, true).concat(getFiles(COMMON_PATH, true)));
            }
        });
    }
    
    function save() {
        saveAs(false, wt.filename);
    }
    
    var deleteFilesConfirm = function(filenames) {
        var yn = confirm("Delete: \n" + filenames.join('\n') + "\n\nAre you sure?");
        if (yn == true) { deleteFiles(filenames); }
        else {} // do nothing
    }
    
    var deleteFiles = function(filenames) {
        return api.deleteFiles(filenames).then(
            function() {
                //refreshBoth();
            }
        ).exception(
            function(data) {
                alert("ERROR: " + JSON.stringify(data));
            }
        );
    }
    
    function deleteFile(path) {
        if (path == null || path == '') {
            //var filename = wt.filename;
            //var path = TRAJECTORY_PATH + '/' + filename;
            var selected = $('#filelist ol li.ui-selected');
            var paths = [];
            for (var i=0; i<selected.length; i++) {
                paths[i] = TRAJECTORY_PATH + '/' + $(selected[i]).attr("filename");
            }
            console.log(selected, paths);
            deleteFilesConfirm(paths);
        }
        else {
            deleteFilesConfirm([path]);
        }
    }
    
    function enqueue() {
        var selected = $('#filelist ol .ui-selected');
        var promises = [], filename;
        for (var i=0; i<selected.length; i++) {
            var filename = $(selected[i]).attr('filename');
            promises[i] = api.runJsonTrajectoryFile(filename);
        }
        return Promise.all(promises);
        //var filename = wt.filename;
        //return api.runJsonTrajectoryFile(filename);
    }
    
    function server_dry_run() {
        var filename = wt.filename;
        return api.console("dryRunTrajectory " + filename).then(
            function(data) {
                alert("result:" + JSON.stringify(data));
            }
        );
    }
    
    var getPrimaryNodeIDMap = function() {
        var output = {};
        var devices = devicesMonitor.getAllDeviceNames();
        devices.forEach(function (item, i) {
            if ('primaryNodeID' in devicesMonitor.devices[item]) {
                output[item] = devicesMonitor.devices[item]['primaryNodeID'].split('.')[1];
            }
        });
        return output;
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

    function deice(value) {
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
        return output_value;
    }
    
    var getLiveState = function(strict) {
        // if strict is true: don't allow bare device names.
        var live = {};
        var device_ids = Object.keys(devicesMonitor.devices);
        for (var i=0; i<device_ids.length; i++) {
            var device_id = device_ids[i];
            //console.log(device_id);
            var device_proxy = {};
            var device = devicesMonitor.devices[device_id];
            if (!strict && 'primaryNodeID' in device && device.primaryNodeID) {
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
                        //Object.defineProperty(device_proxy, node_name, {get: make_getter(value)});
                        device_proxy[node_name] = deice(value);
                    } else if (node.desiredValue && node.desiredValue.userVal) {
                        var value = node.desiredValue.userVal.val;
                        device_proxy[node_name] = deice(value);
                        //Object.defineProperty(device_proxy, node_name, {get: make_getter(value)});
                    }
                }
            }
            live[device_id] = device_proxy;
        }
        return {live: live}
    }

    
    var getFastTimeEstimate_old = function(path, filename, live_state, primaryNodeIDMap, callback) {
        if (filename == null || filename == '') {
            var filename = wt.filename;
        }
        //var live_state = (live) ? get_live_state(true) : {};
        var path = (path == null) ? wt.path : path;
        var traj_obj;
        var cached_monitor;
        return api.readFileAsText(path + '/' + filename).then(
            function (data) {
                var parsed_data = eval('(function(){ var result =' + data + '; return result})();')
                traj_obj = parsed_data;
                //traj_obj = expandDevices(parsed_data);
                my_traj_obj = traj_obj;
                return api.getPersistentValue('estimatedMonitorRate')
            }
        ).then(
            function(c) {
                cached_monitor = c;
                var expression_str = MONITOR_RATE_ESTIMATE_EXPRESSION.replace('<cached_monitor>', cached_monitor.toString());
                console.log('expr:', expression_str);
                eval('var monitorEstimateExpressionFunc = function(namespace) { with(Math) with(namespace.live_state.live) with(namespace.inits) with(namespace.moving) with(namespace.counters) return (' + expression_str + ')};');
                myEF = monitorEstimateExpressionFunc;
                //var ctx = newContext(live_state, monitorEstimateExpressionFunc, primaryNodeIDMap);
                var ctx = new __sandbox(live_state, monitorEstimateExpressionFunc, primaryNodeIDMap);
                myContext = ctx;
                var timeEstimate = __fastTimeEstimate(traj_obj, ctx);
                callback(timeEstimate, path, filename);
            }
        ).exception(
            function(e) {console.log('error:', e)}
        )
    }
    
    var getFastTimeEstimate = function(path, filename, live_state, primaryNodeIDMap, callback) {
        if (filename == null || filename == '') {
            var filename = wt.filename;
        }
        //var live_state = (live) ? get_live_state(true) : {};
        var path = (path == null) ? wt.path : path;
        var traj_obj;
        var cached_monitor;
        return api.readFileAsText(path + '/' + filename).then(
            function (data) {
                var parsed_data = eval('(function(){ var result =' + data + '; return result})();')
                traj_obj = parsed_data;
                //traj_obj = expandDevices(parsed_data);
                return api.getPersistentValue('estimatedMonitorRate')
            }
        ).then(
            function(c) {
                cached_monitor = c;
                var expression_str = MONITOR_RATE_ESTIMATE_EXPRESSION.replace('<cached_monitor>', cached_monitor.toString());
                //eval('var monitorEstimateExpressionFunc = function(namespace) { with(Math) with(namespace.live_state.live) with(namespace.inits) with(namespace.moving) with(namespace.counters) return (' + expression_str + ')};');
                //myEF = monitorEstimateExpressionFunc;
                //var ctx = newContext(live_state, monitorEstimateExpressionFunc, primaryNodeIDMap);
                if (!window.webworker) {
                    window.webworker = new Worker('dryrun_client_worker.js');
                    window.webworker.onerror = function(e) { console.log('error in fastTimeEstimate:', e) };
                    window.webworker.onmessage = function(msg) { callback(msg.data.totalTime, msg.data.numPoints, msg.data.path, msg.data.filename); } 
                }
                window.webworker.postMessage({
                    traj: traj_obj,
                    live_state: live_state,
                    monitorExpressionStr: expression_str,
                    primaryNodeIDMap: primaryNodeIDMap,
                    path: path,
                    filename: filename
                }); 
                //var ctx = new __sandbox(live_state, monitorEstimateExpressionFunc, primaryNodeIDMap);
                //myContext = ctx;
                //var timeEstimate = fastTimeEstimate(traj_obj, ctx);
                //callback(timeEstimate, path, filename);
            }
        )
    }
    
    var getFiles = function(path, sort_files, callback) {
        //var wildcard = '*.json';
        var wildcard = '*';
        var fullPath = false;
        return api.ls(path, wildcard, fullPath).then(
            function(filenames) {
                if (sort_files == true) { filenames.sort(); }
                callback(filenames);
            }
        );
    }
    
    var arrowKeyNav = function(e){
        var ol = $(e.target).children('ol');
        var selected = ol.find('.ui-selected');
        if (selected.length == 0) { e.preventDefault(); return }
        switch(e.which) {
            case $.ui.keyCode.LEFT:
            // do nothing
            break;

            case $.ui.keyCode.UP:
            var prev = selected.prev();
            if (prev.length == 1) {
                // global filename
                selected.removeClass('ui-selected');
                prev.addClass('ui-selected');
                var path = prev[0].getAttribute('path');
                var fn = prev[0].getAttribute('filename');
                loadFile(path, fn);
            }
            //if (prev.length > 0) {
            //    prev.trigger('click');    
            //}    
            break;

            case $.ui.keyCode.RIGHT:
            // do nothing
            break;

            case $.ui.keyCode.DOWN:
            var next = selected.next();
            if (next.length == 1) {
                // global filename
                selected.removeClass('ui-selected');
                next.addClass('ui-selected');
                var path = next[0].getAttribute('path');
                var fn = next[0].getAttribute('filename');
                loadFile(path, fn);
            }
            //if (next.length > 0) {
            //    next.trigger('click');    
            //}  
            break;

            default: return; // allow other keys to be handled
        }
        // prevent default action (eg. page moving up/down)
        // but consider accessibility (eg. user may want to use keys to choose a radio button)
        e.preventDefault();
    };
    
    var getTrajectoriesPath = function() {
        var current_path = experimentMonitor.current_experiment.clientPath;
        var experiment_folder = fileMonitor._root.children.filter( function(x) {
            var re = new RegExp(current_path);
            return re.test(x.name)
        });
        var trajectories_folder = experiment_folder[0].children.filter( function(x) { return /trajectories/.test(x.name) });
        var trajectories_path = trajectories_folder[0].name;
        return trajectories_path;
    }
    
    function refreshFileSystem() {
        var current_path = experimentMonitor.current_experiment.clientPath;
        return api.refreshFileSystem(current_path + '/trajectories/').then(function() {
            refreshBoth()
        });
    }
    
    function refreshBoth() {
        var sort_files = document.getElementById('sort_files').checked;
        //var show_common = document.getElementById('show_common');
        var current_path = experimentMonitor.current_experiment.clientPath;
        var experiment_folder = fileMonitor._root.children.find( function(x) {
            var re = new RegExp(current_path);
            return re.test(x.name)
        });
        var trajectories_folder = experiment_folder.children.find( function(x) { return /trajectories/.test(x.name) });
        if (trajectories_folder == undefined) { return }
        var trajectory_files = trajectories_folder.children
          .filter(function(x) {return x.isFile})
          .map(function(x) { return (x.name) });
        
        var trajectories_path = trajectories_folder.name;
        var labels = trajectory_files.map(function(x) { var pel = x.split('/'); return pel[pel.length - 1]});
        updateFileList(trajectories_path, labels, true, 'ui-widget-content local-trajectories');
        
        if (wt.filename && wt.path) {
            // auto re-select currently selected file after save or refresh.
            // first, scroll the window to the desired item:
            $('#filelist ol li').removeClass("ui-selected");
            var selection = $('#filelist ol [filename="' + wt.filename + '"][path="' + wt.path + '"]');
            selection.addClass('ui-selected');
            
            if (selection && selection.parent && selection.position) {
                try {
                    var parent_offset = selection.parent().position().top;
                    var curr_position = selection.position().top;
                    var grandparentdiv = selection.parent().parent();
                    selection.parent().parent().scrollTop(curr_position - parent_offset);
                } catch (e) {
                    // do nothing on error
                } 
                // optional: do the selection.  Will reload data from server.  Do we want this?
                // see http://stackoverflow.com/questions/5541601/trigger-jquery-ui-events-ui-selectable
                $('#filelist ol').data("ui-selectable")._mouseStop(null);
                //selection.trigger('click');
            }  
        }
    }
    
    /*
    // bulk edit methods more trouble than they're worth in this format - bulk editing should
    // be done through table-based editor with matching schemas.
    bulkEdit = function(paths) {
        var t = [];
        var msg, path, result, traj;
        for (var i=0; i<paths.length; i++){
            msg = new xmlrpcmsg();
            msg.method('readFileAsText');
            path = new xmlrpcval(paths[i], 'string');
            msg.addParam(path);
            msg.createPayload();
            result = myclient.send(msg);
            t.push(JSON.parse(result.val.me))
            msg = null;
        }
        
        var output_traj = t[0];
        var ops, s_ops;
        for (var j=1; j<t.length; j++) {
            ops = JSONDiff(output_traj, t[j]);
            s_ops = sanitize_ops(ops);
            jsonpatch.apply(output_traj, s_ops);
        }
        set_data(JSON.stringify(output_traj));
        
        bb.show();
        bd.hide();
    }
    
    sanitize_ops = function(ops) {
        // clean up ops from JSON diff so that you can make a generic trajectory
        // remove non-shared keys, set non-shared values to blank ''
        var op, ops_out = [];
        for (var i=0; i<ops.length; i++) {
            op = ops[i]; 
            if (op.op == 'remove') { ops_out.push(op) }
            else if (op.op == 'replace') { 
                op.value = '***'; 
                ops_out.push(op);
            }
        }
        return ops_out;
    }
    
    commitChanges = function() {
        var diff = JSONDiff(wt.source_trajectory, editor.getValue());
        var msg = ""; 
        for (var i=0; i<diff.length; i++) {
            msg += JSON.stringify(diff[i]) + '\n';
        }
        //console.log('confirm: ', confirm(msg));
        if (!(confirm(msg))) { return }
        var overWrite = true;
        var append = false;
        var selected = $('#filelist ol .ui-selected');
        var fullpaths = [];
        var msg, path, result, traj, contents, ov, ap;
        for (var i=0; i<selected.length; i++) {
            var path = selected[i].getAttribute('path');
            var fn = selected[i].getAttribute('filename');
            var fullpath = path + '/' + fn;
            
            msg = new xmlrpcmsg();
            msg.method('readFileAsText');
            path = new xmlrpcval(fullpath, 'string');
            msg.addParam(path);
            msg.createPayload();
            result = myclient.send(msg);
            traj = JSON.parse(result.val.me);
            jsonpatch.apply(traj, diff);
            msg = null;
            path = null;
            
            msg = new xmlrpcmsg();
            msg.method('writeFileFromText');
            path = new xmlrpcval(fullpath, 'string');
            contents = new xmlrpcval(JSON.stringify(traj, null, "  "), 'string');
            ov = new xmlrpcval(overWrite, 'boolean');
            ap = new xmlrpcval(append, 'boolean');
            msg.addParam(path);
            msg.addParam(contents);
            msg.addParam(ov);
            msg.addParam(ap);
            msg.createPayload();
            result = myclient.send(msg);
            
            msg = null;
            path = null;
            contents = null;
            ov = null;
            ap = null;
            result = null;
            traj = null;
        }
        
    }
    */
    
    /*
    // DEPRECATED:  Not using expanded device names by default now, since it causes a problem on eval 
    // (if the assigned name (left-hand-side) is expanded, but then the rhs is an expression that depends
    // on the unexpanded lhs, you have a problem.
    // This has been addressed by making the getter (valueOf) and setter (assignFunc)
    //  for the bare device name point to the primaryNodeID
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
                expandDevicesLoops(loop.loops);
            }
        });
    }
    */
    
    var updateTimeEstimate = function(t, n, path, filename) {
        var totalTime = t; //.totalTime;
        var numPoints = n;
        var hours = Math.floor(totalTime/3600.0);
        var minutes = Math.round((totalTime % 3600.0) / 60.0);
        var targetItem = $('li[path="' + path + '"][filename="' + filename + '"]');
        targetItem.children('.estimated-time')
          .html(((hours > 0) ? (hours + 'h') : '') + minutes + 'm');
        targetItem.children('.numPoints')
          .html('#' + numPoints.toFixed(0));
    }
    
    var updateFileList = function(path, filenames, emptyFirst, listclass, contentGenerator) {
        var filelist = $('#filelist');
        var ol = $('#filelist ol');
        var defaultContentGenerator = function(path, filename) {
            return filename + '<span class="numPoints"></span><span class="estimated-time"></span>';
        }
        var contentGenerator = (contentGenerator==null) ? defaultContentGenerator : contentGenerator;
        if (emptyFirst == true) { 
            ol.empty();
        }
        
        var live_state = getLiveState(true);
        var primaryNodeIDMap = getPrimaryNodeIDMap();
        for (var i=0; i<filenames.length; i++) {
            var li = $('<li/>');
            var filename = filenames[i];
            li.addClass(listclass);
            li.attr('path', path);
            li.attr('filename', filename);
            li.html(contentGenerator(path, filename));
            ol.append(li);
            getFastTimeEstimate(path, filename, live_state, primaryNodeIDMap, updateTimeEstimate);
        }
        filelist.height( $('#files').innerHeight() - $('#files h3').outerHeight() - 10 ); // padding is 5
    }
    
    function HashMapToObject(m) {
        var obj={}; 
        m.forEach( function(dn) {
            obj[dn]=m.get(dn);           
        }); 
        return obj
    } 
    
    var getDevices = function() {
        return
    }
    
    var updateDeviceSelect = function(devices) {
        var deviceSelect = $('.device-select');
        deviceSelect.empty();
        var sortedDevices = Object.keys(devices).sort();
        $.each(sortedDevices, function(index, item) {
            deviceSelect.append($("<option />").val(item).text(item));
        });
    }
    
    //getDevices().then(refreshBoth());
    // grab the files!
    //refreshBoth();
        
    var init_keywords = ['description', 'alwaysWrite', 'neverWrite', 'fileGroup', 'fileName', 'entryName', 'filePrefix', 'xAxis', 'yAxis'];
    //var device_list = Object.keys(getDevices()).sort();
    // add init keywords
    //device_list = init_keywords.concat(device_list);
    wt.variable_names['devices'] = device_list;
    wt.variable_names['init'] = init_keywords;
    
    /*
    $( ".catalog-item" ).draggable({
      appendTo: "body",
      helper: "clone",
      cursor: "crosshair",
      cursorAt: { top: -5, left: -5 }
    });
    */
    
    /*
    $(document).on("click", "#filelist ol li", function() {
        $(this).addClass("ui-selected").siblings().removeClass("ui-selected");
        var path = $(this)[0].getAttribute('path');
        var fn = $(this)[0].getAttribute('filename');
        loadFile(path, fn);
    });
    */
    
    $('#filelist ol').selectable({
        stop: function(event, ui) { 
            $('#filelist').focus();
            var selected = $('#filelist ol .ui-selected');
            if (selected.length == 1) {
                // global filename
                var path = selected[0].getAttribute('path');
                var fn = selected[0].getAttribute('filename');
                loadFile(path, fn);
            } else { // multiple selection
                var fullpaths = [];
                for (var i=0; i<selected.length; i++) {
                    var path = selected[i].getAttribute('path');
                    var fn = selected[i].getAttribute('filename');
                    fullpaths.push(path + '/' + fn);
                }
                //alert('multiple selection');
            }
            
        }
    });
    
    $('#filelist').keydown(arrowKeyNav);
    
    // exports:
    trajectory_editor.refreshBoth = refreshBoth;
    trajectory_editor.refreshFileSystem = refreshFileSystem;
    trajectory_editor.save = save;
    trajectory_editor.saveAs = saveAs;
    
});
