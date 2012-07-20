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
    
	var template = new Ext.XTemplate( 
        '<tpl for=".">',
            '<div class="x-item x-item-child"> <bold>{text}</bold></div>',
        '</tpl>'      
    )
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
            id: 0,
            text: 'Commands'
        }
	});
	
	    // create the Tree
    var tree = Ext.create('Ext.tree.Panel', {
    	store: treeStore,
    	tpl: template,
        hideHeaders : true,
        rootVisible : true,
        viewConfig : {
            plugins : [{
                ptype : 'treeviewdragdrop'
            }],
            selectedItemCls : 'test'
        },
        height : 600,
        width : 800,
        title : instrument + ' Queue',
        renderTo : Ext.getBody(),
        collapsible : true
    });
    
    // root reference
    var treeRoot = treeStore.getRootNode()

    // format the queue details
    function generateText(nodeStatus) {
        return ' '+nodeStatus.commandStr + ' (' + nodeStatus.metaState + ') '+ nodeStatus.state;
    }

    // Search for node in tree given node id
    function _find_node(nodeID, parentNode) {
        var childNode = parentNode.lastChild;
        while (childNode !== undefined && childNode !== null) {
            if (childNode.data.id == nodeID) {
                return childNode;
            } else {
                grandchild = _find_node(nodeID, childNode);
                if (grandchild !== null) {
                    return grandchild;
                }
                childNode = childNode.previousSibling;
            }
        }
        return null;
    }
    function find_node(nodeID) {
        if (nodeID == 0) {
            return treeRoot;
        } else {
            return _find_node(nodeID, treeRoot);
        }
    }

    // Construct a tree node from a queue item.  If the queue
    // item has children, construct the children as well.
    function build_node(qnode) {
	var commandNode = Ext.create('CommandModel', { 
                    id: qnode.id, 
                    text: qnode.id + generateText(qnode.status), 
                    expanded: false, 
                    leaf: qnode.child.length == 0
                });
        build_tree(commandNode, qnode);
        return commandNode;
    }
    // Construct a tree from a list of top level nodes, and add
    // them to the root.
    function build_tree(tree, qroot) {
        for (var i=0; i < qroot.child.length; i++) {
            var qnode = qroot.child[i];
            var newCommand = build_node(qnode);
            tree.insertChild(i,newCommand);
        }
    }

    queue.on('connect', function() {
    	
    	// first time the web client connects to the repeater.
        //window.console.log("queue connect");
        // ask for initial state and all messages
        queue.emit('subscribe', function(qroot) {
            if (qroot == undefined) {
                window.console.log("no feed");
            } else {
                //window.console.log("queue subscribe", qroot);
                build_tree(treeRoot, qroot);
                treeRoot.expand();
            }
	});       
    });

    // Nodes added to the queue. The nodes parameter is the array of nodes
    // to add.  Each node in the list may contain children.  The nodes are
    // to be added after siblingID within parentID.  If siblingID is 0, then
    // add the nodes before the first sibling.
    queue.on('added', function(nodes, parentID, siblingID) {
       
        //var node = tree.getNodeById(parentID);
        //window.console.log("node " +nodes[0].id+ " added under " + parentID + " after " + siblingID, nodes[0].status.commandStr, nodes);
        var parentNode = find_node(parentID);
        if (parentNode == null) {
            window.console.log("could not find",parentID,treeRoot);
            return;
        }
        if (parentNode.isLeaf()) {
             parentNode.set('leaf',false);
        }

        
        var siblingNode;
        if (siblingID == 0) {
            siblingNode = parentNode.firstChild;
        } else {
            siblingNode = find_node(siblingID);
            if (siblingNode == null) {
                window.console.log("could not find",siblingID,treeRoot);
                return;
            }
            siblingNode = siblingNode.nextSibling;
        }
        for (var j=0; j < nodes.length; j++) {
            var newCommand = build_node(nodes[j]);
            if (siblingNode == null) {
                parentNode.appendChild(newCommand);
            } else {
                parentNode.insertBefore(siblingNode,newCommand);
            } 
            // window.console.log("added",newCommand.data.id);
        }
    });

    queue.on('removed', function(nodeID) {
        //window.console.log("queue removed " + nodeID);
         var treeNode = find_node(nodeID); 
        if (treeNode == null){
            window.console.log("node %s does not exist and cannot be removed ",nodeID);
        }
        else{
           treeNode.remove(false);
        }
    });

    queue.on('removed children', function(nodeID) {
        var treeNode = find_node(nodeID); 
        //window.console.log("removing node",treeNode);
        if (treeNode == null){
            window.console.log("children cannot be removed because the node %s does not exist ", nodeID);
        } else {
            treeNode.removeAll(false);
        }
    });

    queue.on('moved', function(nodeID, parentID, siblingID) {
        window.console.log("queue moved " + nodeID + " to " + parentID + " after "+ siblingID);
    });

    queue.on('changed', function(nodeID, node_status) {
        // window.console.log("node changed " + nodeID, node_status.commandStr);
        var treeNode = find_node(nodeID); 
        if (treeNode == null) {
            window.console.log("node is not defined " + nodeID);
        } else {
            treeNode.set('text',nodeID + generateText(node_status));
        }
       
    });

    queue.on('reset', function(qroot) {
    	//only happens when the server restarts
        // window.console.log("queue reset", qroot, treeRoot);
        treeRoot.removeAll(false);
	build_tree(treeRoot, qroot);
	treeRoot.expand();
    });

});
