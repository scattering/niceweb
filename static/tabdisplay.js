Ext.require([
    'Ext.tab.Panel'
]);

Ext.onReady(function () {

    Ext.namespace('ConfigSpace');

    var tabs = Ext.createWidget('tabpanel', {
        renderTo: 'gridtab',
        width: 495,
        height:500,
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