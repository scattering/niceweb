//require('webdata_client');

webData_NG7 = function() {};
webData_NG7.prototype = new webData();
webData_NG7.prototype.constructor = webData_NG7;

webData_NG7.prototype.addPoint = function(lineid, state) {
    var series = this.series;
    var ser = series.streams[lineid];
    for (item in state) {
        if (!('columns' in ser)) { ser.columns = {}; }
        if (!(item in ser.columns)) { ser.columns[item] = []; }
        ser.columns[item].push(state[item]);
    }
    if (series.xaxis == null) { series.xaxis = this.getXAxis(state); }
    
    var MON = ('MON' in state) ? state['MON'] : 1.0;
    var new_x = state[series.xaxis];
    var new_y = state['DATA']/MON;
    
    var new_lin_xydata = [new_x, new_y];
    var new_log_xydata = [new_x, Math.log(new_y)/Math.LN10];
    
    ser.lin_xydata.push(new_lin_xydata);
    ser.log_xydata.push(new_log_xydata);
    
    if (this.in_datastream == true) {                  
        this.updatePlot(lineid, new_x, new_y);
    }
}

