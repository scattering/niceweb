XAXIS_ORDER = ['A04', 'A03', 'A10', 'A08', 'A02', 'A01', 'QZ', 'QH', 'QK', 'QL', 'CUR']; // make these the x-axis, if they are available
for (var i=1; i<40; i++) {
    var xa = 'A' + (i < 10 ? '0' : '') + i.toFixed();
    if (XAXIS_ORDER.indexOf(xa) < 0) {
        XAXIS_ORDER.push(xa);
    }
}

function Series() {
    this.streams = {};
    this.xaxis = null;
    this.live_data = {
        'type': '1d',
        'title': "XPeek data",
        'options': {'axes': {'xaxis': {'label': 'x'}, 'yaxis': {'label':'Counts'}},'series': []},
        'clear_existing': false,
        'transform': 'lin',
        'lin_data': [],
        'log_data': [],
        'data': []
    }
    this.toPlots = [this.live_data]; // for now, until we have multiples...  
}

function gaussianPeak(x, params) {
    var bkg = params.FIT_P1 + params.FIT_P2*x + params.FIT_P3 * x * x;
    var peak = params.FIT_P4 * Math.exp( -Math.pow(((x-params.FIT_P5)*1.665109/params.FIT_P6), 2));
    return peak + bkg;
}
    
function cosPeak(x, params) {
    return params.FIT_P1 + params.FIT_P2 * Math.cos(x*params.FIT_P3 + params.FIT_P4);
}

function on_plotselector_change(e) {
    var selectz = e.data.selectz;
    var selectnum = e.data.selectnum;
    var that = e.data.that;
    var toPlots = that.series.toPlots;
    var transform = selectz.value;
    var plotnum = selectnum[selectnum.selectedIndex].value;
    var toPlot = toPlots[plotnum];
    toPlot.transform = transform;
    that.plot = that.render1dplot(toPlot, transform, that.grid_id);
    if (toPlot.metadata) {
        var metadata_table = make_metadata_table(toPlot.metadata);
        metadata.innerHTML = "";
        metadata.appendChild(metadata_table);
    }
}

webData = function() {};
webData.prototype = new Object();
webData.prototype.constructor = webData;
webData.prototype.init = function(dataChannel, opts) {
    this.dataChannel = dataChannel;
    this.plotdiv = 'plot';
    this.fit_points = 101;
    this.preferred_xaxis = XAXIS_ORDER;
    this.trigger_remake = false;
    jQuery.extend(true, this, opts);
    var resetData = this.resetData;
    var processRecord = this.processRecord;
    var that = this;
    /*dataChannel.on('connect', function () {
        dataChannel.emit('subscribe', function(state) {resetData.call(that, state)});
    });*/
    dataChannel.on('reset', function(state) {resetData.call(that, state)});
    dataChannel.on('record', function(record) {processRecord.call(that, record)});
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
    var ser, sername;
    var series = this.series;
    series.live_data.options.axes.xaxis.label = series.xaxis;
    series.live_data.options.series = [];
    series.live_data.lin_data.length = 0;
    series.live_data.log_data.length = 0;
    var sernames = Object.keys(series.streams);
    function sortByZ(a,b) {
        var za = ('z_index' in series.streams[a].plot_opts) ? series.streams[a].plot_opts.z_index : -1;
        var zb = ('z_index' in series.streams[b].plot_opts) ? series.streams[b].plot_opts.z_index : -1;
        return za - zb;
    }
    sernames.sort(sortByZ);
    for (var i=0; i<sernames.length; i++) {
        sername = sernames[i];
        ser = series.streams[sername];
        series.live_data.options.series.push(ser.plot_opts);
        series.live_data.lin_data.push(ser.lin_xydata);
        series.live_data.log_data.push(ser.log_xydata);
        series.live_data.title = String(ser.runid) + ' :: ' + String(ser.comment);
    }
    
    series.live_data.data = series.live_data.lin_data;
    
    //this.plot = plottingAPI([series.live_data], 'plot');
    this.plot = null;
    var plot_env = this.create1dPlotRegion(this.plotdiv);
    this.grid_id = plot_env.grid_id;    
    this.plot = this.update1dPlot([series.live_data], this.plotdiv, 0);
    jQuery(plot_env.plot_selectz).change({'that': this, 'selectz':plot_env.plot_selectz, 'selectnum': plot_env.plot_selectnum}, on_plotselector_change);
    jQuery(plot_env.plot_selectnum).change({'that': this, 'selectz':plot_env.plot_selectz, 'selectnum': plot_env.plot_selectnum}, on_plotselector_change);
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
    if (this.series.live_data.transform == 'log') {
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
        jQuery.extend(true, this.series.live_data.options, this.plot_opts);
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
            label: lineid,
            z_index: 1}
        jQuery.extend(true, ser.plot_opts, record.series_opts);
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
        if ('eta' in record) { $('#'+this.plotdiv+'_eta').html("<b>ETA: </b>" + String(record.eta)); }
    } else if (record.command == 'reset') {
        //in_datastream = true;
        this.resetData(record);
    } else { 
        console.log("update data, unrecognized command: ", record); 
    }
}

