(function($) {

    webtraj_interactive = function() {}

    webtraj_interactive.prototype = new webtraj();
    webtraj_interactive.prototype.constructor = webtraj_interactive;

    webtraj_interactive.prototype.deviceSelector = function() {
        var selector = document.createElement('div');
        selector.classList.add('device-name');
        var _label = "";        
        var deviceselect = document.createElement('select');
        deviceselect.classList.add('device-select');
        appendChoicesFromList(this.variable_names.init, deviceselect);
        appendChoicesFromList(this.variable_names.devices, deviceselect);
        appendChoicesFromList(['user-defined:'], deviceselect);
        selector.appendChild(deviceselect);
        
        var custom_device_entry = document.createElement('input');
        custom_device_entry.type = 'text';
        custom_device_entry.size = 20;
        custom_device_entry.classList.add('custom-devicename');
        selector.appendChild(custom_device_entry);

        deviceselect.onchange = function(evt) {
            if (deviceselect.value == "user-defined:") {
                $(custom_device_entry).show();
            }
            else {
                $(custom_device_entry).hide();
            }
        }
        
        function setDeviceList(devices) {
            $(deviceselect).empty();
            appendChoicesFromList(devices, deviceselect);
            appendChoicesFromList(['user-defined:'], deviceselect);
        }
        
        function setValue(newlabel) {
            var index = -1;
            this._label = newlabel;
            for (var i=0; i<deviceselect.options.length; i++) {
                if (deviceselect.options[i].text == newlabel) {
                    index = i;
                    $(custom_device_entry).hide();
                    break;
                }
            }
            if (index < 0) {
                index = deviceselect.options.length - 1;
                $(custom_device_entry).show();
                custom_device_entry.value = newlabel;
            }
            deviceselect.selectedIndex = index;
            //this.label_text.textContent = newlabel;
        }
        
        function getValue() {
            //return this.label_text.textContent;
            var val = deviceselect.value;
            if (val == 'user-defined:') {
                val = custom_device_entry.value;
            }
            return val;
            // or just return this._label?
        }

        Object.defineProperty(selector, "_label", {value: _label});
        Object.defineProperty(selector, "deviceselect", { value: deviceselect });
        Object.defineProperty(selector, "setDeviceList", { value: setDeviceList });
        Object.defineProperty(selector, "custom_device_entry", { value: custom_device_entry });
        Object.defineProperty(selector, "setValue", {value: setValue});
        Object.defineProperty(selector, "getValue", {value: getValue});
        selector.setValue(name);
        //li.appendChild(removeButton(li));
        return selector;
    }    
    
    webtraj_interactive.prototype.listItem = function(name) {
        var li = webtraj.prototype.listItem.call(this);
        li.setLabel(name);
        li.appendChild(removeButton(li));
        return li;
    }
    
    
    webtraj_interactive.prototype.varyList = function(items) {
        var ul = webtraj.prototype.varyList.call(this, items);
        var that = this;
        $( ul.header ).droppable({
          greedy: true,
          tolerance: "pointer",
          activeClass: "ui-state-active",
          hoverClass: "ui-state-highlight",
          accept: ".vary-catalog-item",
          drop: generateOnDrop(that, ul)
        });
        $(ul).sortable({
            items: ">li",
            stop: function() {ul.update()},
            sort: function() {
            // gets added unintentionally by droppable interacting with sortable
            // using connectWithSortable fixes this, but doesn't allow you to customize active/hoverClass options
            $( this ).removeClass( "ui-state-default" );
            }
        });
        return ul;
    }
    
    webtraj_interactive.prototype.initList = function(items) {
        var ul = webtraj.prototype.initList.call(this, items);
        var that = this;
        $( ul.header ).droppable({
          greedy: true,
          tolerance: "pointer",
          activeClass: "ui-state-active",
          hoverClass: "ui-state-highlight",
          accept: ".init-catalog-item",
          drop: generateOnDrop(that, ul)
        });
        $(ul).sortable({
            items: ">li",
            sort: function() {
            // gets added unintentionally by droppable interacting with sortable
            // using connectWithSortable fixes this, but doesn't allow you to customize active/hoverClass options
            $( this ).removeClass( "ui-state-default" );
            }
        });
        return ul;
    }
    
    webtraj_interactive.prototype.mainList = function(items) {
        var ul = webtraj.prototype.mainList.call(this, items);
        var that = this;
        $( ul.header ).droppable({
          greedy: true,
          tolerance: "pointer",
          //activeClass: "ui-state-default",
          activeClass: "ui-state-active",
          hoverClass: "ui-state-highlight",
          accept: ".init-catalog-item, .main-catalog-item",
          drop: function( event, ui ) {
            var subtype = ui.draggable[0].getAttribute('name');
            var newitem = that.itemCreators[subtype].call(that);
            if (subtype == 'subloop') {
                var newloop = that.itemCreators['loop'].call(that);
                var existing_loops = $('>.loops-section', ul);
                if (existing_loops.length > 0) {
                    existing_loops.detach().appendTo( newloop );
                }
                $( newloop ).appendTo( newitem );
                $( newitem ).appendTo( ul );
            }
            else { $( newitem ).insertBefore( $('.init-section', ul) ); }
            $( ul ).removeClass( "ui-state-hover" );
          }
        });
        
        //$(ul).sortable({items: "> li"});
        return ul;
    }
    
    webtraj_interactive.prototype.loopsList = function(items) {
        var ul = webtraj.prototype.loopsList.call(this, items);
        var that = this;
        $( ul.header ).droppable({
          greedy: true,
          tolerance: "pointer",
          activeClass: "ui-state-active",
          hoverClass: "ui-state-highlight",
          accept: ".loops-catalog-item",
          drop: generateOnDrop(that, ul)
        });
        $(ul).sortable({
            items: ">li",
            sort: function() {
            // gets added unintentionally by droppable interacting with sortable
            // using connectWithSortable fixes this, but doesn't allow you to customize active/hoverClass options
            $( this ).removeClass( "ui-state-default" );
            }
        });
        var rb = removeButton(ul);
        ul.insertBefore(rb, ul.childNodes[0]);
        return ul;
    }
    webtraj_interactive.prototype.itemCreators['subloop'] = webtraj_interactive.prototype.loopsList;
    
    webtraj_interactive.prototype.loopItem = function(items) {
        var li = webtraj.prototype.loopItem.call(this, items);
        var that = this;
        $( li ).droppable({
          greedy: true,
          tolerance: "pointer",
          activeClass: "ui-state-active",
          hoverClass: "ui-state-highlight",
          //accept: ".loop-catalog-item",
          accept: function(draggable) {
            console.log(draggable, this, li, $('.loop-section', li).length);
            return ($(draggable).hasClass('loop-catalog-item') && $('.loops-section', li).length == 0)
          },
          drop: generateOnDrop(that, li)
        });
        var rb = removeButton(li);
        li.insertBefore(rb, li.childNodes[0]);
        return li;
    }
    webtraj_interactive.prototype.itemCreators['loop'] = webtraj_interactive.prototype.loopItem;
    
    webtraj_interactive.prototype.objListItem = function(name, items) {
        var li = webtraj.prototype.objListItem.call(this, name, items);
        var that = this;
        $(li).droppable({
          greedy: true,
          tolerance: "pointer",
          activeClass: "ui-state-active",
          hoverClass: "ui-state-highlight",
          accept: ".init-catalog-item",
          drop: function(event, ui) {
            var subtype = ui.draggable[0].getAttribute('name');
            var newitem = that.itemCreators[subtype].call(that);
            $( newitem ).appendTo( this.ul );
            $('ul').removeClass( "ui-state-focus" );
            $('ul').removeClass( "ui-state-hover" );
            if (this.update) { this.update(); };
          }
        });
        //var rb = removeButton(li);
        //li.insertBefore(rb, li.childNodes[0]);
        return li;
    }
    webtraj_interactive.prototype.itemCreators['obj'] = webtraj_interactive.prototype.objListItem;
    
    function generateOnDrop(Item, parent) {
        var onDrop = function(event, ui) {
            var subtype = ui.draggable[0].getAttribute('name');
            var newitem = Item.itemCreators[subtype].call(Item);
            $( newitem ).appendTo( parent );
            $('ul').removeClass( "ui-state-focus" );
            $('ul').removeClass( "ui-state-hover" );
            if (this.update) { this.update(); };
        }
        return onDrop
    }
    
    function removeButton(item) {
        var b = document.createElement('button');
        b.textContent = "x";
        b.classList.add('remove-button');
        b.classList.add('ui-state-error');
        $(b).button({icons: {primary: "ui-icon-close"}, text: false});
        b.onclick = function (evt) {
            $(item).empty();
            $(item).remove();
        }
        return b
    }
    
    function appendChoicesFromList(devices, selector) {
        for (var i=0; i<devices.length; i++) {
            var device = devices[i];
            selector.add(new Option(device, device));
        }
    }
  })(jQuery);
