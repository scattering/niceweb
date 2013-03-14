Ext.require(['Ext.tree.Panel', 'Ext.data.Model', 'Ext.data.TreeStore',
		'Ext.window.MessageBox', 'Ext.tip.*']);

Ext.onReady(function() {

	Ext.QuickTips.init();

	Ext.namespace('QueueSpace', 'ConfigSpace');
	QueueSpace.queue = io.connect(ConfigSpace.root + '/queue');
	QueueSpace.queue.on('connect', function () {
		QueueSpace.queue.on('reset', QueueSpace.reset_queue);
		QueueSpace.queue.on('added', QueueSpace.add_node);
		QueueSpace.queue.on('removed', QueueSpace.remove_node);
		QueueSpace.queue.on('changed', QueueSpace.change_node);
		QueueSpace.queue.on('moved', QueueSpace.move_node);
	});

	Ext.define('CommandModel', {
		extend : 'Ext.data.Model',
		fields : [{
			name : 'id',
			type : 'string'
		}, {
			name : 'text',
			type : 'string'
		}, {
			name : 'state',
			type : 'string'
		}, {
			name : 'metaData',
			type : 'string'
		}, {
			name : 'errors',
			type : 'auto'
		}]
	});

	QueueSpace.treeStore = Ext.create('Ext.data.TreeStore', {
		model : 'CommandModel',
		proxy : {
				type : 'memory',
			reader : {
				type : 'json',
				root : '0'
			}
		},
		root : {
			id : 0,
			text : 'Commands'
		}
	});

	// create the panel that will display the Tree
	QueueSpace.tree = Ext.create('Ext.tree.Panel', {
		store : QueueSpace.treeStore,
		hideHeaders : true,
		rootVisible : true,
		layout : 'fit',
		title : ConfigSpace.instrument + ' Queue',
		collapsible : true,
		listeners : {
			dblclick : {
				element : 'el', // bind to the underlying el prop on the panel
				fn : function(event) {
					//console.log(event);
					}
			}
		},
		bodyStyle : {
			background : '#FBF9F5',
			padding : '10px',
			fontSize : '12px'
		}
	});

	// root reference
	QueueSpace.treeRoot = QueueSpace.treeStore.getRootNode();

	var array_toString = function(value) {
		var blkstr = $.map(value, function(val, index) {
			var str = index + ":" + val;
			return str;
		}).join(", ");
		return blkstr;
	}

	// format command details as html
	QueueSpace.generateStatus = function(node_status) {
		return 'State : ' + node_status.state + '<br> ' + 'Meta Data : '
			+ node_status.metaState + '<br>' + 'Errors : '
			+ array_toString(node_status.errors) + '<br>';
	};


	/**
	 * generates correct suffix that can be used apply correct css style to a tree node
	 */
	var node_css_type = function(state) {
		var type

		switch (state) {
			case 'FINISHED' :
				type = 'done';
				break;
			case 'CHILDREN' :
			case 'RUNNING' :
				type = 'run';
				break;
			case 'QUEUED' :
				type = 'queued';
				break;
			default :
				type = 'default'
		}
		return type;
	};

	// Find the node given the path
	QueueSpace.find_node= function(path) {
		root = QueueSpace.treeRoot;
		for (var i = 0; i < path.length; i++) {
			root = root.childNodes[path[i]];
		}
		return root;
	};
	// Find the node given the path
	QueueSpace.find_parent= function(path) {
		root = QueueSpace.treeRoot;
		for (var i = 0; i < path.length-1; i++) {
			root = root.childNodes[path[i]];
		}
		return root;
	};

	// Construct a tree node from a queue item. If the queue
	// item has children, construct the children as well.
	QueueSpace.build_node = function(qnode) {
		var commandNode = Ext.create('CommandModel', {
			id : qnode.id,
			text : qnode.status.commandStr,
			state : qnode.status.state,
			metaData : qnode.status.metaState,
			errors : array_toString(qnode.status.errors),
			qtip : QueueSpace.generateStatus(qnode.status),
			qtitle : 'Command ' + qnode.id,
			expanded : false,
			leaf : qnode.children.length == 0,
			cls : 'node-style-' + node_css_type(qnode.status.state)
		});
		QueueSpace.build_tree(commandNode, qnode);
		return commandNode;
	};
	// Construct a tree from a list of top level nodes, and add
	// them to the root.
	QueueSpace.build_tree = function(treeNode, qroot) {
		for (var i = 0; i < qroot.children.length; i++) {
			var qnode = qroot.children[i];
			var newCommand = QueueSpace.build_node(qnode);
			// if (tree.isRoot()){ tree.childNodes=[]; };
			// tree.insertChild(i,newCommand);
			treeNode.appendChild(newCommand);
			newCommand.set('iconCls', 'node-icon-'
				+ node_css_type(newCommand.data.state));
		}
	};
	
	QueueSpace.remove_node = function(path) {
		//console.log("queue removed ",path);
		var treeNode = QueueSpace.find_node(path);
		if (treeNode == null) {
			console.log(
				"node does not exist and cannot be removed ",
				path);
		} else {
			// TODO: should remove node and all its children, but that raises
			// "TypeError: 'undefined' does not have p.indexOf" or some such.
			// Don't know if we need to remove children
			//treeNode.removeAll(true);
			treeNode.remove(false);
		}
	};
	
	QueueSpace.add_node = function(path, node) {
		//console.log("queue added ",path, node);
		var parentNode = QueueSpace.find_parent(path);
		if (parentNode.isLeaf()) {
			parentNode.set('leaf', false);
		}
		var newCommand = QueueSpace.build_node(node);

		var index = path[path.length-1];
		if (index >= parentNode.childNodes.length) {
			parentNode.appendChild(newCommand);
		} else {
			parentNode.insertChild(index, newCommand);
		}
		newCommand.set('iconCls', 'node-icon-' + node_css_type(newCommand.data.state));
	};

	// Nodes added to the queue. The nodes parameter is the array of nodes
	// to add. Each node in the list may contain children. The nodes are
	// to be added after siblingID within parentID. If siblingID is 0,
	// then add the nodes before the first sibling.

	QueueSpace.move_node = function(oldpath, newpath, node) {
		//console.log("move node ",oldpath, newpath, node);
		QueueSpace.remove_node(oldpath);
		QueueSpace.add_node(newpath, node);
	};

	QueueSpace.change_node = function(path, node_status) {
		//console.log("node changed ",path);
		var treeNode = QueueSpace.find_node(path);
		if (treeNode == null) {
			console.log("node is not defined ",path);
		} else {
			treeNode.set('text', node_status.commandStr);
			treeNode.set('state', node_status.state);
			treeNode.set('metaData', node_status.metaState);
			treeNode.set('errors', array_toString(node_status.errors));
			treeNode.set('qtip', QueueSpace.generateStatus(node_status));
			treeNode.set('cls', 'node-style-' + node_css_type(node_status.state));
			// TODO: finish icons
			treeNode.set('iconCls', 'node-icon-' + node_css_type(node_status.state));
		}

	};

	QueueSpace.reset_queue = function(state) {
		// only happens when the server restarts
		//console.log("queue reset", state);
		QueueSpace.treeRoot.removeAll(false);
		QueueSpace.build_tree(QueueSpace.treeRoot, state.queue);
		QueueSpace.treeRoot.expand(false);
	};
});