//////////////////////////////////////////////////////////////////
// Plotting stuff: from plotting_api2.js                        //
//////////////////////////////////////////////////////////////////

function make_metadata_table(metadata, numcols) {
    var numcols = numcols || 4;
    var new_table = document.createElement('table');
    var keys = Object.keys(metadata);
    var num_items = keys.length;
    for (var i=0; i<num_items; i+=numcols) {
        var row = new_table.insertRow(-1);
        for (var j=0; j<numcols; j++) {
            var index = i + j;
            if (index >= num_items) { break; }
            var key = keys[index];
            
            var value = metadata[key];
            var label = row.insertCell(-1);
            label.setAttribute('class', 'metadata-label');
            label.innerHTML=key;
            var entry = row.insertCell(-1);
            entry.setAttribute('class', 'metadata-value');
            entry.innerHTML=value;
        }
    }
    return new_table;
}

webData.prototype.render1dplot = function(data, transform, plotid, plot_options) {
    var options = {
        title: data.title,
        seriesDefaults: {shadow: false, markerOptions: {shadow: false, size: 8}},
        axes:{
          xaxis:{
            renderer: $.jqplot.LinearAxisRenderer,  // renderer to use to draw the axis,
            label: data.xlabel,
            labelRenderer: $.jqplot.CanvasAxisLabelRenderer,
            tickRenderer: $.jqplot.CanvasAxisTickRenderer,
            tickOptions: {
                formatString: "%.2g"
            }
          },
          yaxis:{
            renderer: (transform == 'log') ? $.jqplot.LogAxisRenderer : $.jqplot.LinearAxisRenderer,
            label: data.ylabel,
            labelRenderer: $.jqplot.CanvasAxisLabelRenderer,
            tickRenderer: $.jqplot.CanvasAxisTickRenderer,
            tickOptions: {
                formatString: "%.2g",
                // fix for ticks drifting to the left in accordionview!
                _styles: {right: 0},
            }
          }
        },
        cursor: {
            show: true,
            zoom: true,
            clickReset: true,
            tooltipLocation:'se',
            tooltipOffset: -60,
            useAxesFormatters: false,
        },
        legend: {
            show: true,
            parent: this,
            placement: 'outside',
            renderer: $.jqplot.InteractiveLegendRenderer
        },
        grid: {shadow: false},
        sortData: false,
        //interactors: [ {type: 'Rectangle', name: 'rectangle'} ],
        type: '1d'
    };
    
    jQuery.extend(true, options, data.options);
    jQuery.extend(true, options, plot_options);
    $('#'+plotid).empty();
    var plot_obj = $.jqplot(plotid, data.data, options);
    plot_obj.type = '1d';
    function handleLegendClick(ev) {
        var series_num = ev.target.getAttribute('series_num') || 0;
        //var mplot = ev.data.plot;
        var mplot = plot_obj;
        mplot.series[series_num].show = !mplot.series[series_num].show;
        mplot.replot();
        //$('.jqplot-table-legend-label').click({plot: plot1d}, handleLegendClick);
    }
    //$('.jqplot-table-legend-label').click({plot: plot1d}, handleLegendClick);
    plot_obj.legend.handleClick = handleLegendClick;
    plot_obj.setTransform = this.transformData
    plot_obj.setTransform(transform);
    return plot_obj
};

