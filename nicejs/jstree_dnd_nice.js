/**
 * ### Drag'n'drop plugin
 *
 * Enables dragging and dropping of nodes in the tree, resulting in a move or copy operations.
 */

	/**
	 * stores all defaults for the drag'n'drop plugin
	 * @name $.jstree.defaults.dnd_nice
	 * @plugin dnd_nice
	 */
	$.jstree.defaults.dnd_nice = {
		/**
		 * a boolean indicating if a copy should be possible while dragging (by pressint the meta key or Ctrl). Defaults to `true`.
		 * @name $.jstree.defaults.dnd_nice.copy
		 * @plugin dnd_nice
		 */
		copy : true,
		/**
		 * a number indicating how long a node should remain hovered while dragging to be opened. Defaults to `500`.
		 * @name $.jstree.defaults.dnd_nice.open_timeout
		 * @plugin dnd_nice
		 */
		open_timeout : 500,
		/**
		 * a function invoked each time a node is about to be dragged, invoked in the tree's scope and receives the nodes about to be dragged as an argument (array) - return `false` to prevent dragging
		 * @name $.jstree.defaults.dnd_nice.is_draggable
		 * @plugin dnd_nice
		 */
		is_draggable : true,
		/**
		 * a boolean indicating if checks should constantly be made while the user is dragging the node (as opposed to checking only on drop), default is `true`
		 * @name $.jstree.defaults.dnd_nice.check_while_dragging
		 * @plugin dnd_nice
		 */
		check_while_dragging : true,
		/**
		 * a boolean indicating if nodes from this tree should only be copied with dnd_nice (as opposed to moved), default is `false`
		 * @name $.jstree.defaults.dnd_nice.always_copy
		 * @plugin dnd_nice
		 */
		always_copy : false,
		/**
		 * when dropping a node "inside", this setting indicates the position the node should go to - it can be an integer or a string: "first" (same as 0) or "last", default is `0`
		 * @name $.jstree.defaults.dnd_nice.inside_pos
		 * @plugin dnd_nice
		 */
		inside_pos : 0,
		/**
		 * when starting the drag on a node that is selected this setting controls if all selected nodes are dragged or only the single node, default is `true`, which means all selected nodes are dragged when the drag is started on a selected node
		 * @name $.jstree.defaults.dnd_nice.drag_selection
		 * @plugin dnd_nice
		 */
		drag_selection : true,
		/**
		 * controls whether dnd_nice works on touch devices. If left as boolean true dnd_nice will work the same as in desktop browsers, which in some cases may impair scrolling. If set to boolean false dnd_nice will not work on touch devices. There is a special third option - string "selected" which means only selected nodes can be dragged on touch devices.
		 * @name $.jstree.defaults.dnd_nice.touch
		 * @plugin dnd_nice
		 */
		touch : true
	};
	// TODO: now check works by checking for each node individually, how about max_children, unique, etc?
	$.jstree.plugins.dnd_nice = function (options, parent) {
		this.bind = function () {
			parent.bind.call(this);

			this.element
				.on('mousedown.jstree touchstart.jstree', '.jstree-anchor', $.proxy(function (e) {
					if(e.type === "touchstart" && (!this.settings.dnd_nice.touch || (this.settings.dnd_nice.touch === 'selected' && !$(e.currentTarget).hasClass('jstree-clicked')))) {
						return true;
					}
					var obj = this.get_node(e.target),
						mlt = this.is_selected(obj) && this.settings.drag_selection ? this.get_selected().length : 1,
						txt = (mlt > 1 ? mlt + ' ' + this.get_string('nodes') : this.get_text(e.currentTarget));
					if(this.settings.core.force_text) {
						txt = $('<div />').text(txt).html();
					}
					if(obj && obj.id && obj.id !== "#" && (e.which === 1 || e.type === "touchstart") &&
						(this.settings.dnd_nice.is_draggable === true || ($.isFunction(this.settings.dnd_nice.is_draggable) && this.settings.dnd_nice.is_draggable.call(this, (mlt > 1 ? this.get_selected(true) : [obj]))))
					) {
						this.element.trigger('mousedown.jstree');
						return $.vakata.dnd_nice.start(e, { 'jstree' : true, 'origin' : this, 'obj' : this.get_node(obj,true), 'nodes' : mlt > 1 ? this.get_selected() : [obj.id] }, '<div id="jstree-dnd" class="jstree-' + this.get_theme() + ' jstree-' + this.get_theme() + '-' + this.get_theme_variant() + ' ' + ( this.settings.core.themes.responsive ? ' jstree-dnd-responsive' : '' ) + '"><i class="jstree-icon jstree-er"></i>' + txt + '<ins class="jstree-copy" style="display:none;">+</ins></div>');
					}
				}, this));
		};
	};

	$(function() {
		// bind only once for all instances
		var lastmv = false,
			laster = false,
			opento = false,
			marker = $('<div id="jstree-marker">&#160;</div>').hide(); //.appendTo('body');

		$(document)
			.on('dnd_nice_start.vakata.jstree', function (e, data) {
				lastmv = false;
				if(!data || !data.data || !data.data.jstree) { return; }
				marker.appendTo('body'); //.show();
			})
			.on('dnd_nice_move.vakata.jstree', function (e, data) {
				if(opento) { clearTimeout(opento); }
				if(!data || !data.data || !data.data.jstree) { return; }

				// if we are hovering the marker image do nothing (can happen on "inside" drags)
				if(data.event.target.id && data.event.target.id === 'jstree-marker') {
					return;
				}

				var ins = $.jstree.reference(data.event.target),
					ref = false,
					off = false,
					rel = false,
					l, t, h, p, i, o, ok, t1, t2, op, ps, pr, ip, tm;
				// if we are over an instance
				if(ins && ins._data && ins._data.dnd_nice) {
					marker.attr('class', 'jstree-' + ins.get_theme() + ( ins.settings.core.themes.responsive ? ' jstree-dnd-responsive' : '' ));
					data.helper
						.children().attr('class', 'jstree-' + ins.get_theme() + ' jstree-' + ins.get_theme() + '-' + ins.get_theme_variant() + ' ' + ( ins.settings.core.themes.responsive ? ' jstree-dnd-responsive' : '' ))
						.find('.jstree-copy').first()[ data.data.origin && (data.data.origin.settings.dnd_nice.always_copy || (data.data.origin.settings.dnd_nice.copy && (data.event.metaKey || data.event.ctrlKey))) ? 'show' : 'hide' ]();


					// if are hovering the container itself add a new root node
					if( (data.event.target === ins.element[0] || data.event.target === ins.get_container_ul()[0]) && ins.get_container_ul().children().length === 0) {
						ok = true;
						for(t1 = 0, t2 = data.data.nodes.length; t1 < t2; t1++) {
							ok = ok && ins.check( (data.data.origin && (data.data.origin.settings.dnd_nice.always_copy || (data.data.origin.settings.dnd_nice.copy && (data.event.metaKey || data.event.ctrlKey)) ) ? "copy_node" : "move_node"), (data.data.origin && data.data.origin !== ins ? data.data.origin.get_node(data.data.nodes[t1]) : data.data.nodes[t1]), '#', 'last', { 'dnd_nice' : true, 'ref' : ins.get_node('#'), 'pos' : 'i', 'is_multi' : (data.data.origin && data.data.origin !== ins), 'is_foreign' : (!data.data.origin) });
							if(!ok) { break; }
						}
						if(ok) {
							lastmv = { 'ins' : ins, 'par' : '#', 'pos' : 'last' };
							marker.hide();
							data.helper.find('.jstree-icon').first().removeClass('jstree-er').addClass('jstree-ok');
							return;
						}
					}
					else {
						// if we are hovering a tree node
						ref = $(data.event.target).closest('.jstree-anchor');
						if(ref && ref.length && ref.parent().is('.jstree-closed, .jstree-open, .jstree-leaf')) {
							off = ref.offset();
							rel = data.event.pageY - off.top;
							h = ref.height();
							if(rel < h / 3) {
								//o = ['b', 'i', 'a'];
								o = ['b', 'a'];
							}
							else if(rel > h - h / 3) {
								//o = ['a', 'i', 'b'];
								o = ['a', 'b'];
							}
							else {
								//o = rel > h / 2 ? ['i', 'a', 'b'] : ['i', 'b', 'a'];
								o = rel > h / 2 ? ['a', 'b'] : ['b', 'a'];
							}
							$.each(o, function (j, v) {
								switch(v) {
									case 'b':
										l = off.left - 6;
										t = off.top;
										p = ins.get_parent(ref);
										i = ref.parent().index();
										break;
									case 'i':
										ip = ins.settings.dnd_nice.inside_pos;
										tm = ins.get_node(ref.parent());
										l = off.left - 2;
										t = off.top + h / 2 + 1;
										p = tm.id;
										i = ip === 'first' ? 0 : (ip === 'last' ? tm.children.length : Math.min(ip, tm.children.length));
										break;
									case 'a':
										l = off.left - 6;
										t = off.top + h;
										p = ins.get_parent(ref);
										i = ref.parent().index() + 1;
										break;
								}
								ok = true;
								for(t1 = 0, t2 = data.data.nodes.length; t1 < t2; t1++) {
									op = data.data.origin && (data.data.origin.settings.dnd_nice.always_copy || (data.data.origin.settings.dnd_nice.copy && (data.event.metaKey || data.event.ctrlKey))) ? "copy_node" : "move_node";
									ps = i;
									if(op === "move_node" && v === 'a' && (data.data.origin && data.data.origin === ins) && p === ins.get_parent(data.data.nodes[t1])) {
										pr = ins.get_node(p);
										if(ps > $.inArray(data.data.nodes[t1], pr.children)) {
											ps -= 1;
										}
									}
									ok = ok && ( (ins && ins.settings && ins.settings.dnd_nice && ins.settings.dnd_nice.check_while_dragging === false) || ins.check(op, (data.data.origin && data.data.origin !== ins ? data.data.origin.get_node(data.data.nodes[t1]) : data.data.nodes[t1]), p, ps, { 'dnd_nice' : true, 'ref' : ins.get_node(ref.parent()), 'pos' : v, 'is_multi' : (data.data.origin && data.data.origin !== ins), 'is_foreign' : (!data.data.origin) }) );
									if(!ok) {
										if(ins && ins.last_error) { laster = ins.last_error(); }
										break;
									}
								}
								if(v === 'i' && ref.parent().is('.jstree-closed') && ins.settings.dnd_nice.open_timeout) {
									opento = setTimeout((function (x, z) { return function () { x.open_node(z); }; }(ins, ref)), ins.settings.dnd_nice.open_timeout);
								}
								if(ok) {
									lastmv = { 'ins' : ins, 'par' : p, 'pos' : v === 'i' && ip === 'last' && i === 0 && !ins.is_loaded(tm) ? 'last' : i };
									marker.css({ 'left' : l + 'px', 'top' : t + 'px' }).show();
									data.helper.find('.jstree-icon').first().removeClass('jstree-er').addClass('jstree-ok');
									laster = {};
									o = true;
									return false;
								}
							});
							if(o === true) { return; }
						}
					}
				}
				lastmv = false;
				data.helper.find('.jstree-icon').removeClass('jstree-ok').addClass('jstree-er');
				marker.hide();
			})
			.on('dnd_nice_scroll.vakata.jstree', function (e, data) {
				if(!data || !data.data || !data.data.jstree) { return; }
				marker.hide();
				lastmv = false;
				data.helper.find('.jstree-icon').first().removeClass('jstree-ok').addClass('jstree-er');
			})
			.on('dnd_nice_stop.vakata.jstree', function (e, data) {
				if(opento) { clearTimeout(opento); }
				if(!data || !data.data || !data.data.jstree) { return; }
				marker.hide().detach();
				var i, j, nodes = [];
				if(lastmv) {
					for(i = 0, j = data.data.nodes.length; i < j; i++) {
						nodes[i] = data.data.origin ? data.data.origin.get_node(data.data.nodes[i]) : data.data.nodes[i];
						if(data.data.origin) {
							nodes[i].instance = data.data.origin;
						}
					}
					lastmv.ins[ data.data.origin && (data.data.origin.settings.dnd_nice.always_copy || (data.data.origin.settings.dnd_nice.copy && (data.event.metaKey || data.event.ctrlKey))) ? 'copy_node' : 'move_node' ](nodes, lastmv.par, lastmv.pos);
					for(i = 0, j = nodes.length; i < j; i++) {
						if(nodes[i].instance) {
							nodes[i].instance = null;
						}
					}
				}
				else {
					i = $(data.event.target).closest('.jstree');
					if(i.length && laster && laster.error && laster.error === 'check') {
						i = i.jstree(true);
						if(i) {
							i.settings.core.error.call(this, laster);
						}
					}
				}
			})
			.on('keyup.jstree keydown.jstree', function (e, data) {
				data = $.vakata.dnd_nice._get();
				if(data && data.data && data.data.jstree) {
					data.helper.find('.jstree-copy').first()[ data.data.origin && (data.data.origin.settings.dnd_nice.always_copy || (data.data.origin.settings.dnd_nice.copy && (e.metaKey || e.ctrlKey))) ? 'show' : 'hide' ]();
				}
			});
	});

	// helpers
	(function ($) {
		// private variable
		var vakata_dnd_nice = {
			element	: false,
			target	: false,
			is_down	: false,
			is_drag	: false,
			helper	: false,
			helper_w: 0,
			data	: false,
			init_x	: 0,
			init_y	: 0,
			scroll_l: 0,
			scroll_t: 0,
			scroll_e: false,
			scroll_i: false,
			is_touch: false
		};
		$.vakata.dnd_nice = {
			settings : {
				scroll_speed		: 10,
				scroll_proximity	: 20,
				helper_left			: 5,
				helper_top			: 10,
				threshold			: 5,
				threshold_touch		: 50
			},
			_trigger : function (event_name, e) {
				var data = $.vakata.dnd_nice._get();
				data.event = e;
				$(document).triggerHandler("dnd_nice_" + event_name + ".vakata", data);
			},
			_get : function () {
				return {
					"data"		: vakata_dnd_nice.data,
					"element"	: vakata_dnd_nice.element,
					"helper"	: vakata_dnd_nice.helper
				};
			},
			_clean : function () {
				if(vakata_dnd_nice.helper) { vakata_dnd_nice.helper.remove(); }
				if(vakata_dnd_nice.scroll_i) { clearInterval(vakata_dnd_nice.scroll_i); vakata_dnd_nice.scroll_i = false; }
				vakata_dnd_nice = {
					element	: false,
					target	: false,
					is_down	: false,
					is_drag	: false,
					helper	: false,
					helper_w: 0,
					data	: false,
					init_x	: 0,
					init_y	: 0,
					scroll_l: 0,
					scroll_t: 0,
					scroll_e: false,
					scroll_i: false,
					is_touch: false
				};
				$(document).off("mousemove.vakata.jstree touchmove.vakata.jstree", $.vakata.dnd_nice.drag);
				$(document).off("mouseup.vakata.jstree touchend.vakata.jstree", $.vakata.dnd_nice.stop);
			},
			_scroll : function (init_only) {
				if(!vakata_dnd_nice.scroll_e || (!vakata_dnd_nice.scroll_l && !vakata_dnd_nice.scroll_t)) {
					if(vakata_dnd_nice.scroll_i) { clearInterval(vakata_dnd_nice.scroll_i); vakata_dnd_nice.scroll_i = false; }
					return false;
				}
				if(!vakata_dnd_nice.scroll_i) {
					vakata_dnd_nice.scroll_i = setInterval($.vakata.dnd_nice._scroll, 100);
					return false;
				}
				if(init_only === true) { return false; }

				var i = vakata_dnd_nice.scroll_e.scrollTop(),
					j = vakata_dnd_nice.scroll_e.scrollLeft();
				vakata_dnd_nice.scroll_e.scrollTop(i + vakata_dnd_nice.scroll_t * $.vakata.dnd_nice.settings.scroll_speed);
				vakata_dnd_nice.scroll_e.scrollLeft(j + vakata_dnd_nice.scroll_l * $.vakata.dnd_nice.settings.scroll_speed);
				if(i !== vakata_dnd_nice.scroll_e.scrollTop() || j !== vakata_dnd_nice.scroll_e.scrollLeft()) {
					/**
					 * triggered on the document when a drag causes an element to scroll
					 * @event
					 * @plugin dnd_nice
					 * @name dnd_nice_scroll.vakata
					 * @param {Mixed} data any data supplied with the call to $.vakata.dnd_nice.start
					 * @param {DOM} element the DOM element being dragged
					 * @param {jQuery} helper the helper shown next to the mouse
					 * @param {jQuery} event the element that is scrolling
					 */
					$.vakata.dnd_nice._trigger("scroll", vakata_dnd_nice.scroll_e);
				}
			},
			start : function (e, data, html) {
				if(e.type === "touchstart" && e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0]) {
					e.pageX = e.originalEvent.changedTouches[0].pageX;
					e.pageY = e.originalEvent.changedTouches[0].pageY;
					e.target = document.elementFromPoint(e.originalEvent.changedTouches[0].pageX - window.pageXOffset, e.originalEvent.changedTouches[0].pageY - window.pageYOffset);
				}
				if(vakata_dnd_nice.is_drag) { $.vakata.dnd_nice.stop({}); }
				try {
					e.currentTarget.unselectable = "on";
					e.currentTarget.onselectstart = function() { return false; };
					if(e.currentTarget.style) { e.currentTarget.style.MozUserSelect = "none"; }
				} catch(ignore) { }
				vakata_dnd_nice.init_x	= e.pageX;
				vakata_dnd_nice.init_y	= e.pageY;
				vakata_dnd_nice.data		= data;
				vakata_dnd_nice.is_down	= true;
				vakata_dnd_nice.element	= e.currentTarget;
				vakata_dnd_nice.target	= e.target;
				vakata_dnd_nice.is_touch	= e.type === "touchstart";
				if(html !== false) {
					vakata_dnd_nice.helper = $("<div id='vakata-dnd_nice'></div>").html(html).css({
						"display"		: "block",
						"margin"		: "0",
						"padding"		: "0",
						"position"		: "absolute",
						"top"			: "-2000px",
						"lineHeight"	: "16px",
						"zIndex"		: "10000"
					});
				}
				$(document).on("mousemove.vakata.jstree touchmove.vakata.jstree", $.vakata.dnd_nice.drag);
				$(document).on("mouseup.vakata.jstree touchend.vakata.jstree", $.vakata.dnd_nice.stop);
				return false;
			},
			drag : function (e) {
				if(e.type === "touchmove" && e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0]) {
					e.pageX = e.originalEvent.changedTouches[0].pageX;
					e.pageY = e.originalEvent.changedTouches[0].pageY;
					e.target = document.elementFromPoint(e.originalEvent.changedTouches[0].pageX - window.pageXOffset, e.originalEvent.changedTouches[0].pageY - window.pageYOffset);
				}
				if(!vakata_dnd_nice.is_down) { return; }
				if(!vakata_dnd_nice.is_drag) {
					if(
						Math.abs(e.pageX - vakata_dnd_nice.init_x) > (vakata_dnd_nice.is_touch ? $.vakata.dnd_nice.settings.threshold_touch : $.vakata.dnd_nice.settings.threshold) ||
						Math.abs(e.pageY - vakata_dnd_nice.init_y) > (vakata_dnd_nice.is_touch ? $.vakata.dnd_nice.settings.threshold_touch : $.vakata.dnd_nice.settings.threshold)
					) {
						if(vakata_dnd_nice.helper) {
							vakata_dnd_nice.helper.appendTo("body");
							vakata_dnd_nice.helper_w = vakata_dnd_nice.helper.outerWidth();
						}
						vakata_dnd_nice.is_drag = true;
						/**
						 * triggered on the document when a drag starts
						 * @event
						 * @plugin dnd_nice
						 * @name dnd_nice_start.vakata
						 * @param {Mixed} data any data supplied with the call to $.vakata.dnd_nice.start
						 * @param {DOM} element the DOM element being dragged
						 * @param {jQuery} helper the helper shown next to the mouse
						 * @param {Object} event the event that caused the start (probably mousemove)
						 */
						$.vakata.dnd_nice._trigger("start", e);
					}
					else { return; }
				}

				var d  = false, w  = false,
					dh = false, wh = false,
					dw = false, ww = false,
					dt = false, dl = false,
					ht = false, hl = false;

				vakata_dnd_nice.scroll_t = 0;
				vakata_dnd_nice.scroll_l = 0;
				vakata_dnd_nice.scroll_e = false;
				$($(e.target).parentsUntil("body").addBack().get().reverse())
					.filter(function () {
						return	(/^auto|scroll$/).test($(this).css("overflow")) &&
								(this.scrollHeight > this.offsetHeight || this.scrollWidth > this.offsetWidth);
					})
					.each(function () {
						var t = $(this), o = t.offset();
						if(this.scrollHeight > this.offsetHeight) {
							if(o.top + t.height() - e.pageY < $.vakata.dnd_nice.settings.scroll_proximity)	{ vakata_dnd_nice.scroll_t = 1; }
							if(e.pageY - o.top < $.vakata.dnd_nice.settings.scroll_proximity)				{ vakata_dnd_nice.scroll_t = -1; }
						}
						if(this.scrollWidth > this.offsetWidth) {
							if(o.left + t.width() - e.pageX < $.vakata.dnd_nice.settings.scroll_proximity)	{ vakata_dnd_nice.scroll_l = 1; }
							if(e.pageX - o.left < $.vakata.dnd_nice.settings.scroll_proximity)				{ vakata_dnd_nice.scroll_l = -1; }
						}
						if(vakata_dnd_nice.scroll_t || vakata_dnd_nice.scroll_l) {
							vakata_dnd_nice.scroll_e = $(this);
							return false;
						}
					});

				if(!vakata_dnd_nice.scroll_e) {
					d  = $(document); w = $(window);
					dh = d.height(); wh = w.height();
					dw = d.width(); ww = w.width();
					dt = d.scrollTop(); dl = d.scrollLeft();
					if(dh > wh && e.pageY - dt < $.vakata.dnd_nice.settings.scroll_proximity)		{ vakata_dnd_nice.scroll_t = -1;  }
					if(dh > wh && wh - (e.pageY - dt) < $.vakata.dnd_nice.settings.scroll_proximity)	{ vakata_dnd_nice.scroll_t = 1; }
					if(dw > ww && e.pageX - dl < $.vakata.dnd_nice.settings.scroll_proximity)		{ vakata_dnd_nice.scroll_l = -1; }
					if(dw > ww && ww - (e.pageX - dl) < $.vakata.dnd_nice.settings.scroll_proximity)	{ vakata_dnd_nice.scroll_l = 1; }
					if(vakata_dnd_nice.scroll_t || vakata_dnd_nice.scroll_l) {
						vakata_dnd_nice.scroll_e = d;
					}
				}
				if(vakata_dnd_nice.scroll_e) { $.vakata.dnd_nice._scroll(true); }

				if(vakata_dnd_nice.helper) {
					ht = parseInt(e.pageY + $.vakata.dnd_nice.settings.helper_top, 10);
					hl = parseInt(e.pageX + $.vakata.dnd_nice.settings.helper_left, 10);
					if(dh && ht + 25 > dh) { ht = dh - 50; }
					if(dw && hl + vakata_dnd_nice.helper_w > dw) { hl = dw - (vakata_dnd_nice.helper_w + 2); }
					vakata_dnd_nice.helper.css({
						left	: hl + "px",
						top		: ht + "px"
					});
				}
				/**
				 * triggered on the document when a drag is in progress
				 * @event
				 * @plugin dnd_nice
				 * @name dnd_nice_move.vakata
				 * @param {Mixed} data any data supplied with the call to $.vakata.dnd_nice.start
				 * @param {DOM} element the DOM element being dragged
				 * @param {jQuery} helper the helper shown next to the mouse
				 * @param {Object} event the event that caused this to trigger (most likely mousemove)
				 */
				$.vakata.dnd_nice._trigger("move", e);
				return false;
			},
			stop : function (e) {
				if(e.type === "touchend" && e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0]) {
					e.pageX = e.originalEvent.changedTouches[0].pageX;
					e.pageY = e.originalEvent.changedTouches[0].pageY;
					e.target = document.elementFromPoint(e.originalEvent.changedTouches[0].pageX - window.pageXOffset, e.originalEvent.changedTouches[0].pageY - window.pageYOffset);
				}
				if(vakata_dnd_nice.is_drag) {
					/**
					 * triggered on the document when a drag stops (the dragged element is dropped)
					 * @event
					 * @plugin dnd_nice
					 * @name dnd_nice_stop.vakata
					 * @param {Mixed} data any data supplied with the call to $.vakata.dnd_nice.start
					 * @param {DOM} element the DOM element being dragged
					 * @param {jQuery} helper the helper shown next to the mouse
					 * @param {Object} event the event that caused the stop
					 */
					$.vakata.dnd_nice._trigger("stop", e);
				}
				else {
					if(e.type === "touchend" && e.target === vakata_dnd_nice.target) {
						var to = setTimeout(function () { $(e.target).click(); }, 100);
						$(e.target).one('click', function() { if(to) { clearTimeout(to); } });
					}
				}
				$.vakata.dnd_nice._clean();
				return false;
			}
		};
	}($));
