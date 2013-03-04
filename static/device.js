
Ext.require([
    //'Ext.ModelManager',
    'Ext.grid.View', 'Ext.grid.Panel',
    'Ext.data.Model', 'Ext.data.Store',
    'Ext.ux.RowExpander'
]);

Ext.onReady(function () {

    Ext.namespace('GridSpace','ConfigSpace');

    GridSpace.device = io.connect(ConfigSpace.root + '/device');
  
    GridSpace.dataArray = [];
    GridSpace.deviceNames = [];

    Ext.define('deviceModel', {
        extend: "Ext.data.Model",
        fields:[ 'id', 'label', 'position', 'target', 'device' ]
    });

    if(Ext.isSafari){
        Ext.override(Ext.grid.View, {
            layout : function(){
                this.scroller.dom.style.position = 'static';
            }
        });
    }

    GridSpace.store = Ext.create('Ext.data.Store', { model:'deviceModel'});

    GridSpace.gridColumns = [];

    GridSpace.gridColumns.push({header:'device', width:150, sortable:true, dataIndex:'label'});
    GridSpace.gridColumns.push({header:'position', width:150, hidden:false, sortable:true, dataIndex:'position'});
    GridSpace.gridColumns.push({header:'target', width:150, hidden:false, sortable:true, dataIndex:'target'});

    GridSpace.tpl =
        ['<tpl for ="device.visibleNodeIDs">',
         '<p><b>{.}: </b>{[this.getVal(values, parent)]}</p>',
         {getVal: getVal},
         '</tpl>'];

    function getVal(values, parent) {
        return parent.device.nodes[values].currentValue.val;
    }

    /*GridPanel that displays the data*/
    GridSpace.grid = new Ext.grid.GridPanel({
        store: GridSpace.store,
        columns: GridSpace.gridColumns,
        stripeRows:true,
        height:ConfigSpace.height,
        //width:475,
        listeners: {
            itemclick: function(view, cell, rowIdx, cellIndex, e) {

                this.plugins[0].toggleRow(rowIdx);
            }
        },
        //if other plugins are added, check listener (this.plugins[0]) and make sure
        //that the 0 index plugin is still rowexpander
        plugins: [{ptype: 'rowexpander',
            rowBodyTpl: GridSpace.tpl,
            hideTrigger: true,
            renderer: function(p, record) {
                if (record.get('listeRetourChaqueJour') != "") {
                    p.id = '';
                    return '&#160;';
                }
            }
        }],
        title:'Devices',
        collapsible: true,
        animCollapse: false
    });


    GridSpace.device.on('connect', function () {
        //console.log("device connect");
        GridSpace.device.emit('subscribe', GridSpace.setDeviceModel);
    });

    GridSpace.device.on('reset', function (state) {
        GridSpace.setDeviceModel(state[0],state[1]);
    });

    GridSpace.device.on('changed', function (nodes) {
        for (var i=0; i < nodes.length; i++) {
            var node = nodes[i];
            var deviceRecord = GridSpace.grid.store.findRecord('id', node.deviceID);
            if (deviceRecord !== null) {
                deviceRecord.data.device.nodes[node.nodeID] = node;
                if (deviceRecord.data.device.primaryNodeID === node.nodeID) {
                    GridSpace.setDeviceValue(deviceRecord.data);
                    deviceRecord.commit();
                }
            }
        }
    });

    GridSpace.setDeviceModel = function (data, structure) {
        structure = jQuery.parseJSON(structure);
        //console.log("device reset", data, structure);
        GridSpace.dataArray = [];
        // TODO: change this to the device display heirarchy when it is available
        var deviceIDs = GridSpace.sorted_keys(data);
        for (var i = 0; i < deviceIDs.length; i++) {
            var device = data[deviceIDs[i]];
            var datum = {
                 id: device.id,
                 label: device.displayName,
                 position: '',
                 target: '',
                 device: device
            };
            if (device.type === "LOGICAL_COUNTER") {
                continue;
            }
            GridSpace.setDeviceValue(datum);
            GridSpace.dataArray.push(datum);
        }

        GridSpace.grid.store.loadData(GridSpace.dataArray);
        GridSpace.grid.getView().refresh();
    };


    GridSpace.setDeviceValue = function (record) {
        if (record.device.primaryNodeID === "") return;
        var node = record.device.nodes[record.device.primaryNodeID];
        record.position = GridSpace.trimmedValue(node.currentValue);  
        if (record.device.type === "MOTOR") {
            record.target = GridSpace.trimmedValue(node.desiredValue);
        }
    } 

    GridSpace.trimmedValue = function (value) {
        if (value === undefined || value == null) {
            return "undefined";
        } else if ($.isArray(value.val) && value.val.length > 5) {
            return "[...]";
        } else {
            return ""+value.val;
        }
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
});
