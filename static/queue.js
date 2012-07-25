Ext.require([
    'Ext.tree.*',
    'Ext.data.*',
    'Ext.util.*']);


Ext.onReady(function() {

    Ext.namespace('QueueSpace','ConfigSpace');
    ConfigSpace.root = 'http://' + window.location.hostname + ':8001/' + ConfigSpace.instrument;
    QueueSpace.queue = new io.connect(ConfigSpace.root+'/queue');
    ConfigSpace.events = new io.connect(ConfigSpace.root+'/events');

    Ext.define('CommandModel', {
        extend: 'Ext.data.Model',
        fields: [
            { name: 'id', type: 'string' },
            { name: 'text', type: 'string' }
        ]
    });

    QueueSpace.treeStore = Ext.create('Ext.data.TreeStore', {
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
    QueueSpace.tree = Ext.create('Ext.tree.Panel', {
        store: QueueSpace.treeStore,
        hideHeaders : true,
        rootVisible : true,
        viewConfig : {
            plugins : [{
                ptype : 'treeviewdragdrop'
            }]
        },
        height : 600,
        width : 800,
        title : ConfigSpace.instrument + ' Queue',
       // renderTo : 'nicequeue', //Ext.getBody(),
        collapsible : true
    });

    // root reference
    QueueSpace.treeRoot = QueueSpace.treeStore.getRootNode()

    // format the queue details
    QueueSpace.generateText=function(nodeStatus) {
        return ' '+nodeStatus.commandStr + ' (' + nodeStatus.metaState + ') '+ nodeStatus.state;
    }

    // Search for node in tree given node id
    QueueSpace._find_node = function(nodeID, parentNode) {
        var childNode = parentNode.lastChild;
        while (childNode !== undefined && childNode !== null) {
            if (childNode.data.id == nodeID) {
                return childNode;
            } else {
                var grandchild = QueueSpace._find_node(nodeID, childNode);
                if (grandchild !== null) {
                    return grandchild;
                }
                childNode = childNode.previousSibling;
            }
        }
        return null;
    }
    QueueSpace.find_node = function(nodeID) {
        if (nodeID === 0 || nodeID === "0") {
            return QueueSpace.treeRoot;
        } else {
            return QueueSpace._find_node(nodeID,  QueueSpace.treeRoot);
        }
    };

    // Construct a tree node from a queue item.  If the queue
    // item has children, construct the children as well.
    QueueSpace.build_node = function(qnode){
        var commandNode = Ext.create('CommandModel', {
            id: qnode.id,
            text: qnode.id + QueueSpace.generateText(qnode.status),
            expanded: false,
            leaf: qnode.child.length == 0
        });
        QueueSpace.build_tree(commandNode, qnode);
        return commandNode;
    };
    // Construct a tree from a list of top level nodes, and add
    // them to the root.
    QueueSpace.build_tree = function(treeNode, qroot) {
        for (var i=0; i < qroot.child.length; i++) {
            var qnode = qroot.child[i];
            var newCommand = QueueSpace.build_node(qnode);
            //if (tree.isRoot()){ tree.childNodes=[]; };
            //tree.insertChild(i,newCommand);
            treeNode.appendChild(newCommand);
        }
    }

    QueueSpace.queue.on('connect', function() {

        // first time the web client connects to the repeater.
        //window.console.log("queue connect");
        // ask for initial state and all messages
        QueueSpace.queue.emit('subscribe', function(qroot) {
            if (qroot == undefined) {
                window.console.log("no feed");
            } else {
                //window.console.log("queue subscribe", qroot);
                QueueSpace.build_tree(QueueSpace.treeRoot, qroot);
                QueueSpace.treeRoot.expand();
            }
        });
    });

    // Nodes added to the queue. The nodes parameter is the array of nodes
    // to add.  Each node in the list may contain children.  The nodes are
    // to be added after siblingID within parentID.  If siblingID is 0, then
    // add the nodes before the first sibling.
    QueueSpace.queue.on('added', function(nodes, parentID, siblingID) {

        //var node = tree.getNodeById(parentID);
        //window.console.log("node " +nodes[0].id+ " added under " + parentID + " after " + siblingID, nodes[0].status.commandStr, nodes);
        var parentNode = QueueSpace.find_node(parentID);
        if (parentNode == null) {
            window.console.log("could not find",parentID, QueueSpace.treeRoot);
            return;
        }
        if (parentNode.isLeaf()) {
            parentNode.set('leaf',false);
        }


        var siblingNode;
        if (siblingID == 0) {
            siblingNode = parentNode.firstChild;
        } else {
            siblingNode = QueueSpace.find_node(siblingID);
            if (siblingNode == null) {
                window.console.log("could not find",siblingID, QueueSpace.treeRoot);
                return;
            }
            siblingNode = siblingNode.nextSibling;
        }
        for (var j=0; j < nodes.length; j++) {
            var newCommand = QueueSpace.build_node(nodes[j]);
            if (siblingNode == null) {
                parentNode.appendChild(newCommand);
            } else {
                parentNode.insertBefore(siblingNode,newCommand);
            }
            // window.console.log("added",newCommand.data.id);
        }
    });

    QueueSpace.queue.on('removed', function(nodeID) {
        //window.console.log("queue removed " + nodeID);
        var treeNode = QueueSpace.find_node(nodeID);
        if (treeNode == null){
            window.console.log("node %s does not exist and cannot be removed ",nodeID);
        }
        else{
            treeNode.remove(false);
        }
    });

    QueueSpace.queue.on('removed children', function(nodeID) {
        var treeNode = QueueSpace.find_node(nodeID);
        //window.console.log("removing node",treeNode);
        if (treeNode == null){
            window.console.log("children cannot be removed because the node %s does not exist ", nodeID);
        } else {
            treeNode.removeAll(false);
        }
    });

    QueueSpace.queue.on('moved', function(nodeID, parentID, siblingID) {
        window.console.log("queue moved " + nodeID + " to " + parentID + " after "+ siblingID);
    });

    QueueSpace.queue.on('changed', function(nodeID, node_status) {
        // window.console.log("node changed " + nodeID, node_status.commandStr);
        var treeNode = QueueSpace.find_node(nodeID);
        if (treeNode == null) {
            window.console.log("node is not defined " + nodeID);
        } else {
            treeNode.set('text',nodeID + QueueSpace.generateText(node_status));
        }

    });

    QueueSpace.queue.on('reset', function(qroot) {
        //only happens when the server restarts
        // window.console.log("queue reset", qroot, treeRoot);
        QueueSpace.treeRoot.removeAll(false);
        QueueSpace.build_tree(QueueSpace.treeRoot, qroot);
        QueueSpace.treeRoot.expand();
    });

});
