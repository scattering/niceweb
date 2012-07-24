Ext.require([
    'Ext.tab.*'
]);

Ext.onReady(function () {

    var instrument = 'sans10m';  // FIXME: should be a parameter
    var root = 'http://' + window.location.hostname + ':8001/' + instrument;

    var tabs = Ext.createWidget('tabpanel', {
        renderTo: 'gridtab',
        width: 495,
        height:1000,
        activeTab: 0,
        defaults :{
            bodyPadding: 10
        },
        //items: [GridSpace.grid]
        //items: [QueueSpace.tree]
        items: [GridSpace.grid, QueueSpace.tree]
    });
});
