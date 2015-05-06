$(function() {
    
    TRAJECTORY_PATH = "trajectories";
    COMMON_PATH = "../../common/trajectories";
    NICE_HOST = window.NICE_HOST ? window.NICE_HOST : "h123062.ncnr.nist.gov";
    
    var EMPTY_TRAJ = "{'init': {}, 'loops': [{'vary': []}]}";
    var MONITOR_RATE_ESTIMATE_EXPRESSION = 'slitAperture1 / 1000.0 * <cached_monitor>';
    var device_list;
    
    // add buttons for functionality
    buttons = {};
    
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
        'onclick': 'refreshBoth()'}));
    bd.append($('<label />', {'text': 'Sort files', 'for': 'sort_files'}));
    buttons['sort'] = bd.append($('<input />', {
        'type': 'checkbox', 
        'id':'sort_files',
        'checked': true}));
    buttons['showtraj'] = bd.append($('<button />', {
        'text': 'Show trajectory',
        'onclick': 'show_traj();'}));
    buttons['dryrun'] = bd.append($('<button />', {
        'text': 'Dry run',
        'onclick': 'server_dry_run();'}));
    buttons['enqueue'] = bd.append($('<button />', {
        'text': 'Enqueue', 
        'onclick': 'enqueue();'}));
    buttons['save'] = bd.append($('<button />', {
        'text': 'Save',
        'onclick': 'save();'}));
    buttons['dryrun'] = bd.append($('<button />', {
        'text': 'Save as',
        'onclick': 'saveAs(true);'}));
    bd.append($('<label />', {'text': 'Show common', 'for': 'show_common'}));
    buttons['show_common'] = bd.append($('<input />', {
        'type': 'checkbox', 
        'id':'show_common',
        'checked': false,
        'onchange': 'refreshBoth()'}));
    bd.append($('<label />', {'text': 'Edit structure', 'for': 'interactive'}));
    buttons['interactive'] = bd.append($('<input />', {
        'type': 'checkbox', 
        'id':'interactive',
        'checked': false,
        'onchange': 'update_interactiveness()'}));
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
    
    var eb = $('#catalog');
    wt = {'variable_names': {}}; // global
    
    update_interactiveness = function() {
        var interactive = document.getElementById('interactive').checked;
        if (!(interactive)) { 
            eb.hide(); 
        } else {
            eb.show();
        }
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
    
    
    set_data = function(raw) {
        parsed_data = eval('(function(){ var result =' + raw + '; return result})();')
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
    
    loadLocalFile = function() {
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
    
    show_traj = function() {
        var traj_obj = editor.getValue();
        var traj = JSON.stringify(traj_obj, null, "  ");
        scriptwin = window.open("", "_blank");
        scriptwin.traj_obj = traj_obj;
        scriptwin.document.title = "Trajectory: ";
        var code = scriptwin.document.createElement('pre');
        scriptwin.document.body.appendChild(code);
        code.innerHTML = traj;
    }
    
    set_data(EMPTY_TRAJ);
    
    $('#files').resizable({
      handles: 's',
      alsoResize: '#filelist',
      minHeight: 150
    });
    
    
    
    loadFile = function(path, filename) {
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
    
    saveFile = function(filename, overWrite) {
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
    
    saveAs = function(checkExisting, filename) {
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
    
    save = function() {
        saveAs(false, wt.filename);
    }
    
    enqueue = function() {
        var filename = wt.filename;
        return api.runJsonTrajectoryFile(filename);
    }
    
    server_dry_run = function() {
        var filename = wt.filename;
        return api.console("dryRunTrajectory " + filename).then(
            function(data) {
                alert("result:" + JSON.stringify(data));
            }
        );
    }
    
    getFastTimeEstimate = function(filename, live) {
        if (filename == null || filename == '') {
            var filename = wt.filename;
        }
        var live_state = (live) ? get_live_state(true) : {};
        var path = wt.path;
        var traj_obj = expandDevices(editor.getValue());
        return api.getPersistentValue('estimatedMonitorRate').then( function(cached_monitor) {
            var expression_str = MONITOR_RATE_ESTIMATE_EXPRESSION.replace('<cached_monitor>', cached_monitor.toString());
            eval('var monitorEstimateExpressionFunc = function(namespace) { with(Math) with(namespace.live_state.live) with(namespace.moving) with(namespace.inits) with(namespace.counters) return (' + expression_str + ')};');
            myContext = newContext(live_state, monitorEstimateExpressionFunc);
            var timeEstimate = fastTimeEstimate(traj_obj, myContext);
            return timeEstimate;
        });
    }
    
    getFiles = function(path, sort_files, callback) {
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
    
    arrowKeyNav = function(e){
        var ol = $(e.target);
        var selected = ol.find('.ui-selected');
        if (selected.length == 0) { e.preventDefault(); return }
        switch(e.which) {
            case $.ui.keyCode.LEFT:
            // do nothing
            break;

            case $.ui.keyCode.UP:
            var prev = selected.prev();
            if (prev.length > 0) {
                prev.trigger('click');    
            }    
            break;

            case $.ui.keyCode.RIGHT:
            // do nothing
            break;

            case $.ui.keyCode.DOWN:
            var next = selected.next();
            if (next.length > 0) {
                next.trigger('click');    
            }  
            break;

            default: return; // allow other keys to be handled
        }
        // prevent default action (eg. page moving up/down)
        // but consider accessibility (eg. user may want to use keys to choose a radio button)
        e.preventDefault();
    };
    
    getTrajectoriesPath = function() {
        var current_path = experimentMonitor.current_experiment.clientPath;
        var experiment_folder = fileMonitor._root.children.filter( function(x) {
            var re = new RegExp(current_path);
            return re.test(x.name)
        });
        var trajectories_folder = experiment_folder[0].children.filter( function(x) { return /trajectories/.test(x.name) });
        var trajectories_path = trajectories_folder[0].name;
        return trajectories_path;
    }
    
    refreshBoth = function() {
        var sort_files = document.getElementById('sort_files').checked;
        var show_common = document.getElementById('show_common').checked;
        var current_path = experimentMonitor.current_experiment.clientPath;
        var experiment_folder = fileMonitor._root.children.filter( function(x) {
            var re = new RegExp(current_path);
            return re.test(x.name)
        });
        var trajectories_folder = experiment_folder[0].children.filter( function(x) { return /trajectories/.test(x.name) });
        if (trajectories_folder.length == 0) { return }
        var trajectory_files = trajectories_folder[0].children.map(function(x) { return (x.name) });
        
        var trajectories_path = trajectories_folder[0].name;
        var labels = trajectory_files.map(function(x) { var pel = x.split('/'); return pel[pel.length - 1]});
        updateFileList(trajectories_path, labels, true, 'ui-widget-content local-trajectories');
        
        if (wt.filename && wt.path) {
            // auto re-select currently selected file after save or refresh.
            // first, scroll the window to the desired item:
            var selection = $('#filelist ol [filename="' + wt.filename + '"][path="' + wt.path + '"]');
            if (selection && selection.parent && selection.position) {
                var parent_offset = selection.parent().position().top;
                var curr_position = selection.position().top;
                var grandparentdiv = selection.parent().parent();
                selection.parent().parent().scrollTop(curr_position - parent_offset);
                // do the selection
                selection.trigger('click');
            }  
        }
        //console.log('trajectories:', trajectory_files, trajectories_path, labels);
        
        /*
        var req_common;
        
        if (show_common) {
            req_common = api.ls(COMMON_PATH, '*.json', false);
        } else {
            req_common = new Promise().succeed(); // bail
        }
        
        var req_current = api.ls(TRAJECTORY_PATH, '*.json', false);
        

        Promise.all(req_common, req_current).then( function( t_comm, t_curr ) {
            //console.log(t_comm[0], t_curr[0]);
            var show_common = document.getElementById('show_common').checked;
            var sort_files = document.getElementById('sort_files').checked;
            var current_files = t_curr[0];
            if (sort_files) { current_files.sort(); }
            updateFileList('', [], true, 'ui-widget-content common-trajectories'); // clear
            if (show_common) {
                var common_files = t_comm[0];
                if (sort_files) { common_files.sort(); }
                updateFileList(COMMON_PATH, t_comm[0], false, 'ui-widget-content common-trajectories',
                   function(path, filename) { return path + '/' + filename });
            }
            updateFileList(TRAJECTORY_PATH, t_curr[0], false, 'ui-widget-content local-trajectories');
            
            $('#filelist ol').selectable({
                stop: function(event, ui) { 
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
                        bulkEdit(fullpaths);
                        //alert('multiple selection');
                    }
                    
                }
            });
            
            $("#filelist ol li").click(function() {
                $(this).addClass("ui-selected").siblings().removeClass("ui-selected");
                var path = $(this)[0].getAttribute('path');
                var fn = $(this)[0].getAttribute('filename');
                loadFile(path, fn);
            });
            
            if (wt.filename && wt.path) {
                // auto re-select currently selected file after save or refresh.
                // first, scroll the window to the desired item:
                var selection = $('#filelist ol [filename="' + wt.filename + '"][path="' + wt.path + '"]');
                var parent_offset = selection.parent().position().top;
                var curr_position = selection.position().top;
                var grandparentdiv = selection.parent().parent();
                selection.parent().parent().scrollTop(curr_position - parent_offset);
                // do the selection
                selection.trigger('click');  
            }   
        }).exception(
                function(ex)
                {
                    alert(ex.toString());
                }
            );
        */
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
    updateFileList = function(path, filenames, emptyFirst, listclass, contentGenerator) {
        var filelist = $('#filelist');
        var ol = $('#filelist ol');
        var contentGenerator = (contentGenerator==null) ? function(path, filename) { return filename; } : contentGenerator;
        if (emptyFirst == true) { 
            ol.empty();
        }
        
        for (var i=0; i<filenames.length; i++) {
            var li = $('<li/>');
            li.addClass(listclass);
            li.attr('path', path);
            li.attr('filename', filenames[i]);
            li.html(contentGenerator(path, filenames[i]));
            ol.append(li);
        }
        filelist.height( $('#files').innerHeight() - $('#files h3').outerHeight() - 10 ); // padding is 5
    }
    
    HashMapToObject = function(m) {
        var obj={}; 
        m.forEach( function(dn) {
            obj[dn]=m.get(dn);           
        }); 
        return obj
    } 
    
    getDevices = function() {
        return
    }
    
    updateDeviceSelect = function(devices) {
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
    
    $( ".catalog-item" ).draggable({
      appendTo: "body",
      helper: "clone",
      cursor: "crosshair",
      cursorAt: { top: -5, left: -5 }
    });
    
    $(document).on("click", "#filelist ol li", function() {
        $(this).addClass("ui-selected").siblings().removeClass("ui-selected");
        var path = $(this)[0].getAttribute('path');
        var fn = $(this)[0].getAttribute('filename');
        loadFile(path, fn);
    });
    
    $('#filelist ol').keydown(arrowKeyNav);
    
});
