//my file
Ext.Loader.setConfig({
    enabled: true
});

//Ext.Loader.setPath('Ext.ux', '/static/ext/examples/ux'); //'../ux');

Ext.require([
    'Ext.grid.*',
    'Ext.data.*',
    'Ext.util.*',
    'Ext.ux.RowExpander'
]);

Ext.onReady(function () {
    /* FILE ASSOCIATIONS TABLE, Andrew Tracer, 6/8/2011

     Field:
     -filename, the name of the file
     - accepts any string
     -filetype, the type of file (e.g., measurement or background)
     - combobox options MEA or BAC
     -group, associating a bunch of files (e.g., measurement and
     background from one experiment)
     - accepts lone integers and comma separated integers

     Editing:
     -Double-click on a cell to edit an individual record's field values.
     -Shift + right-click will allow you to edit the filetype and group of all selected rows.
     -the group field will accept a single integer or a list of integers.
     The latter option is to allow association of a single file
     with multiple groups

     */

    var GridSpace = GridSpace || {};

    GridSpace.instrument = 'sans10m';  // FIXME: should be a parameter
    GridSpace.root = 'http://' + window.location.hostname + ':8001/' + GridSpace.instrument;
    GridSpace.device = new io.connect(GridSpace.root + '/device');
    GridSpace.control = new io.connect(GridSpace.root + '/control');
    GridSpace.events = new io.connect(GridSpace.root + '/events');
    GridSpace.dataArray = [];
    GridSpace.deviceNames = [];

    Ext.regModel('deviceModel', {
        fields:[
            {name:'device', type:'string'},
            'position',
            {name:'target', type:'string'}
        ]
    });

    if(Ext.isSafari){
        Ext.override(Ext.grid.GridView, {
            layout : function(){
                this.scroller.dom.style.position = 'static';
            }
        });
    }

    GridSpace.store = Ext.create('Ext.data.Store', { model:'deviceModel'});

    GridSpace.gridColumns = [];

    GridSpace.gridColumns.push({header:'device', width:150, sortable:true, dataIndex:'device'});
    GridSpace.gridColumns.push({header:'position', width:150, hidden:false, sortable:true, dataIndex:'position'})
    GridSpace.gridColumns.push({header:'target', width:150, hidden:false, sortable:true, dataIndex:'target'})

    GridSpace.tpl =
        ['<tpl for="nodes">',
            '<p><b>{[values.id+"hello"]}:</b>  {currentValue.val}</p>',
            '</tpl></p>'];

//    tpl.overwrite(panel.body, data.kids);

    //field: {xtype: 'numberfield', allowBlank: false}});
    /*GridPanel that displays the data*/
    GridSpace.grid = new Ext.grid.GridPanel({
        store: GridSpace.store,
        columns: GridSpace.gridColumns,
        stripeRows:true,
        height:500,
        width:475,
        listeners: {
            itemclick: function(view, cell, rowIdx, cellIndex, e) {

                this.plugins[0].toggleRow(rowIdx);
            }
//            itemdblclick: function(view, cell, rowIdx, cellIndex, e) {
//
//                //alert('double clicking');
//                return true;
//            }
        },
        //if other plugins are added, check listener (this.plugins[0]) and make sure
        //that the 0 index plugin is still rowexpander
        plugins: [{
            ptype: 'rowexpander',
            rowBodyTpl : GridSpace.tpl
//                info
//    ['<p><b>Device:</b> {device}</p><br>',
//    '<p><b>Target:</b> {target}</p><br>',
//    '<p><b>Nodes:</b> {nodes}</p>'
//    ]
        }],
        title:'Devices',
        collapsible: true,
        animCollapse: false
    });

    GridSpace.grid.render('gridtest');


    GridSpace.device.on('connect', function () {
        console.log("device connect");
        GridSpace.device.emit('subscribe', GridSpace.setDeviceModel);

    });


    GridSpace.device.on('changed', function (data) {
        data=GridSpace.trim_data(data);
        console.log("device changed");

        var changedData = [];
        var datum = {};
        var changedKeys=Object.keys(data);
        for (var i=0; i < changedKeys.length; i++){
            if (changedKeys[i] !== "detector") {
                datum['position'] = data[changedKeys[i]].currentValue.val;
                datum['target'] = data[changedKeys[i]].desiredValue.val;
                datum['device'] = data[changedKeys[i]].id;
                changedData.push(datum);
                record=grid.store.getAt(i);
                record.set('position',datum['position']);
                record.set('target',datum['target']);
                record.commit();

            }
        }
        return;
        //updates dataArray based on the changed positions from changedData
        for (var i=0; i < changedData.length; i++) {
            var x = deviceNames.indexOf(changedData[i]['device']);
            dataArray[x] = changedData[i]
        }
        var localData=dataArray.clone();
        return;
        //grid.store.loadData(localData);
        //grid.getView().refresh();
        //for (var i=0; i < data.length; i++) show_node(data[i]);
    });

    GridSpace.setDeviceModel = function (data) {
        data=GridSpace.trim_data(data);
        console.log("device subscribe", data);
        GridSpace.dataArray = [];
        var properties = [];
        //var datum = {};
        GridSpace.deviceNames = GridSpace.sorted_keys(data);
        for (var i = 0; i < GridSpace.deviceNames.length; i++) {
            var datum = {};
            if (GridSpace.deviceNames[i] !== "detector") {
                datum['device'] = GridSpace.deviceNames[i];
                var primaryNode = data[GridSpace.deviceNames[i]]['primary'];
                if (primaryNode === 'softPosition') {
                    var dict = data[GridSpace.deviceNames[i]]['nodes'];
                    //datum.nodes = dict;
                    var children = [];
                    var nodeNames = GridSpace.sorted_keys(dict);
                    for (var j = 0; j < nodeNames.length; j++) {
                        children.push(dict[nodeNames[j]]);
                    }
                    datum.nodes = children;
                    datum['position'] = dict[primaryNode]['currentValue']['val'];
                    datum['target'] = dict[primaryNode]['desiredValue']['val'];
                }
                //           else {
                //               datum['position'] = data[keys[i]][primaryNode]
                //           }
                GridSpace.dataArray.push(datum);
            }
        }
        //displayNodes(properties);

        GridSpace.deviceNames.splice(GridSpace.deviceNames.indexOf('detector'), 1);
        var localData=GridSpace.dataArray.clone();
        GridSpace.grid.store.loadData(localData);
        GridSpace.grid.getView().refresh();
    };

    //The following line is evil and worse, it is impolite.    We should try to replace it!!!
    Object.prototype.clone = function() {
        var newObj = (this instanceof Array) ? [] : {};
        for (i in this) {
            if (i == 'clone') continue;
            if (this[i] && typeof this[i] == "object") {
                newObj[i] = this[i].clone();
            } else newObj[i] = this[i]
        } return newObj;
    };

    GridSpace.trim_data = function (data) {
        $.each(data, function (idx,node) {
            if (node.currentValue === undefined || node.currentValue == null) {
                node.currentValue = { 'val': 'undefined' };
            } else if ($.isArray(node.currentValue.val) && node.currentValue.val.length > 5) {
                node.currentValue.val = "[...]";
            }
            if (node.desiredValue === undefined || node.desiredValue == null) {
                node.desiredValue = { 'val': 'undefined' };
            } else if ($.isArray(node.desiredValue.val) && node.desiredValue.val.length > 5) {
                node.desiredValue.val = "[...]";
            }
        });
        return data;
    };

    GridSpace.sorted_keys = function (obj) {
        var keys = [];
        for (var i in obj) {
            if (obj.hasOwnProperty(i)) {
                keys.push(i);
            }
        }

        // may have to craft a custom sort function to get the right order
        keys.sort();
        return keys;
    };

//    function displayNodes(properties)
//    {
//        var labels = [];
//
//        for (var i=0; i < properties.length; i++) {
//            var nodes = properties[i];
//            var nodeKeys = sorted_keys(nodes);
//            for (var j=0; i < nodeKeys.length; i++) {
//                labels.push(nodeKeys[j]);
//            }
//
//        }
//        return labels;

//        for (var item in properties) {
//            if (typeof properties[item] !== "function") {
//                labels.push(item);
//
//            }
//        }

//    }

    /*After data is retrieved from server, we have to reinitiallize the Store reconfigure the ArrayGrid
     so that the new data is displayed on the page*/
    function load_data(dataArray) {

        var gridColumns = [];
        gridColumns.push({header:'device', width: 150, sortable: true, dataIndex: 'device'});

        gridColumns.push({header: 'position', width: 150,hidden:false, sortable: true, dataIndex: 'position'});

        gridColumns.push({header: 'target', width: 150,hidden:false, sortable: true, dataIndex: 'target'});


        //storeFields.push({name:'device'});
       // storeFields.push({name:'position'});
        //storeFields.push({name:'target'});


       // Ext.regModel('deviceModel', {
       //     fields:storeFields
        //});
        //var store = Ext.create('Ext.data.Store', { model:'deviceModel'});
        //grid.columns = gridColumns;

        //add all devices to the store..
//        var devicerecs = [];
//        for (var j = 0; j < dataArray.length; ++j) {
//            var devicerec = {};
//            devicerec['position'] = dataArray[j]['position'];
//            devicerec['device'] = dataArray[j]['device'];
//            devicerec['target'] = dataArray[j]['target'];
//            devicerecs.push(devicerec);
//
//        }
        //grid.store.loadData(devicerecs);
        grid.store.loadData(dataArray);


        //colModel = new Ext.grid.ColumnModel({columns: gridColumns});
        //store.load({params:{start:0, limit:10}});
        //grid.getBottomToolbar().removeAll();
        //grid.getBottomToolbar().add(new Ext.PagingToolbar({
        //        store:store,
        //        pageSize: 10,
        //        displayInfo: false,
        //        displayMsg: 'Displaying topics {0} - {1} of {2}',
        //        emptyMsg: "No topics to display",
        //    }))
        //grid.getBottomToolbar().doLayout();

        //gridColumns = store.data.items;
        grid.getView().refresh();

    }


    /*Retrieve data in json format via a GET request to the server. This is used
     anytime there is new data, and initially to populate the table.*/
    function update() {
        //dataArray=[['file name','database id','sha1','x','y','z'],[NaN,NaN,NaN,10,10,10],[NaN,NaN,NaN,-10,-10,-10],['file1','1','sh1','1,9','2,3','3,4'],['file2','1','sh2','4,5','2,3','5,5']];
        var conn = new Ext.data.Connection();
        conn.request({
            url:'/json/',
            method:'GET',
            params:{},
            success:function (responseObject) {
                dataArray = Ext.decode(responseObject.responseText);//decodes the response
                reload_data();                                      //resets the store and grids
            },
            failure:function () {
            }
        });
        //reload_data();
    }

    update();


});
