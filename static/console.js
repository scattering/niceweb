Ext.require(['Ext.panel.Panel', 'Ext.window.MessageBox', 'Ext.grid.GridPanel', 'Ext.data.Store', 'Ext.tip.*']);

Ext.onReady(function() {

    //Ext.QuickTips.init();

    Ext.namespace('ConsoleSpace', 'ConfigSpace');
	
    ConsoleSpace.feed = io.connect(ConfigSpace.root + '/console')
    ConsoleSpace.feed.on('connect', function() {
        ConsoleSpace.feed.on('report', ConsoleSpace.add_message);
        ConsoleSpace.feed.on('reset', ConsoleSpace.reset);
    });
    
	
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


    ConsoleSpace.add_many = function(msgs) {
        for (var i in msgs) {
            ConsoleSpace.add_message(msgs[i], true);
        }
        ConsoleSpace.update_view();
    }

    ConsoleSpace.add_message = function(msg, noupdate) {
        ConsoleSpace.messages.push(msg);
        if (!noupdate) ConsoleSpace.update_view();
    }
    
    ConsoleSpace.reset = function(state){
        //console.log('console state: ', state);
        ConsoleSpace.add_many(state.events);
    }
    
    ConsoleSpace.grid.on('afterlayout', function(a,b,c) { 
        var view = a.view;
        var numrows = view.getNodes().length;
        view.focusRow(numrows-1);
    });
    
    ConsoleSpace.update_view = function() {
        ConsoleSpace.grid.store.loadData(ConsoleSpace.messages);
    }
});
