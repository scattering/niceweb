Ext.require([
    'Ext.tab.*'
    ]);

Ext.onReady(function () {
    var tabs = Ext.createWidget('tabpanel', {
        renderTo: 'gridtab',
        width: 495,
        activeTab: 0,
        defaults :{
            bodyPadding: 10
        },
        items: [{
            contentEl:'gridtest',
            title: 'Device Grid'
        },{
            contentEl:'nicequeue',
            title: 'Queue'
        }]
    });
});