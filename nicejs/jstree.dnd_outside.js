/**
 * ### Drag'n'drop plugin
 *
 * Enables dragging and dropping of nodes in the tree, resulting in a move or copy operations.
 */
/*globals jQuery, define, exports, require, document */
(function (factory) {
	"use strict";
	if (typeof define === 'function' && define.amd) {
		define('jstree.dnd_outside', ['jquery','jstree'], factory);
	}
	else if(typeof exports === 'object') {
		factory(require('jquery'), require('jstree'));
	}
	else {
		factory(jQuery, jQuery.jstree);
	}
}(function ($, jstree, undefined) {
	"use strict";

	if($.jstree.plugins.dnd_outside) { return; }

	/**
	 * stores all defaults for the drag'n'drop plugin
	 * @name $.jstree.defaults.dnd_outside
	 * @plugin dnd_outside
	 */
	$.jstree.defaults.dnd_outside = {
		/**
		 * a boolean indicating if a copy should be possible while dragging (by pressint the meta key or Ctrl). Defaults to `true`.
		 * @name $.jstree.defaults.dnd_outside.copy
		 * @plugin dnd_outside
		 */
		copy : true,
		/**
		 * a number indicating how long a node should remain hovered while dragging to be opened. Defaults to `500`.
		 * @name $.jstree.defaults.dnd_outside.open_timeout
		 * @plugin dnd_outside
		 */
		open_timeout : 500,
		/**
		 * a function invoked each time a node is about to be dragged, invoked in the tree's scope and receives the nodes about to be dragged as an argument (array) and the event that started the drag - return `false` to prevent dragging
		 * @name $.jstree.defaults.dnd_outside.is_draggable
		 * @plugin dnd_outside
		 */
		is_draggable : true,
		/**
		 * a boolean indicating if checks should constantly be made while the user is dragging the node (as opposed to checking only on drop), default is `true`
		 * @name $.jstree.defaults.dnd_outside.check_while_dragging
		 * @plugin dnd_outside
		 */
		check_while_dragging : true,
		/**
		 * a boolean indicating if nodes from this tree should only be copied with dnd_outside (as opposed to moved), default is `false`
		 * @name $.jstree.defaults.dnd_outside.always_copy
		 * @plugin dnd_outside
		 */
		always_copy : false,
		/**
		 * when dropping a node "inside", this setting indicates the position the node should go to - it can be an integer or a string: "first" (same as 0) or "last", default is `0`
		 * @name $.jstree.defaults.dnd_outside.inside_pos
		 * @plugin dnd_outside
		 */
		inside_pos : 0,
		/**
		 * when starting the drag on a node that is selected this setting controls if all selected nodes are dragged or only the single node, default is `true`, which means all selected nodes are dragged when the drag is started on a selected node
		 * @name $.jstree.defaults.dnd_outside.drag_selection
		 * @plugin dnd_outside
		 */
		drag_selection : true,
		/**
		 * controls whether dnd_outside works on touch devices. If left as boolean true dnd_outside will work the same as in desktop browsers, which in some cases may impair scrolling. If set to boolean false dnd_outside will not work on touch devices. There is a special third option - string "selected" which means only selected nodes can be dragged on touch devices.
		 * @name $.jstree.defaults.dnd_outside.touch
		 * @plugin dnd_outside
		 */
		touch : true,
		/**
		 * controls whether items can be dropped anywhere on the node, not just on the anchor, by default only the node anchor is a valid drop target. Works best with the wholerow plugin. If enabled on mobile depending on the interface it might be hard for the user to cancel the drop, since the whole tree container will be a valid drop target.
		 * @name $.jstree.defaults.dnd_outside.large_drop_target
		 * @plugin dnd_outside
		 */
		large_drop_target : false,
		/**
		 * controls whether a drag can be initiated from any part of the node and not just the text/icon part, works best with the wholerow plugin. Keep in mind it can cause problems with tree scrolling on mobile depending on the interface - in that case set the touch option to "selected".
		 * @name $.jstree.defaults.dnd_outside.large_drag_target
		 * @plugin dnd_outside
		 */
		large_drag_target : false
	};
	// TODO: now check works by checking for each node individually, how about max_children, unique, etc?
	$.jstree.plugins.dnd_outside = function (options, parent) {
		this.bind = function () {
			parent.bind.call(this);

			this.element
				.on('mousedown.jstree touchstart.jstree', this.settings.dnd_outside.large_drag_target ? '.jstree-node' : '.jstree-anchor', $.proxy(function (e) {
					if(this.settings.dnd_outside.large_drag_target && $(e.target).closest('.jstree-node')[0] !== e.currentTarget) {
						return true;
					}
					if(e.type === "touchstart" && (!this.settings.dnd_outside.touch || (this.settings.dnd_outside.touch === 'selected' && !$(e.currentTarget).closest('.jstree-node').children('.jstree-anchor').hasClass('jstree-clicked')))) {
						return true;
					}
					var obj = this.get_node(e.target),
						mlt = this.is_selected(obj) && this.settings.dnd_outside.drag_selection ? this.get_top_selected().length : 1,
						txt = (mlt > 1 ? mlt + ' ' + this.get_string('nodes') : this.get_text(e.currentTarget));
					if(this.settings.core.force_text) {
						txt = $.vakata.html.escape(txt);
					}
					if(obj && obj.id && obj.id !== $.jstree.root && (e.which === 1 || e.type === "touchstart") &&
						(this.settings.dnd_outside.is_draggable === true || ($.isFunction(this.settings.dnd_outside.is_draggable) && this.settings.dnd_outside.is_draggable.call(this, (mlt > 1 ? this.get_top_selected(true) : [obj]), e)))
					) {
						this.element.trigger('mousedown.jstree');
						return $.vakata.dnd_outside.start(e, { 'jstree' : true, 'origin' : this, 'obj' : this.get_node(obj,true), 'nodes' : mlt > 1 ? this.get_top_selected() : [obj.id] }, '<div id="jstree-dnd" class="jstree-' + this.get_theme() + ' jstree-' + this.get_theme() + '-' + this.get_theme_variant() + ' ' + ( this.settings.core.themes.responsive ? ' jstree-dnd-responsive' : '' ) + '"><i class="jstree-icon jstree-er"></i>' + txt + '<ins class="jstree-copy" style="display:none;">+</ins></div>');
					}
				}, this));
		};
	};

	$(function() {
		// bind only once for all instances
		var lastmv = false,
			laster = false,
			lastev = false,
			opento = false,
			marker = $('<div id="jstree-marker">&#160;</div>').hide(); //.appendTo('body');

		$(document)
			.on('dnd_outside_start.vakata.jstree', function (e, data) {
				lastmv = false;
				lastev = false;
				if(!data || !data.data || !data.data.jstree) { return; }
				marker.appendTo('body'); //.show();
			})
			.on('dnd_outside_move.vakata.jstree', function (e, data) {
				if(opento) { clearTimeout(opento); }
				if(!data || !data.data || !data.data.jstree) { return; }

				// if we are hovering the marker image do nothing (can happen on "inside" drags)
				if(data.event.target.id && data.event.target.id === 'jstree-marker') {
					return;
				}
				lastev = data.event;

				var ins = $.jstree.reference(data.event.target),
					ref = false,
					off = false,
					rel = false,
					tmp, l, t, h, p, i, o, ok, t1, t2, op, ps, pr, ip, tm;
				// if we are over an instance
				if(ins && ins._data && ins._data.dnd_outside) {
					marker.attr('class', 'jstree-' + ins.get_theme() + ( ins.settings.core.themes.responsive ? ' jstree-dnd-responsive' : '' ));
					data.helper
						.children().attr('class', 'jstree-' + ins.get_theme() + ' jstree-' + ins.get_theme() + '-' + ins.get_theme_variant() + ' ' + ( ins.settings.core.themes.responsive ? ' jstree-dnd-responsive' : '' ))
						.find('.jstree-copy').first()[ data.data.origin && (data.data.origin.settings.dnd_outside.always_copy || (data.data.origin.settings.dnd_outside.copy && (data.event.metaKey || data.event.ctrlKey))) ? 'show' : 'hide' ]();


					// if are hovering the container itself add a new root node
					if( (data.event.target === ins.element[0] || data.event.target === ins.get_container_ul()[0]) && ins.get_container_ul().children().length === 0) {
						ok = true;
						for(t1 = 0, t2 = data.data.nodes.length; t1 < t2; t1++) {
							ok = ok && ins.check( (data.data.origin && (data.data.origin.settings.dnd_outside.always_copy || (data.data.origin.settings.dnd_outside.copy && (data.event.metaKey || data.event.ctrlKey)) ) ? "copy_node" : "move_node"), (data.data.origin && data.data.origin !== ins ? data.data.origin.get_node(data.data.nodes[t1]) : data.data.nodes[t1]), $.jstree.root, 'last', { 'dnd_outside' : true, 'ref' : ins.get_node($.jstree.root), 'pos' : 'i', 'origin' : data.data.origin, 'is_multi' : (data.data.origin && data.data.origin !== ins), 'is_foreign' : (!data.data.origin) });
							if(!ok) { break; }
						}
						if(ok) {
							lastmv = { 'ins' : ins, 'par' : $.jstree.root, 'pos' : 'last' };
							marker.hide();
							data.helper.find('.jstree-icon').first().removeClass('jstree-er').addClass('jstree-ok');
							return;
						}
					}
					else {
						// if we are hovering a tree node
						ref = ins.settings.dnd_outside.large_drop_target ? $(data.event.target).closest('.jstree-node').children('.jstree-anchor') : $(data.event.target).closest('.jstree-anchor');
						if(ref && ref.length && ref.parent().is('.jstree-closed, .jstree-open, .jstree-leaf')) {
							off = ref.offset();
							rel = data.event.pageY - off.top;
							h = ref.outerHeight();
							// all references to 'i' are removed here: 
							// eliminates the possibility of dropping a dragged node onto a closed tree branch.
							// We only want to move the node to opened tree branches.
							if(rel < h / 3) {
								o = ['b', 'a'];
							}
							else if(rel > h - h / 3) {
								o = ['a', 'b'];
							}
							else {
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
										ip = ins.settings.dnd_outside.inside_pos;
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
								console.log('p:', p, 'i:', i);
								for(t1 = 0, t2 = data.data.nodes.length; t1 < t2; t1++) {
									op = data.data.origin && (data.data.origin.settings.dnd_outside.always_copy || (data.data.origin.settings.dnd_outside.copy && (data.event.metaKey || data.event.ctrlKey))) ? "copy_node" : "move_node";
									ps = i;
									if(op === "move_node" && v === 'a' && (data.data.origin && data.data.origin === ins) && p === ins.get_parent(data.data.nodes[t1])) {
										pr = ins.get_node(p);
										if(ps > $.inArray(data.data.nodes[t1], pr.children)) {
											ps -= 1;
										}
									}
									ok = ok && ( (ins && ins.settings && ins.settings.dnd_outside && ins.settings.dnd_outside.check_while_dragging === false) || ins.check(op, (data.data.origin && data.data.origin !== ins ? data.data.origin.get_node(data.data.nodes[t1]) : data.data.nodes[t1]), p, ps, { 'dnd_outside' : true, 'ref' : ins.get_node(ref.parent()), 'pos' : v, 'origin' : data.data.origin, 'is_multi' : (data.data.origin && data.data.origin !== ins), 'is_foreign' : (!data.data.origin) }) );
									if(!ok) {
										if(ins && ins.last_error) { laster = ins.last_error(); }
										break;
									}
								}
								if(v === 'i' && ref.parent().is('.jstree-closed') && ins.settings.dnd_outside.open_timeout) {
									opento = setTimeout((function (x, z) { return function () { x.open_node(z); }; }(ins, ref)), ins.settings.dnd_outside.open_timeout);
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
			.on('dnd_outside_scroll.vakata.jstree', function (e, data) {
				if(!data || !data.data || !data.data.jstree) { return; }
				marker.hide();
				lastmv = false;
				lastev = false;
				data.helper.find('.jstree-icon').first().removeClass('jstree-ok').addClass('jstree-er');
			})
			.on('dnd_outside_stop.vakata.jstree', function (e, data) {
				if(opento) { clearTimeout(opento); }
				if(!data || !data.data || !data.data.jstree) { return; }
				marker.hide().detach();
				var i, j, nodes = [];
				if(lastmv) {
					for(i = 0, j = data.data.nodes.length; i < j; i++) {
						nodes[i] = data.data.origin ? data.data.origin.get_node(data.data.nodes[i]) : data.data.nodes[i];
					}
					var evdata = {'nodes': nodes, 'par': lastmv.par, 'pos': lastmv.pos, 'origin': data.data.origin};
					// hand off the actual movement of nodes to another event handler, 'finish'
					// this is done so that we can trigger commands on a remote tree structure rather than manipulating this one
					// when the remote model is updated, this tree will update too.
					$(document).triggerHandler("dnd_outside_finish.vakata", evdata);
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
				lastev = false;
				lastmv = false;
			})
			.on('keyup.jstree keydown.jstree', function (e, data) {
				data = $.vakata.dnd_outside._get();
				if(data && data.data && data.data.jstree) {
					data.helper.find('.jstree-copy').first()[ data.data.origin && (data.data.origin.settings.dnd_outside.always_copy || (data.data.origin.settings.dnd_outside.copy && (e.metaKey || e.ctrlKey))) ? 'show' : 'hide' ]();
					if(lastev) {
						lastev.metaKey = e.metaKey;
						lastev.ctrlKey = e.ctrlKey;
						$.vakata.dnd_outside._trigger('move', lastev);
					}
				}
			});
	});

	// helpers
	(function ($) {
		$.vakata.html = {
			div : $('<div />'),
			escape : function (str) {
				return $.vakata.html.div.text(str).html();
			},
			strip : function (str) {
				return $.vakata.html.div.empty().append($.parseHTML(str)).text();
			}
		};
		// private variable
		var vakata_dnd_outside = {
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
		$.vakata.dnd_outside = {
			settings : {
				scroll_speed		: 10,
				scroll_proximity	: 20,
				helper_left			: 5,
				helper_top			: 10,
				threshold			: 5,
				threshold_touch		: 50
			},
			_trigger : function (event_name, e) {
				var data = $.vakata.dnd_outside._get();
				data.event = e;
				$(document).triggerHandler("dnd_outside_" + event_name + ".vakata", data);
			},
			_get : function () {
				return {
					"data"		: vakata_dnd_outside.data,
					"element"	: vakata_dnd_outside.element,
					"helper"	: vakata_dnd_outside.helper
				};
			},
			_clean : function () {
				if(vakata_dnd_outside.helper) { vakata_dnd_outside.helper.remove(); }
				if(vakata_dnd_outside.scroll_i) { clearInterval(vakata_dnd_outside.scroll_i); vakata_dnd_outside.scroll_i = false; }
				vakata_dnd_outside = {
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
				$(document).off("mousemove.vakata.jstree touchmove.vakata.jstree", $.vakata.dnd_outside.drag);
				$(document).off("mouseup.vakata.jstree touchend.vakata.jstree", $.vakata.dnd_outside.stop);
			},
			_scroll : function (init_only) {
				if(!vakata_dnd_outside.scroll_e || (!vakata_dnd_outside.scroll_l && !vakata_dnd_outside.scroll_t)) {
					if(vakata_dnd_outside.scroll_i) { clearInterval(vakata_dnd_outside.scroll_i); vakata_dnd_outside.scroll_i = false; }
					return false;
				}
				if(!vakata_dnd_outside.scroll_i) {
					vakata_dnd_outside.scroll_i = setInterval($.vakata.dnd_outside._scroll, 100);
					return false;
				}
				if(init_only === true) { return false; }

				var i = vakata_dnd_outside.scroll_e.scrollTop(),
					j = vakata_dnd_outside.scroll_e.scrollLeft();
				vakata_dnd_outside.scroll_e.scrollTop(i + vakata_dnd_outside.scroll_t * $.vakata.dnd_outside.settings.scroll_speed);
				vakata_dnd_outside.scroll_e.scrollLeft(j + vakata_dnd_outside.scroll_l * $.vakata.dnd_outside.settings.scroll_speed);
				if(i !== vakata_dnd_outside.scroll_e.scrollTop() || j !== vakata_dnd_outside.scroll_e.scrollLeft()) {
					/**
					 * triggered on the document when a drag causes an element to scroll
					 * @event
					 * @plugin dnd_outside
					 * @name dnd_outside_scroll.vakata
					 * @param {Mixed} data any data supplied with the call to $.vakata.dnd_outside.start
					 * @param {DOM} element the DOM element being dragged
					 * @param {jQuery} helper the helper shown next to the mouse
					 * @param {jQuery} event the element that is scrolling
					 */
					$.vakata.dnd_outside._trigger("scroll", vakata_dnd_outside.scroll_e);
				}
			},
			start : function (e, data, html) {
				if(e.type === "touchstart" && e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0]) {
					e.pageX = e.originalEvent.changedTouches[0].pageX;
					e.pageY = e.originalEvent.changedTouches[0].pageY;
					e.target = document.elementFromPoint(e.originalEvent.changedTouches[0].pageX - window.pageXOffset, e.originalEvent.changedTouches[0].pageY - window.pageYOffset);
				}
				if(vakata_dnd_outside.is_drag) { $.vakata.dnd_outside.stop({}); }
				try {
					e.currentTarget.unselectable = "on";
					e.currentTarget.onselectstart = function() { return false; };
					if(e.currentTarget.style) { e.currentTarget.style.MozUserSelect = "none"; }
				} catch(ignore) { }
				vakata_dnd_outside.init_x	= e.pageX;
				vakata_dnd_outside.init_y	= e.pageY;
				vakata_dnd_outside.data		= data;
				vakata_dnd_outside.is_down	= true;
				vakata_dnd_outside.element	= e.currentTarget;
				vakata_dnd_outside.target	= e.target;
				vakata_dnd_outside.is_touch	= e.type === "touchstart";
				if(html !== false) {
					vakata_dnd_outside.helper = $("<div id='vakata-dnd'></div>").html(html).css({
						"display"		: "block",
						"margin"		: "0",
						"padding"		: "0",
						"position"		: "absolute",
						"top"			: "-2000px",
						"lineHeight"	: "16px",
						"zIndex"		: "10000"
					});
				}
				$(document).on("mousemove.vakata.jstree touchmove.vakata.jstree", $.vakata.dnd_outside.drag);
				$(document).on("mouseup.vakata.jstree touchend.vakata.jstree", $.vakata.dnd_outside.stop);
				return false;
			},
			drag : function (e) {
				if(e.type === "touchmove" && e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0]) {
					e.pageX = e.originalEvent.changedTouches[0].pageX;
					e.pageY = e.originalEvent.changedTouches[0].pageY;
					e.target = document.elementFromPoint(e.originalEvent.changedTouches[0].pageX - window.pageXOffset, e.originalEvent.changedTouches[0].pageY - window.pageYOffset);
				}
				if(!vakata_dnd_outside.is_down) { return; }
				if(!vakata_dnd_outside.is_drag) {
					if(
						Math.abs(e.pageX - vakata_dnd_outside.init_x) > (vakata_dnd_outside.is_touch ? $.vakata.dnd_outside.settings.threshold_touch : $.vakata.dnd_outside.settings.threshold) ||
						Math.abs(e.pageY - vakata_dnd_outside.init_y) > (vakata_dnd_outside.is_touch ? $.vakata.dnd_outside.settings.threshold_touch : $.vakata.dnd_outside.settings.threshold)
					) {
						if(vakata_dnd_outside.helper) {
							vakata_dnd_outside.helper.appendTo("body");
							vakata_dnd_outside.helper_w = vakata_dnd_outside.helper.outerWidth();
						}
						vakata_dnd_outside.is_drag = true;
						/**
						 * triggered on the document when a drag starts
						 * @event
						 * @plugin dnd_outside
						 * @name dnd_outside_start.vakata
						 * @param {Mixed} data any data supplied with the call to $.vakata.dnd_outside.start
						 * @param {DOM} element the DOM element being dragged
						 * @param {jQuery} helper the helper shown next to the mouse
						 * @param {Object} event the event that caused the start (probably mousemove)
						 */
						$.vakata.dnd_outside._trigger("start", e);
					}
					else { return; }
				}

				var d  = false, w  = false,
					dh = false, wh = false,
					dw = false, ww = false,
					dt = false, dl = false,
					ht = false, hl = false;

				vakata_dnd_outside.scroll_t = 0;
				vakata_dnd_outside.scroll_l = 0;
				vakata_dnd_outside.scroll_e = false;
				$($(e.target).parentsUntil("body").addBack().get().reverse())
					.filter(function () {
						return	(/^auto|scroll$/).test($(this).css("overflow")) &&
								(this.scrollHeight > this.offsetHeight || this.scrollWidth > this.offsetWidth);
					})
					.each(function () {
						var t = $(this), o = t.offset();
						if(this.scrollHeight > this.offsetHeight) {
							if(o.top + t.height() - e.pageY < $.vakata.dnd_outside.settings.scroll_proximity)	{ vakata_dnd_outside.scroll_t = 1; }
							if(e.pageY - o.top < $.vakata.dnd_outside.settings.scroll_proximity)				{ vakata_dnd_outside.scroll_t = -1; }
						}
						if(this.scrollWidth > this.offsetWidth) {
							if(o.left + t.width() - e.pageX < $.vakata.dnd_outside.settings.scroll_proximity)	{ vakata_dnd_outside.scroll_l = 1; }
							if(e.pageX - o.left < $.vakata.dnd_outside.settings.scroll_proximity)				{ vakata_dnd_outside.scroll_l = -1; }
						}
						if(vakata_dnd_outside.scroll_t || vakata_dnd_outside.scroll_l) {
							vakata_dnd_outside.scroll_e = $(this);
							return false;
						}
					});

				if(!vakata_dnd_outside.scroll_e) {
					d  = $(document); w = $(window);
					dh = d.height(); wh = w.height();
					dw = d.width(); ww = w.width();
					dt = d.scrollTop(); dl = d.scrollLeft();
					if(dh > wh && e.pageY - dt < $.vakata.dnd_outside.settings.scroll_proximity)		{ vakata_dnd_outside.scroll_t = -1;  }
					if(dh > wh && wh - (e.pageY - dt) < $.vakata.dnd_outside.settings.scroll_proximity)	{ vakata_dnd_outside.scroll_t = 1; }
					if(dw > ww && e.pageX - dl < $.vakata.dnd_outside.settings.scroll_proximity)		{ vakata_dnd_outside.scroll_l = -1; }
					if(dw > ww && ww - (e.pageX - dl) < $.vakata.dnd_outside.settings.scroll_proximity)	{ vakata_dnd_outside.scroll_l = 1; }
					if(vakata_dnd_outside.scroll_t || vakata_dnd_outside.scroll_l) {
						vakata_dnd_outside.scroll_e = d;
					}
				}
				if(vakata_dnd_outside.scroll_e) { $.vakata.dnd_outside._scroll(true); }

				if(vakata_dnd_outside.helper) {
					ht = parseInt(e.pageY + $.vakata.dnd_outside.settings.helper_top, 10);
					hl = parseInt(e.pageX + $.vakata.dnd_outside.settings.helper_left, 10);
					if(dh && ht + 25 > dh) { ht = dh - 50; }
					if(dw && hl + vakata_dnd_outside.helper_w > dw) { hl = dw - (vakata_dnd_outside.helper_w + 2); }
					vakata_dnd_outside.helper.css({
						left	: hl + "px",
						top		: ht + "px"
					});
				}
				/**
				 * triggered on the document when a drag is in progress
				 * @event
				 * @plugin dnd_outside
				 * @name dnd_outside_move.vakata
				 * @param {Mixed} data any data supplied with the call to $.vakata.dnd_outside.start
				 * @param {DOM} element the DOM element being dragged
				 * @param {jQuery} helper the helper shown next to the mouse
				 * @param {Object} event the event that caused this to trigger (most likely mousemove)
				 */
				$.vakata.dnd_outside._trigger("move", e);
				return false;
			},
			stop : function (e) {
				if(e.type === "touchend" && e.originalEvent && e.originalEvent.changedTouches && e.originalEvent.changedTouches[0]) {
					e.pageX = e.originalEvent.changedTouches[0].pageX;
					e.pageY = e.originalEvent.changedTouches[0].pageY;
					e.target = document.elementFromPoint(e.originalEvent.changedTouches[0].pageX - window.pageXOffset, e.originalEvent.changedTouches[0].pageY - window.pageYOffset);
				}
				if(vakata_dnd_outside.is_drag) {
					/**
					 * triggered on the document when a drag stops (the dragged element is dropped)
					 * @event
					 * @plugin dnd_outside
					 * @name dnd_outside_stop.vakata
					 * @param {Mixed} data any data supplied with the call to $.vakata.dnd_outside.start
					 * @param {DOM} element the DOM element being dragged
					 * @param {jQuery} helper the helper shown next to the mouse
					 * @param {Object} event the event that caused the stop
					 */
					$.vakata.dnd_outside._trigger("stop", e);
				}
				else {
					if(e.type === "touchend" && e.target === vakata_dnd_outside.target) {
						var to = setTimeout(function () { $(e.target).click(); }, 100);
						$(e.target).one('click', function() { if(to) { clearTimeout(to); } });
					}
				}
				$.vakata.dnd_outside._clean();
				return false;
			}
		};
	}($));

	// include the dnd_outside plugin by default
	// $.jstree.defaults.plugins.push("dnd_outside");
}));
