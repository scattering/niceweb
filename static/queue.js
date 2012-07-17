Ext.require([
'Ext.tree.*', 
'Ext.data.*']);


    
Ext.onReady(function() {

    var instrument = 'sans10m';  // FIXME: should be a parameter
    var root = 'http://' + window.location.hostname + ':8001/' + instrument;
    var queue = new io.connect(root+'/queue');
    var events = new io.connect(root+'/events');
    
    Ext.define('CommandModel', {
	    extend: 'Ext.data.Model',
	    fields: [
	        { name: 'id', type: 'string' },
	        { name: 'text', type: 'string' }
	    ]
    });
    
    function log(msg, obj) {
		var content = ("<pre>"+(obj&&json_hilite(obj))+"</pre>")||"";
		$("#console").append('<div>'+msg+content+'</div>');
	}
    
	function json_hilite(obj) {
		json = JSON.stringify(obj, undefined, 4);
		json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g,'&gt;');
		return json
				.replace(
						/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
						function(match) {
							var cls = 'number';
							if (/^"/.test(match)) {
								if (/:$/.test(match)) {
									cls = 'key';
								} else {
									cls = 'string';
								}
							} else if (/true|false/.test(match)) {
								cls = 'boolean';
							} else if (/null/.test(match)) {
								cls = 'null';
							}
							return '<span class="' + cls + '">' + match
									+ '</span>';
						});
	}
        
    queue.on('connect', function() {
        log("queue connect");
        queue.emit('subscribe', function(qroot) {
			log("queue subscribe", qroot);
 			
			var newCommand = Ext.create('CommandModel', { id: '24', text: 'move a1 to 40', leaf: true });
            var treeRoot = treeStore.getRootNode()
            //treeStore.load();
            var child = treeRoot.appendChild(newCommand);
            child.expand();

		});       
    });

    queue.on('added', function(node, parentID, siblingID) {
        log("queue added under " + parentID + " after " + siblingID, node);
        
 
        //var parent = tree.getNodeById(parentID);
        var root = tree.getRootNode();
        var newCommand = Ext.create('CommandModel', { id: node.id, text: node.text, leaf: true });
            var treeRoot = treeStore.getRootNode()
            var child = treeRoot.appendChild(newCommand);
            child.expand();

        //Ext.tree.TreeNode
        //parent.contains(tree.getNodeById('childId'));
    });

    queue.on('removed', function(nodeID) {
        log("queue removed " + nodeID);
    });

    queue.on('removed children', function(nodeID) {
        log("queue removed children from " + nodeID);
    });

    queue.on('moved', function(nodeID, parentID, siblingID) {
        log("queue moved " + nodeID + " to " + parentID + " after "+ siblingID);
    });

    queue.on('changed', function(nodeID, node_status) {
        log("queue status " + nodeID, node_status);
    });

    queue.on('reset', function(root) {
        log("queue reset", root);
    });
     

	var treeStore = Ext.create('Ext.data.TreeStore', {
	    model: 'CommandModel',
	    proxy: {
	        type: 'memory',
	        reader: {
            	type: 'json',
            	root: 'commands' 
        	}
	    },
	    root: {
            id: "commands"
        }
	});
	
	    // create the Tree
    var tree = Ext.create('Ext.tree.Panel', {
    	store: treeStore,
        hideHeaders : true,
        rootVisible : true,
        viewConfig : {
            plugins : [{
                ptype : 'treeviewdragdrop'
            }]
        },
        height : 600,
        width : 800,
        title : 'Queue',
        renderTo : Ext.getBody(),
        collapsible : true
    });		    

});
