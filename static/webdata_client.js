XAXIS_ORDER = ['A04', 'A03', 'A10', 'A08', 'A02', 'A01', 'QZ', 'QH', 'QK', 'QL']; // make these the x-axis, if they are available
for (var i=1; i<40; i++) {
    var xa = 'A' + (i < 10 ? '0' : '') + i.toFixed();
    if (XAXIS_ORDER.indexOf(xa) < 0) {
        XAXIS_ORDER.push(xa);
    }
}

function Series() {
    this.streams = {};
    this.xaxis = null;
    this.plottable_data = {
        'type': '1d',
        'title': "XPeek data",
        'options': {'axes': {'xaxis': {'label': 'x'}, 'yaxis': {'label':'Counts'}},'series': []},
        'clear_existing': false,
        'transform': 'lin',
        'lin_data': [],
        'log_data': [],
        'data': []
    }           
}

function gaussianPeak(x, params) {
    var bkg = params.FIT_P1 + params.FIT_P2*x + params.FIT_P3 * x * x;
    var peak = params.FIT_P4 * Math.exp( -Math.pow(((x-params.FIT_P5)*1.665109/params.FIT_P6), 2));
    return peak + bkg;
}
    
function cosPeak(x, params) {
    return params.FIT_P1 + params.FIT_P2 * Math.cos(x*params.FIT_P3 + params.FIT_P4);
}

webData = function() {};
webData.prototype = new Object();
webData.prototype.constructor = webData;
webData.prototype.init = function(opts) {
    this.fit_points = 101;
    this.preferred_xaxis = XAXIS_ORDER;
    this.trigger_remake = false;
    jQuery.extend(true, this, opts);
    this.fit_functions = {
            "FP": gaussianPeak,
            "ISCAN": cosPeak
        }
}

webData.prototype.resetData = function(state) {
    //console.log("reset data",state, state.records.length);
    if (!('records' in state)) { 
        //console.log('no records!'); return; 
    }
    //this.xaxis = null;
    for (var i=0; i < state.records.length; i++) {
        this.in_datastream = false; // don't turn this on until live.
        this.processRecord(state.records[i]);
    }
    this.in_datastream = true;
    this.remakePlot();
}

webData.prototype.remakePlot = function() {
    var ser;
    var series = this.series;
    series.plottable_data.options.axes.xaxis.label = series.xaxis;
    series.plottable_data.options.series = [];
    series.plottable_data.lin_data.length = 0;
    series.plottable_data.log_data.length = 0;
    for (sername in series.streams) {
        //var serdata = [];
        ser = series.streams[sername];
        series.plottable_data.options.series.push({'label': sername});
        series.plottable_data.lin_data.push(ser.lin_xydata);
        series.plottable_data.log_data.push(ser.log_xydata);
        series.plottable_data.title = String(ser.runid) + ' :: ' + String(ser.comment);
    }
    
    series.plottable_data.data = series.plottable_data.lin_data;
    
    this.plot = plottingAPI([series.plottable_data], 'plot');
}

webData.prototype.updatePlot = function(lineid, new_x, new_y) {
    if (this.trigger_remake == true) {
        this.trigger_remake = false;
        this.remakePlot();
    }
    var active_series;
    var plot = this.plot;
    for (var j=0; j<plot.series.length; j++) {
        if (plot.series[j].label == lineid) {
            active_series = plot.series[j];
            break;
        }
    }
    if (active_series == null) { console.log('series ' + lineid + ' not found.'); return; }
    if (this.series.plottable_data.transform == 'log') {
        active_series._plotData.push([new_x, Math.log(new_y) / Math.LN10]);
    } else {
        active_series._plotData.push([new_x, new_y]);
    }
                
    if (plot.plugins.cursor._zoom.isZoomed) {
        plot.drawSeries(j);
    } else {
        plot.resetAxesScale();
        plot.replot();
    }
}

webData.prototype.getXAxis = function(state, exclude_names) {
    var exclude_names = (exclude_names == null) ? [] : exclude_names;
    for (var i=0; i<this.preferred_xaxis.length; i++) {
        var xaxis = this.preferred_xaxis[i];
        if ((xaxis in state) && (exclude_names.indexOf(xaxis) < 0)) { 
            return xaxis 
        }
    }
    return Object.keys(state)[0]
}

webData.prototype.addPoint = function(lineid, state) {
    var series = this.series;
    //console.log('adding point, ', lineid, state);
    /*if (!(lineid in series.streams)) { 
        series.streams[lineid] = {};
        //remake_plot = true; 
    }*/
    var ser = series.streams[lineid];
    for (item in state) {
        if (!('columns' in ser)) { ser.columns = {}; }
        if (!(item in ser.columns)) { ser.columns[item] = []; }
        ser.columns[item].push(state[item]);
    }
    if (series.xaxis == null) { series.xaxis = this.getXAxis(state); }
    
    var new_x = state[series.xaxis];
    var new_y = state['DATA'];
    
    var new_lin_xydata = [new_x, new_y];
    var new_log_xydata = [new_x, Math.log(new_y)/Math.LN10];
    
    ser.lin_xydata.push(new_lin_xydata);
    ser.log_xydata.push(new_log_xydata);
    
    if (this.in_datastream == true) {                  
        this.updatePlot(lineid, new_x, new_y);
    }
}

webData.prototype.makeFitData = function(fields, xmin, xmax) {
    var fit_ser = new Object();
    fit_ser.columns = {};
    fit_ser.lin_xydata = [];
    fit_ser.log_xydata = [];
    
    var fit_fn = this.fit_functions[fields.TYPE]
    var range = xmax - xmin;
    var stepsize = range / (this.fit_points - 1);
    for (var i=0; i<this.fit_points; i++) {
        var x = xmin + stepsize * i;
        fit_ser.lin_xdata.push([x, fit_fn(x)]);
        fit_ser.log_xdata.push([x, Math.log(fit_fn(x)) / Math.LN10]); 
    }
    return fit_ser;
}

webData.prototype.processRecord = function(record) {
    var lineid = record.lineid;
    if (record.command == 'Configure') {
        //console.log('configure', record);
        this.series = new Series();
        exclude_names = [];
        jQuery.extend(true, this.series.plottable_data.options, this.plot_opts);
    } else if (record.command == 'newdata') {
        var ser = new Object();
        this.series.streams[lineid] = ser;
        ser.columns = {};
        ser.lin_xydata = [];
        ser.log_xydata = [];
        ser['comment'] = record.comment;
        ser['runid'] = record.runid;
        this.trigger_remake = true;
        // do all this in "configure"?
    } else if (record.command == 'enddata') {
        data_ended = true;
        var peaktypes = ['FP', 'ISCAN'];
        if (!('fields' in record) || peaktypes.indexOf(record.fields.TYPE) < 0) { 
            return 
        } else {
            var xdata = this.series.streams[lineid].columns[this.series.xaxis];
            var xmin = Math.min.apply(Math, xdata);
            var xmax = Math.max.apply(Math, xdata);
            var peak_ser = makeFitData(record.fields, xmin, xmax);                        
            this.series.streams[lineid + '_fit'] = peak_ser;
            this.remakePlot();
        }  
    } else if (record.command == 'newpoint') {
        //in_datastream = true;
        this.addPoint(lineid, record.pointdata);
        if ('eta' in record) { $('#extras').html("<b>ETA: </b>" + String(record.eta)); }
    } else { 
        console.log("update data, unrecognized command: ",record); 
    }
}

