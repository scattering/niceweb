//require('webdata_client');

//webData_BT1 = function(opts) {
//    webData.prototype.call(this, opts);
//}

webData_poisserr = function() {};
webData_poisserr.prototype = new webData();
webData_poisserr.prototype.constructor = webData_poisserr;

function getErrLabel(lineid) {
    return lineid + '_err';
}

function getPoissonUncertainty(y) {
    // for a poisson-distributed observable, get the range of 
    // expected actual values for a particular measured value.
    // As described in the documentation for the error analysis
    // on the BaBar experiment:
    /*
    4)      An alternative with some nice properties is +-0.5 + sqrt(n+0.25)
    i.e upper error = 0.5 + sqrt(n+0.25), lower error = -0.5 + sqrt(n+0.25).
    These produce the following intervals:  
    n    low      high     cred.        
    0 0.000000  1.000000 0.632121
    1 0.381966  2.618034 0.679295
    2 1.000000  4.000000 0.681595
    3 1.697224  5.302776 0.682159
    4 2.438447  6.561553 0.682378
    5 3.208712  7.791288 0.682485
    6 4.000000  9.000000 0.682545
    7 4.807418 10.192582 0.682582
    8 5.627719 11.372281 0.682607
    9 6.458619 12.541381 0.682624
    */
    var hi =  0.5+Math.sqrt(y+0.25);
    var lo = -0.5+Math.sqrt(y+0.25);
    return {yupper: y+hi, ylower: y-lo, hi: hi, lo: lo};
}

function getLogPoissonUncertainty(y) {
    // apply small offset to keep log(zero) from being -infinity
    // we'll make it -1 instead, just for kicks.
    if (y <= 0) { return {ylower: 0, yupper: -1}}
    else { 
        var hi =  0.5+Math.sqrt(y+0.25);
        var lo = -0.5+Math.sqrt(y+0.25);
        return {yupper: Math.log(y+hi)/Math.LN10, ylower: Math.log(y-lo)/Math.LN10}
    }
}   

webData_poisserr.prototype.transformData = function(transform) {
    this._transform = transform;
    var new_x, new_y, err;
    if (transform == 'log') {
        for (var i=0; i<this.series.length; i++) {
            var pd = this.series[i]._plotData;
            var d = this.data[i];
            for (var j=0; j<pd.length; j++) {
                new_y = d[j][1];
                new_x = d[j][0];
                err = getLogPoissonUncertainty(new_y);
                pd[j][1] = new_y > 0 ? Math.log(new_y) / Math.LN10 : null;
                pd[j][2] = {xupper: new_x, xlower: new_x, yupper: err.yupper, ylower: err.ylower};
            }
        }
        this.axes.yaxis.resetScale();
        this.replot();
    } else { // transform == 'lin'
        for (var i=0; i<this.series.length; i++) {
            var pd = this.series[i]._plotData;
            var d = this.data[i];
            for (var j=0; j<pd.length; j++) {
                new_y = d[j][1];
                new_x = d[j][0];
                err = getPoissonUncertainty(new_y);
                pd[j][1] = new_y;
                pd[j][2] = {xupper: new_x, xlower: new_x, yupper: err.yupper, ylower: err.ylower};
            }
        }
        this.axes.yaxis.resetScale();
        this.replot();
    }
}

/*webData_poisserr.prototype.remakePlot = function() {
    webData.prototype.remakePlot.call(this);
    this.plot.setTransform = transformPoissErrData;
    this.plot.setTransform(this.series.plottable_data.transform);
}
*/

webData_poisserr.prototype.updatePlot = function(lineid, new_x, new_y) {
    if (this.trigger_remake == true) {
        this.trigger_remake = false;
        this.remakePlot();
    }
    var active_series, active_err;
    var err = getPoissonUncertainty(new_y);
    var log_err = getLogPoissonUncertainty(new_y);
    var err_label = getErrLabel(lineid);
    var plot = this.plot;
    for (var j=0; j<plot.series.length; j++) {
        if (plot.series[j].label == lineid) {
            active_series = plot.series[j];
            break;
        }
    }
    for (var k=0; k<plot.series.length; k++) {
        if (plot.series[k].label == err_label) {
            active_err = plot.series[k];
            break;
        }
    }
    if (active_series == null) { console.log('series ' + lineid + ' not found.'); return; }
    if (this.series.plottable_data.transform == 'log') {
        active_series._plotData.push([new_x, Math.log(new_y) / Math.LN10]);
        active_err._plotData.push([new_x, new_y, {xupper: new_x, xlower: new_x, yupper: log_err.yupper, ylower: log_err.ylower}]);
    } else {
        active_series._plotData.push([new_x, new_y]);
        active_err._plotData.push([new_x, new_y, {xupper: new_x, xlower: new_x, yupper: err.yupper, ylower: err.ylower}]);
    }
                
    if (plot.plugins.cursor._zoom.isZoomed) {
        plot.drawSeries(j);
        plot.drawSeries(k);
    } else {
        plot.resetAxesScale();
        plot.replot();
    }
}

webData_poisserr.prototype.addPoint = function(lineid, state) {
    webData.prototype.addPoint.call(this, lineid, state);
    this.addErrPoint(lineid, state);
}

webData_poisserr.prototype.addPoint = function(lineid, state) {
    var err_label = getErrLabel(lineid);
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
    var new_err = getPoissonUncertainty(new_y);
    var new_log_err = getLogPoissonUncertainty(new_y);
    
    var new_lin_xydata = [new_x, new_y];
    var new_log_xydata = [new_x, Math.log(new_y)/Math.LN10];
    
    ser.lin_xydata.push(new_lin_xydata);
    ser.log_xydata.push(new_log_xydata);
    
    var err_ser = series.streams[err_label];
    err_ser.lin_xydata.push([new_x, new_y, {xerr:0, yerr: [new_err.lo, new_err.hi]}]);
    err_ser.log_xydata.push([new_x, Math.log(new_y)/Math.LN10, {xerr:0, yerr: 0}]);
    
    if (this.in_datastream == true) {                  
        this.updatePlot(lineid, new_x, new_y);
    }
}

webData_poisserr.prototype.processRecord = function(record) {
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
        ser.plot_opts = {
            renderer: jQuery.jqplot.LineRenderer,
            label: lineid}
        
        var err_ser = new Object();
        var err_label = getErrLabel(lineid);
        this.series.streams[err_label] = err_ser;
        err_ser.columns = {};
        err_ser.lin_xydata = [];
        err_ser.log_xydata = [];
        err_ser['comment'] = record.comment;
        err_ser['runid'] = record.runid;
        err_ser.plot_opts = {
            renderer: jQuery.jqplot.errorbarRenderer,
            rendererOptions: { errorBar: true, /*bodyWidth: 1, wickColor: 'red', openColor: 'yellow', closeColor: 'blue'*/ },
            label: err_label}
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