webData.prototype.transformData = function(transform) {
    this._transform = transform;
    if (transform == 'log') {
        for (var i=0; i<this.series.length; i++) {
            var pd = this.series[i]._plotData;
            var d = this.data[i];
            for (var j=0; j<pd.length; j++) {
                pd[j][1] = d[j][1]>0 ? Math.log(d[j][1]) / Math.LN10 : null;
            }
        }
        this.axes.yaxis.resetScale();
        this.axes.yaxis.labelOptions.label = 'Log₁₀' + String(this.options.axes.yaxis.label);
        this.replot();
    } else { // transform == 'lin'
        for (var i=0; i<this.series.length; i++) {
            var pd = this.series[i]._plotData;
            var d = this.data[i];
            for (var j=0; j<pd.length; j++) {
                pd[j][1] = d[j][1];
            }
        }
        this.axes.yaxis.resetScale();
        this.axes.yaxis.labelOptions.label = String(this.options.axes.yaxis.label);
        this.replot();
    }
}

webData.prototype.create1dPlotRegion = function(target_id) {
    var plotdiv = document.getElementById(target_id);
    plotdiv.innerHTML = "";
    jQuery('#'+target_id).css({"display": "block", "width": "100%", "height": "400px"});
    jQuery('#'+target_id).addClass('ui-widget-content');
    var grid_id = target_id + '_grid';
    var metadata_id = target_id + '_metadata';
    var buttons_id = target_id + '_buttons';
    var plotgrid = jQuery('<div />', {style:"float: left; width:85%; height: 350px; ", id:grid_id})[0];
    var plotbuttons = jQuery('<div />', {style:"display: block; width: 410px; height: 50px;", id:buttons_id})[0];
    var metadata = jQuery('<div />', {id:metadata_id, class:"slidingDiv"})[0];
    plotdiv.appendChild(plotgrid);
    plotdiv.appendChild(plotbuttons);
    plotdiv.appendChild(metadata);
    var plot_selectz = jQuery('<select />', {id:target_id + "_selectz"})[0];
    var plot_selectnum = jQuery('<select />', {id:target_id + "_selectnum"})[0];
    var plot_eta = jQuery('<span />', {class: "eta", id:target_id + '_eta'})[0];
    plotbuttons.appendChild(plot_selectz);
    plotbuttons.appendChild(plot_selectnum);
    plotbuttons.appendChild(plot_eta);
    plotbuttons.appendChild(jQuery('<a />', {href:"#", class:"show_hide"}).text("Show/hide metadata")[0]);
    plot_selectz.appendChild(jQuery('<option />', { value: 'lin', text: 'lin' })[0]);
    plot_selectz.appendChild(jQuery('<option />', { value: 'log', text: 'log' })[0]);
    /*if (jQuery(plotbox).resizable) {
        jQuery(plotbox).resizable({
            alsoResize: jQuery('#'+grid_id),
            start: function() { jQuery(plotgrid).css('opacity', '0.0'); },
            stop: function() {
                that.plot.replot();
                jQuery(plotgrid).css('opacity', '1.0');
                that.plot.replot();}
        });
    }*/
    
    
    
    
    return {'grid_id': grid_id, 'plot_selectz': plot_selectz, 'plot_selectnum': plot_selectnum};
}

webData.prototype.update1dPlot = function(toPlots, target_id, plotnum) {    
    var grid_id = this.grid_id;
    var plotnum = plotnum || 0;
    var toPlot = toPlots[plotnum];
    var toPlots = toPlots;
    var transform = toPlot.transform || 'lin';
    if (toPlot.metadata) {
        var metadata_table = make_metadata_table(toPlot.metadata);
        document.getElementById('metadata').innerHTML = "";
        document.getElementById('metadata').appendChild(metadata_table);
        jQuery(".show_hide").show();
    } else {
        jQuery(".show_hide").hide();
    }  
    
    document.getElementById(target_id + '_selectnum').innerHTML = "";
    for (var i=0; i<toPlots.length; i++) {
        var label = toPlots[i].options.title || '';
        jQuery(document.getElementById(target_id + '_selectnum')).append(jQuery('<option />', { value: i, text: 'dataset: ' + i + " " + label }));
    }
    
    this.plot = this.render1dplot(toPlot, transform, this.grid_id);
    
    var selectedIndex;
    if ( transform == 'log') { selectedIndex = 1 }
    else { selectedIndex = 0 }
    document.getElementById(target_id + '_selectz').selectedIndex = selectedIndex;
    
    var that=this;
    if (jQuery('#'+target_id).resizable) {
        jQuery('#'+target_id).resizable({
            alsoResize: '#'+grid_id,
            //start: function() { jQuery(plotgrid).css('opacity', '0.0'); },
            stop: function() {
                that.plot.replot();
                //jQuery(plotgrid).css('opacity', '1.0');
                that.plot.replot();}
        });
    }
    return this.plot; 
}

