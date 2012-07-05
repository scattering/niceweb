/**
 * Created with JetBrains WebStorm.
 * User: Esther Wang
 * Date: 7/2/2012.
 */

//Status: Connects to the server and displays when the device is changing.

Ext.onReady(function() {
    var instrument = 'sans10m';  // FIXME: should be a parameter
    var root = 'http://' + window.location.hostname + ':8001/' + instrument;
    var device = new io.connect(root+'/device');
    var control = new io.connect(root+'/control');
    var events = new io.connect(root+'/events');

    device.on('connect', function() {
        log("device connect");
        device.emit('subscribe', function (data) {
            log("device subscribe", data);
        });
    });

    device.on('changed', function(data) {
        log("device changed", data);
    });


    Ext.regModel('deviceModel', {
        fields: [
            {name: 'device name', position: 'device position'},
            'database id',
            {name:'sha1',type:'string'}
        ]
    });

    var store = Ext.create('Ext.data.Store', { model: 'deviceModel'});

    //creates grid with headings
    var gridColumns = [];

    gridColumns.push({header: 'Device Position', width: 150, sortable: true, dataIndex: 'devicePos'});
    gridColumns.push({header: 'Device Position', width: 150, sortable: true, dataIndex: 'devicePos'});

    var grid = new Ext.grid.GridPanel({
        store: store,
        columns: gridColumns,
        stripeRows: true,
        height: 500,
        autoWidth: true,
        title: 'Available files',
        bbar: [],
    });

    grid.render("grid");

    function log(msg) {
        $("#console").append('<div class="debug">'+msg+'</div>');
        $("#console").scrollTop = 99999999;
    }

    function update() {
    //dataArray=[['file name','database id','sha1','x','y','z'],[NaN,NaN,NaN,10,10,10],[NaN,NaN,NaN,-10,-10,-10],['file1','1','sh1','1,9','2,3','3,4'],['file2','1','sh2','4,5','2,3','5,5']];
        var conn = new Ext.data.Connection();
        conn.request({
            url: '/json/',
            method: 'GET',
            params: {},
            success: function(responseObject) {
                dataArray = Ext.decode(responseObject.responseText);//decodes the response
                reload_data();                                      //resets the store and grids
            },
            failure: function() {
            }
        });
    reload_data();
    }

    function reload_data(){
        var fieldData = dataArray[0]; //First row is the parameters of the data file (e.g. ['X', 'Y', 'Z', 'Temp'])
        maxvals = dataArray[1];       //Second row is the max values of the parameters over all files (used for rendering ranges)
        minvals = dataArray[2];       //Third row is min values of parameters
        dataArray.splice(0, 3);        //The rest is the actual data
        var gridColumns = [];
        storeFields = [];
    /*The first three parameters (File Name, database ID, and md5 sum) aren't renedered using the
     standard renderer and the ID and md5 sum aren't displayed at all, they are only used for server
     requests later, so we add them to the Store differently*/
        gridColumns.push({header: fieldData[0], width: 150, sortable: true, dataIndex: fieldData[0]});
        storeFields.push({name: fieldData[0]});
        gridColumns.push({header: fieldData[1], width: 150,hidden:true, sortable: true, dataIndex: fieldData[1]});
        storeFields.push({name: fieldData[1]});
        gridColumns.push({header: fieldData[2], width: 150,hidden:true, sortable: true, dataIndex: fieldData[2]});
        storeFields.push({name: fieldData[2]});
        for (var i = 3; i < fieldData.length; ++i) {
            gridColumns.push({header: fieldData[i], width: 100, renderer: vrange, sortable: true, dataIndex: fieldData[i]});
            storeFields.push({name: fieldData[i]});
    }
    }

});