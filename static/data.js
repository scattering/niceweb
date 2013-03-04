
Ext.onReady(function () {
    Ext.namespace('ConfigSpace');


    var resetData = function(state) {
//console.log("reset data",state);
if (!state) return;
        for (var i=0; i < state.records.length; i++) {
            updateData(state.records[i]);
        }
    }

    var updateData = function(record) {
//console.log("update data",record);
    }


    var dataChannel = new io.connect(ConfigSpace.root + '/data');
    dataChannel.on('connect', function () {
//console.log("data connect");
        dataChannel.emit('subscribe', resetData);
    });
    dataChannel.on('reset', resetData);
    dataChannel.on('record', updateData);

});
