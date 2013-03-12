//require('webdata_client');

//webData_BT1 = function(opts) {
//    webData.prototype.call(this, opts);
//}

webData_BT1 = function() {};
webData_BT1.prototype = new webData();
webData_BT1.prototype.constructor = webData_BT1;

webData_BT1.prototype.init = function(opts) {
    this.detectors = 32;
    this.fit_points = 101;
    this.preferred_xaxis = XAXIS_ORDER;
    this.trigger_remake = false;
    this.plot_opts = {
        "legend": {"show": false},
        "seriesDefaults": {
            "markerOptions": {"size": 4 },
            "lineWidth": 1}
    };
    jQuery.extend(true, this, opts);
    this.fit_functions = {
            "FP": gaussianPeak,
            "ISCAN": cosPeak
        }
    this.detector_spacing = 5.0;
    this.BT1_scale = [
        2.700,  2.479,  2.827,  2.483,  2.260,  2.347,  2.011,  1.749,
        1.630,  1.360,  1.339,  1.218,  1.058,  1.000,  1.054,  0.953,
        0.941,  0.985,  1.031,  1.021,  0.982,  1.011,  0.900,  1.118,
        0.955,  1.056,  0.973,  0.974,  0.943,  0.877,  0.872,  0.820, 
    ]
    // BT1 detector zeros in hundredths of a degree
    this.BT1_zeros = [
        0.00,   1.00,   1.29,  -0.48,   1.53,  -0.98,   2.03,   0.89,
        1.54,   1.28,   0.40,   0.35,   1.53,  -1.57,   0.63,   1.43,
       -0.08,  -0.01,  -0.78,   0.16,  -1.08,  -2.08,  -1.23,  -0.47,
        0.43,  -0.27,  -2.60,   0.88,  -1.34,   2.24,   3.00,   4.00,
    ]; // * 0.01
}

webData_BT1.prototype.processRecord = function(record) {
    var lineid = record.lineid;
    if (record.command == 'Configure') {
        this.series = new Series();
        exclude_names = [];
        jQuery.extend(true, this.series.plottable_data.options, this.plot_opts);
    } else if (record.command == 'newdata') {
        for (var i=0; i<this.detectors; i++) {
            var new_lineid = lineid + '_' + (i+1).toFixed();
            var ser = new Object();
            this.series.streams[new_lineid] = ser;
            ser.columns = {};
            ser.lin_xydata = [];
            ser.log_xydata = [];
            ser['comment'] = record.comment;
            ser['runid'] = record.runid;
        }
        this.trigger_remake = true;
        // do all this in "configure"?
    } else if (record.command == 'enddata') {
        return
    } else if (record.command == 'newpoint') {
        //in_datastream = true;
        this.addPoint(lineid, record.pointdata);
        $('#extras').html("<b>ETA: </b>" + String(record.eta));
    } else { 
        console.log("update data, unrecognized command: ",record); 
    }
}


webData_BT1.prototype.addPoint = function(lineid, state) {
    var series = this.series;
    if (series.xaxis == null) { series.xaxis = this.getXAxis(state); }
    
    for (var i=0; i<this.detectors; i++) {
        var new_lineid = lineid + '_' + (i+1).toFixed();
        var ser = series.streams[new_lineid];
        var A04_offset = i*this.detector_spacing - this.BT1_zeros[i]*0.01;
        var substate = {};
        jQuery.extend(true, substate, state);
        substate.DATA = state.DATA[i] * this.BT1_scale[i];
        substate.A04 = state.A04 + A04_offset;
        for (item in substate) {
            if (!('columns' in ser)) { ser.columns = {}; }
            if (!(item in ser.columns)) { ser.columns[item] = []; }
            ser.columns[item].push(substate[item]);
        }
    
        var new_x = substate[series.xaxis];
        var new_y = substate['DATA'];
        
        var new_lin_xydata = [new_x, new_y];
        var new_log_xydata = [new_x, Math.log(new_y)/Math.LN10];
        
        ser.lin_xydata.push(new_lin_xydata);
        ser.log_xydata.push(new_log_xydata);
        
        if (this.in_datastream == true) {                  
            this.updatePlot(new_lineid, new_x, new_y);
        }
    }
}

