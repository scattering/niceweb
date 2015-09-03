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
        var classlist = "add-button ui-button ui-corner-all";
        var buttons = [
            {text: "+ subloop", class: classlist, name: "subloop"},
            {text: "+ list", class: classlist, name: "cycliclist"},
            {text: "+ expression", class: classlist, name: "expression"},
            {text: "+ range", class: classlist, name: "range"}
        ];
        for (var i=0; i<buttons.length; i++) {
            var button = $("<button/>", buttons[i]);
            button.click(function(e) {
                var subtype = $(this).attr("name");
                var newitem = that.itemCreators[subtype].call(that);
                if (subtype == "subloop") {
                    $( ul ).append( $(newitem) );
                } else {
                    var insertionPoint = $(ul).children("li").add($(ul).children(".subsection-header,.section-header")).last();
                    $( newitem ).insertAfter(insertionPoint);
                }
            });
            // insert after the section header, and after the items.
            var insertionPoint = $(ul).children("li").add($(ul).children(".subsection-header,.section-header")).last();
            button.insertAfter(insertionPoint);
        }
        $(ul).sortable({items: "> li"});
        return ul;
    }
    
    webtraj_interactive.prototype.initList = function(items) {
        var ul = webtraj.prototype.initList.call(this, items);
        var that = this;
        var buttons = [
            //{text: "+ range", class:"add-button ui-button ui-corner-all", name: "range"},
            {text: "+ expression", class: "add-button ui-button ui-corner-all", name: "expression"}
        ];
        for (var i=0; i<buttons.length; i++) {
            var button = $("<button/>", buttons[i]);
            button.click(function(e) {
                var subtype = $(this).attr("name");
                var newitem = that.itemCreators[subtype].call(that);
                var insertionPoint = $(ul).children("li").add($(ul).children(".subsection-header,.section-header")).last();
                $( newitem ).insertAfter(insertionPoint);
            });
            var insertionPoint = $(ul).children("li").add($(ul).children(".subsection-header,.section-header")).last();
            button.insertAfter(insertionPoint);
        }
        
        $(ul).sortable();
        return ul;
    }
    
    webtraj_interactive.prototype.mainList = function(items) {
        var ul = webtraj.prototype.mainList.call(this, items);
        var that = this;
        var classlist = "add-button ui-button ui-corner-all";
        var buttons = [
            {text: "+ subloop", class: classlist, name: "subloop"},
            {text: "+ expression", class: classlist, name: "expression"}
        ];
        for (var i=0; i<buttons.length; i++) {
            var button = $("<button/>", buttons[i]);
            button.click(function(e) {
                var subtype = $(this).attr("name");
                var newitem = that.itemCreators[subtype].call(that);
                if (subtype == "subloop") {
                    $( ul ).append( $(newitem) );
                } else {
                    var insertionPoint = $(ul).children("li").add($(ul).children(".subsection-header,.section-header")).last();
                    $( newitem ).insertAfter(insertionPoint);
                }
            });
            // insert after the section header, and after the items.
            var insertionPoint = $(ul).children("li").add($(ul).children(".subsection-header,.section-header")).last();
            button.insertAfter(insertionPoint);
        }
        //$(ul).sortable({items: "> li"});
        return ul;
    }
    
    webtraj_interactive.prototype.loopsList = function(items) {
        var ul = webtraj.prototype.loopsList.call(this, items);
        var that = this;
        var button = $("<button/>", {text: "+ vary", class:"add-button ui-button ui-corner-all", name: "loop"});
        button.click(function(e) {
            var subtype = $(this).attr("name");
            var newitem = that.itemCreators[subtype].call(that);
            var insertionPoint = $(ul).children("li").add($(ul).children(".subsection-header,.section-header")).last();
            $( newitem ).insertAfter(insertionPoint);
        });
        var insertionPoint = $(ul).children("li").add($(ul).children(".subsection-header,.section-header")).last();
        button.insertAfter(insertionPoint);
        //$(ul).sortable({items: "> li"});
        $(ul).sortable();
        var rb = removeButton(ul);
        ul.insertBefore(rb, ul.childNodes[0]);
        return ul;
    }
    webtraj_interactive.prototype.itemCreators['subloop'] = webtraj_interactive.prototype.loopsList;
    
    webtraj_interactive.prototype.loopItem = function(items) {
        var li = webtraj.prototype.loopItem.call(this, items);
        var that = this;
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
    
    
    function removeButton(item) {
        var b = document.createElement('button');
        //b.textContent = "x";
        //$( b ).button( "option", "icons", { primary: "ui-icon-close" } );
        //b.classList.add('remove-button');
        //b.classList.add('ui-state-error');
        $(b).button({icons: {primary: "ui-icon-close"}, text: false})
            .addClass("remove-button")
            .addClass("ui-state-error");
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
