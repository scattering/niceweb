Ext.require([
'Ext.tree.*', 
'Ext.data.*',
'Ext.util.*']);

    
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
    
    var treeStore = Ext.create('Ext.data.TreeStore', {
	    model: 'CommandModel',
	    proxy: {
	        type: 'memory',
	        reader: {
            	type: 'json',
            	root: '0' 
        	}
	    },
	    root: {
            id: '0',
            text: 'Commands'
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
        title : instrument + ' Queue',
        renderTo : Ext.getBody(),
        collapsible : true
    });
    
    // root reference
    var treeRoot = treeStore.getRootNode()
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
      
	function generateText(nodeStatus) {
		return ' '+nodeStatus.commandStr + ' (' + nodeStatus.metaState + ') '+ nodeStatus.state;
	}
	
    queue.on('connect', function() {
    	
    	// first time the web client connects to the repeater.
        window.console.log("queue connect");
        // ask for initial state and all messages
        queue.emit('subscribe', function(qroot) {
	        if (qroot == undefined)
	        {
	        	window.console.log("no feed");
	        	return;
	        }
	        
			window.console.log("queue subscribe", qroot);
				
	//			for (var command in qroot.child) {
	//               if (qroot.child.hasOwnProperty(command)) {   
	//                  var commandObject = qroot.child[command];
	//                  
	//                  var newCommand = Ext.create('CommandModel', { id: commandObject.id, text: commandObject.status.commandStr, expanded: true, leaf: true });
	//                  var child = treeRoot.insertChild(command,newCommand);
	//                  
	//                  child.expand();
	//               }
	//			}
				
			treeRoot.expand();
			var commandObject = qroot.child[0];                
			var newCommand = Ext.create('CommandModel', { 
				id: commandObject.id, 
				text: commandObject.id + generateText(commandObject.status), 
				expanded: true, 
				leaf: true 
			});
	 		var child = treeRoot.insertChild(0,newCommand); 			

		});       
    });

    queue.on('added', function(nodes, parentID, siblingID) {
       
        //var node = tree.getNodeById(parentID);
        var node = nodes['0'];
        window.console.log("node " +node.id+ " added under " + parentID + " after " + siblingID, node.status.commandStr);
        var newCommand = Ext.create('CommandModel', { 
              id: node.id, 
              text: node.id + generateText(node.status), 
              expanded:true, 
              leaf: true 
        });

        var parent = treeStore.getNodeById(parentID);
        var sibling = treeStore.getNodeById(siblingID);
        if (parent.isLeaf()) {
        	parent.set('leaf',false);
        }
        parent.insertChild(siblingID +1,newCommand);
        
        //parent.contains(tree.getNodeById('childId'));
    });

    queue.on('removed', function(nodeID) {
        window.console.log("queue removed " + nodeID);
         var changedNode = treeStore.getNodeById(nodeID); 
        if (changedNode == undefined){
        	window.console.log("node %s does not exist and cannot be removed ",nodeID);
        }
        else{
        	changedNode.remove(false);
        }
    });

    queue.on('removed children', function(nodeID) {
        log("queue removed children from " + nodeID);
         var changedNode = treeStore.getNodeById(nodeID); 
        if (changedNode == undefined){
        	window.console.log("children cannot be removed because the node %s does not exist ", nodeID);
        }
        else{
        	changeNode.removeAll(false);
        }
    });

    queue.on('moved', function(nodeID, parentID, siblingID) {
        log("queue moved " + nodeID + " to " + parentID + " after "+ siblingID);
    });

    queue.on('changed', function(nodeID, node_status) {
        window.console.log("node changed " + nodeID, node_status.commandStr);
        var changedNode = treeStore.getNodeById(nodeID); 
        if (changedNode == undefined){
        	window.console.log("node is not defined " + nodeID);
        }
        else{
        	changedNode.set('text',nodeID + generateText(node_status));
        }
       
    });

    queue.on('reset', function(qroot) {
    	//only happens when the server restarts
        window.console.log("queue reset", root);
        while(treeRoot.firstChild) {
  			treeRoot.removeChild(treeRoot.firstChild);
		}
		
		var commandObject = qroot.child[0];                
		var newCommand = Ext.create('CommandModel', { 
			id: commandObject.id, 
			text: commandObject.id + generateText(commandObject.status), 
			expanded: true, 
			leaf: true 
		});
 		var child = treeRoot.insertChild(0,newCommand); 		
		
    });
     

    
	

});
