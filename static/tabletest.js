//my file
Ext.Loader.setConfig({
    enabled: true
});

Ext.Loader.setPath('Ext.ux', '/static/ext/examples/ux');
Ext.Loader.setPath('Ext.selection', '/static/ext/src/selection');
Ext.Loader.setPath('Ext.grid', '/static/ext/src/grid');

Ext.require([
    'Ext.grid.*',
    'Ext.data.*',
    'Ext.util.*',
    'Ext.state.*',
    'Ext.form.*',
    'Ext.ux.RowExpander',
    'Ext.selection.CellModel'
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

    var maxvals = [];
    var minvals = [];
    var instrument = 'sans10m';  // FIXME: should be a parameter
    var root = 'http://' + window.location.hostname + ':8001/' + instrument;
    var device = new io.connect(root + '/device');
    var control = new io.connect(root + '/control');
    var events = new io.connect(root + '/events');
    var storeFields = [];
    var dataArray = [];
    var keys = [];
	
	 function trim_data(data) {
            $.each(data, function (idx,node) {
			    if (node.currentValue === undefined) {
				    node.currentValue = { 'val': 'undefined' };
                } else if ($.isArray(node.currentValue.val) && node.currentValue.val.length > 5) {
                    node.currentValue.val = "[...]";
                }
                if (node.desiredValue === undefined) {
				    node.desiredValue = { 'val': 'undefined' };
                } else if ($.isArray(node.desiredValue.val) && node.desiredValue.val.length > 5) {
                    node.desiredValue.val = "[...]";
                }
            });
            return data;
        }

    function sorted_keys(obj) {
        var keys = [];
        for (var i in obj) {
            if (obj.hasOwnProperty(i)) {
                keys.push(i);
            }
        }

        // may have to craft a custom sort function to get the right order
        keys.sort();
        return keys;
    }

    device.on('connect', function () {
        console.log("device connect");
        device.emit('subscribe', function (data) {
			data=trim_data(data);
            console.log("device subscribe", data);
            dataArray = [];
            var datum = {};
            keys=Object.keys(data);
            for (var i = 0; i < keys.length; i++) {
                var datum = {};
                if (keys[i] !== "detector.counts") {
                    datum['position'] = data[keys[i]]['currentValue']['val'];
                    datum['target'] = data[keys[i]]['desiredValue']['val'];
                    datum['device'] = data[keys[i]]['id'];
                    dataArray.push(datum);
                }
            }
            keys.splice(keys.indexOf('detector.counts'), 1);
            var localData=dataArray.clone();
            grid.store.loadData(localData);
            grid.getView().refresh();
            //load_data();
            //var keys = sorted_keys(data);
            //for (var i=0; i < keys.length; i++) show_node(data[keys[i]]);
        });
    });

    device.on('changed', function (data) {
		data=trim_data(data);
        console.log("device changed");
		
        var changedData = [];
        var datum = {};
        var changedKeys=Object.keys(data);
        for (var i=0; i < changedKeys.length; i++){
            if (changedKeys[i] !== "detector.counts") {
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
            var x = keys.indexOf(changedData[i]['device']);
            dataArray[x] = changedData[i]
        }
        var localData=dataArray.clone();
		return;
        grid.store.loadData(localData);
        //grid.getView().refresh();
        //for (var i=0; i < data.length; i++) show_node(data[i]);
    });


    Ext.regModel('deviceModel', {
        fields:[
            {name:'device', type:'string'},
            'position',
            {name:'target', type:'string'}
        ]
    });

    var store = Ext.create('Ext.data.Store', { model:'deviceModel'});

    var cellEditing = Ext.create('Ext.grid.plugin.CellEditing', {
        clicksToEdit: 1
    });

//	var store = new Ext.data.Store({
//        proxy: new Ext.data.proxy.Memory(dataArray),
//        reader: new Ext.data.ArrayReader({},storeFields),
//        remoteSort: true,
//    });
    var gridColumns = [];

    gridColumns.push({header:'device', width:150, sortable:true, dataIndex:'device'});
    gridColumns.push({header:'position', width:150, hidden:false, sortable:true, dataIndex:'position'})
        //field: {xtype: 'numberfield', allowBlank: false}});
    gridColumns.push({header:'target', width:150, hidden:false, sortable:true, dataIndex:'target'})
        //field: {xtype: 'numberfield', allowBlank: false}});

    /*GridPanel that displays the data*/
    var grid = new Ext.grid.GridPanel({
        store:store,
        columns:gridColumns,
        stripeRows:true,
        height:500,
        width:700,
        plugins: [{
            ptype: 'rowexpander',
            rowBodyTpl : [
                '<p><b>Device:</b> {device}</p><br>',
                '<p><b>Target:</b> {target}</p>'
            ]
        },
        cellEditing],
        title:'Devices',
        collapsible: true,
        animCollapse: false,
    });

    grid.render('gridtest');


    /*After data is retrieved from server, we have to reinitiallize the Store reconfigure the ArrayGrid
     so that the new data is displayed on the page*/
    function load_data(dataArray) {

        var gridColumns = [];
        storeFields = [];
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
