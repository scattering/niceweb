Ext.require(['Ext.panel.Panel', 'Ext.window.MessageBox', 'Ext.grid.GridPanel', 'Ext.data.Store', 'Ext.tip.*']);

Ext.onReady(function() {

	//Ext.QuickTips.init();

	Ext.namespace('ConsoleSpace', 'ConfigSpace');
	
	ConsoleSpace.feed = io.connect(ConfigSpace.root + '/console');
	
	ConsoleSpace.messages = []

    Ext.define('ConsoleModel', {
        extend: "Ext.data.Model",
        fields:[ 'commandID', 'eventID', 'level', 'message', 'timestamp' ]
    }); 
    
    ConsoleSpace.store = Ext.create('Ext.data.Store', {model: 'ConsoleModel'}); 
        
	ConsoleSpace.grid = new Ext.grid.GridPanel({
        stripeRows:false,
        height:ConfigSpace.height,
        //width:475,
        store: ConsoleSpace.store,
        columns: [
            { header: "message", dataIndex: 'message', width: '100%'}
        ],
        listeners: {
            //itemclick: function(view, cell, rowIdx, cellIndex, e) {
            //
            //    this.plugins[0].toggleRow(rowIdx);
            //}
        },
        //if other plugins are added, check listener (this.plugins[0]) and make sure
        //that the 0 index plugin is still rowexpander
        title:'Console output',
        collapsible: true,
        animCollapse: false
    });
	
	ConsoleSpace.view = Ext.create('Ext.panel.Panel', {
        items: [{
            html: ConsoleSpace.html,
            xtype: 'panel' }]})

    ConsoleSpace.feed.on('report', function(msg) {
		ConsoleSpace.add_message(msg);
			// todo implement
    });
    
    ConsoleSpace.add_many = function(msgs) {
        for (var i in msgs) {
            ConsoleSpace.add_message(msgs[i]);
        }
    }

    ConsoleSpace.add_message = function(msg) {
        ConsoleSpace.messages.push(msg);
        ConsoleSpace.update_view();
    }
    
    ConsoleSpace.update_view = function() {
        ConsoleSpace.grid.store.loadData(ConsoleSpace.messages);
    }
    
    ConsoleSpace.feed.emit('subscribe', ConsoleSpace.add_many);
});
