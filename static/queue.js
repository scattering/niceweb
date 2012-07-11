Ext.require(['Ext.tree.*', 'Ext.data.*']);

Ext.onReady(function() {

			var store = Ext.create('Ext.data.TreeStore', {
						root : {
							text : 'Root',
							expanded : true,
							children : [{
										text : 'Child 1',
										leaf : true
									}, {
										text : 'Child 2',
										leaf : true
									}

							]
						}
					});

			// create the Tree
			var tree = Ext.create('Ext.tree.Panel', {
						store : store,
						hideHeaders : true,
						rootVisible : true,
						viewConfig : {
							plugins : [{
										ptype : 'treeviewdragdrop'
									}]
						},
						height : 350,
						width : 400,
						title : 'Directory Listing',
						renderTo : 'nice-queue',
						collapsible : true
					});

			var root = tree.getRootNode();

			var parent = root.appendChild({
						text : 'Parent 1'
					});

			parent.appendChild({
						text : 'Child 3',
						leaf : true
					});

			parent.expand();

		});
