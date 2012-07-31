Ext.require([
    'Ext.tab.Panel'
]);

Ext.onReady(function () {

    Ext.namespace('ConfigSpace');

    var tabs = Ext.create('Ext.tab.Panel', {
    	defaults: {
        	layout: 'fit',
        	autoScroll : true
        },
        renderTo: 'gridtab',
        width: ConfigSpace.width,
        height:ConfigSpace.height,
        activeTab: 0,
//        defaults :{
//            bodyPadding: 10
//        },
        //items: [GridSpace.grid]
        //items: [QueueSpace.tree]
        items: [
        { id: 'devicegrid', title: ConfigSpace.instrument + ' devices', items: GridSpace.grid}, 
        	{id: 'nicequeue', title: ConfigSpace.instrument + ' queue', items: QueueSpace.tree}]
    });

});