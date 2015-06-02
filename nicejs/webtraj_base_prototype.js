(function($) {
    var DEFAULT_DEVICES = [
        'sampleAngle', 
        'detectorAngle', 
        'slitAperture1',
        'slitAperture2',
        'slitAperture3',
        'slitAperture4',
        'vertSlitAperture1',
        'vertSlitAperture2',
        'sampleTranslationX',
        'sampleTranslationY',
        'sampleTiltX',
        'sampleTiltY',
        'counter',
        'counter.countAgainst',
        'counter.timePreset',
        'counter.monitorPreset',
        't0',
        'h0', 
        'frontPolarization',
        'backPolarization',
        'skip',
        ];
        
    var ENUMS = {
        "counter.countAgainst": ["'TIME'", "'MONITOR'", "'ROI'", "'TIME_MONITOR'", "'TIME_ROI'", "'MONITOR_ROI'", "'TIME_MONITOR_ROI'"], 
        "counter.roiAgainst": ["'areaDetector'", "'pointDetector'", "'linearDetector'"]
    };

    var EMPTY_TRAJ = "{'init': {}, 'loops': [{'vary': []}]}";

    webtraj = function(devices, enums) {
        this.variable_names = {};
        this.variable_names.devices = devices == null? DEFAULT_DEVICES : devices;
        this.variable_names.init = [];
        this.variable_names.user_defined = [];
        this.enums = enums == null? ENUMS : enums;
        this.user_devices = [];
    };

    webtraj.prototype = new Object();
    webtraj.prototype.constructor = webtraj;
    webtraj.prototype.itemCreators = {};

    function calcStart(start, step, stop, numPoints) {
        return stop - (step * (numPoints - 1));
    }
    
    function calcStep(start, step, stop, numPoints) {
        return (stop - start) / (numPoints - 1);
    }
    
    function calcStop(start, step, stop, numPoints) {
        return start + (step * (numPoints - 1));
    }
    
    function calcNumPoints(start, step, stop, numPoints) {
        // if divide by zero, return 1:
        if (step == 0) { return 1 }
        else { return Math.round( (stop - start) / step ) + 1; }            
    }
    
    webtraj.prototype.createEntry = function(name, kwargs) { 
        // previously: width, format_str, choices
        var type = kwargs.type || "";
        if (type == 'choice') {
            return this.createChoiceEntry(name, kwargs);
        } else if (type == "boolean") {
            return this.createBooleanEntry(name, kwargs);
        } else if (type == "list") {
            return this.createListEntry(name, kwargs);
        } else {
            return this.createTextEntry(name, kwargs);
        }
    }
    
    function removeButton(item) {
        var b = document.createElement('button');
        b.textContent = "x";
        b.classList.add('remove-button');
        $(b).button({icons: {primary: "ui-icon-close"}, text: false});
        b.onclick = function (evt) {
            $(item).empty();
            item.remove();
        }
        return b
    }
    
    webtraj.prototype.createBooleanEntry = function(name, kwargs) {
        var label = document.createElement('label');
        label.textContent = name;
        label.classList.add('boolean-entry');
        var entry = document.createElement('input');
        entry.type = "checkbox";
        label.appendChild(entry);
        
        function setValue(value) {
            this.entry.checked = Boolean(value);
        }
        
        function getValue() {
            return this.entry.checked;
        }
        function setLabel(newlabel) {
            //this.label_text.textContent = newlabel;
            this.textContent = newlabel;
        }
        
        function getLabel() {
            //return this.label_text.textContent;
            return this.textContent
        }
        Object.defineProperty(label, "entry", { value: entry });
        //Object.defineProperty(label, "label_text", { value: label_text });
        Object.defineProperty(label, "setValue", {value: setValue});
        Object.defineProperty(label, "getValue", {value: getValue});
        Object.defineProperty(label, "setLabel", {value: setLabel});
        Object.defineProperty(label, "getLabel", {value: getLabel});
        return label
    }
    
    
    webtraj.prototype.createTextEntry = function(name, kwargs) {
        //width, format_str) {
        var width = kwargs.width || 6;
        var format_str = kwargs.format_str || "%s";
        var span = document.createElement('span');
        span.setAttribute('name', name);
        
        //var label_text = document.createTextNode(name);
        var label = document.createElement('label');
        label.textContent = name
        span.appendChild(label);
        span.classList.add('text-entry');
        var entry = document.createElement('input');
        entry.onchange = function (e) { 
            if (span.parentElement.hasOwnProperty('update')) {
                span.parentElement.update();
            }
        }
        // format string defaults to float with 4 digits
        var format_str = format_str == null ? '%.6f' : format_str;
        if (kwargs.type && kwargs.type == "float") {
            entry.type = "number";
            entry.step = 0.001;
        } else {
            entry.type = "text";
        }
        entry.size = width? width : 80;
        //span.appendChild(span_text);
        span.appendChild(entry);
        
        function setValue(value) {
            this.entry.value = (value == '' || value == '***') ? value : sprintf(format_str, value);
        }
        
        function getValue() {
            var value = this.entry.value;
            if ($.isNumeric(value)) { value = parseFloat(value) }
            else if (value === "true") { value = true }
            else if (value === "false") { value = false }            
            return value;
        }
        
        function setLabel(newlabel) {
            //this.label_text.textContent = newlabel;
            this.textContent = newlabel;
        }
        
        function getLabel() {
            //return this.label_text.textContent;
            return this.textContent
        }
        Object.defineProperty(span, "label", { value: label });
        Object.defineProperty(span, "entry", { value: entry });
        Object.defineProperty(span, "disabled", { 
            get: function() {return entry.disabled;},
            set: function(newval) { entry.disabled = newval }
            });
        Object.defineProperty(span, "format_str", { value: format_str });
        Object.defineProperty(span, "setValue", {value: setValue, configurable: true});
        Object.defineProperty(span, "getValue", {value: getValue, configurable: true});
        Object.defineProperty(span, "setLabel", {value: setLabel});
        Object.defineProperty(span, "getLabel", {value: getLabel});
        return span
    }
    
    webtraj.prototype.createChoiceEntry = function(name, kwargs) {
        // choices, format_str) {
        var choices = kwargs.choices || [];
        var format_str = kwargs.format_str || "%s";
        var span = document.createElement('span');
        span.setAttribute('name', name);
        
        //var label_text = document.createTextNode(name);
        var label = document.createElement('label');
        label.textContent = name
        span.appendChild(label);
        span.classList.add('choice-entry');
        var entry = document.createElement('select');
        entry.onchange = function (e) { 
            if (span.parentElement.hasOwnProperty('update')) {
                span.parentElement.update();
            }
        }
        span.appendChild(entry);
        var format_str = format_str == null? '%s' : format_str;
        
        choices.forEach(function(item) {
            entry.add(new Option(item, item));            
        });
        
        function getValue() {
            return sprintf(this.format_str, this.entry.value);
        }
        
        function setValue(val) {
            var index = -1;
            for (var i=0; i<this.entry.options.length; i++) {
                if (this.entry.options[i].text == val) {
                    index = i;
                    break;
                }
            }
            if (index < 0) {
                index = 0;
            }
            this.entry.selectedIndex = index;
        }
        
        function setLabel(newlabel) {
            //this.label_text.textContent = newlabel;
            this.label.textContent = newlabel;
        }
        
        function getLabel() {
            //return this.label_text.textContent;
            return this.label.textContent
        }
        
        Object.defineProperty(span, "label", { value: label });
        Object.defineProperty(span, "entry", { value: entry });
        Object.defineProperty(span, "choices", { value: choices }); 
        Object.defineProperty(span, "disabled", { 
            get: function() {return entry.disabled;},
            set: function(newval) { entry.disabled = newval }
            });
        Object.defineProperty(span, "format_str", { value: format_str });
        Object.defineProperty(span, "setValue", {value: setValue, configurable: true});
        Object.defineProperty(span, "getValue", {value: getValue, configurable: true});
        Object.defineProperty(span, "setLabel", {value: setLabel});
        Object.defineProperty(span, "getLabel", {value: getLabel});
        return span
    }
    
    webtraj.prototype.createListEntry = function(name, kwargs) {
        var width = kwargs.width || 6;
        var format_str = '%s';
        var entry = this.createTextEntry(name, kwargs);
        entry.classList.add('list-entry');
        
        function getValue() {
            var contents = this.entry.value;
            var listexpr = '[' +  contents + ']';
            return JSON.parse(listexpr);
        }
        
        function setValue(val) {
            var listexpr = JSON.stringify(val);
            var contents = listexpr.slice(1, listexpr.length-1);
            this.entry.value = contents;
        }
        Object.defineProperty(entry, "getValue", {value: getValue});
        Object.defineProperty(entry, "setValue", {value: setValue});
        return entry
    }
    
    function unrollObjKeys(obj, keys, basename) {
        var keys = keys == null? [] : keys;
        var basename = basename == null? '' : basename;
        for (var k in obj) {
            var name = basename + k;
            //if (typeof obj[k] == 'object') {
            if (isObject(obj[k])) {
                unrollObjKeys(obj[k], keys, name+'.');
            } else {
                keys.push(name);
            }
        }
        return keys;
    }
    
    webtraj.prototype.deviceSelector = function() {
        var label = document.createElement('label');
        label.classList.add('device-name');
        
        function getValue() {
            return label.textContent;
        }
        
        function setValue(newlabel) {
            label.textContent = newlabel;
        }
        
        Object.defineProperty(label, "getValue", {value: getValue});
        Object.defineProperty(label, "setValue", {value: setValue});
        return label
    }
    
    /* Create a "sub-class" of listitem element */
    webtraj.prototype.listItem = function(name) {
        var li = document.createElement('li');
        li.classList.add('ui-state-default');
        li.setAttribute('name', name);     
        var deviceselect = this.deviceSelector();
        li.appendChild(deviceselect);
        var disabled = false;
        
        Object.defineProperty(li, "disabled", {value: disabled, configurable: true});            
        Object.defineProperty(li, "deviceselect", {value: deviceselect});
        Object.defineProperty(li, "setLabel", {value: deviceselect.setValue});
        Object.defineProperty(li, "getLabel", {value: deviceselect.getValue});
        li.setLabel(name);
        return li;
    }
    
    
    
    webtraj.prototype.rangeListItem = function(name, range_obj) {
        var li = this.listItem(name);
        
        li.classList.add('item-range');
        if (range_obj == null) {
            var range_obj = {'start':'', 'step':'', 'stop':'', 'center':'', 'range':'', 'numPoints':''};
        }
        else if (typeof range_obj == "number") {
            // single argument: convert
            var range_obj = {'start': 0, 'step': 1, 'stop': range_obj-1};
        } 
        
        var keys = ['start', 'step', 'stop', 'center', 'range', 'numPoints'];        
        var items = {};
        
        for (var i=0; i<keys.length; i++) {
            var key = keys[i];
            if (range_obj.hasOwnProperty(key)) {
                items[key] = this.createEntry(key, {'type':'string', 'width': 10, 'format_str': '%s'});
                li.appendChild(items[key]);
                items[key].setValue(range_obj[key]);
            }
        }
        
        function getValue() {
            var output = {};
            for (var i in this.items) {
                var item = this.items[i];
                var value = item.getValue();
                if (value !== "") {
                    // filter out the empty 
                    output[i] = value;
                }
            }
            return {'range': output}
        }
                
        //Object.defineProperty(li, "update", {value: update, configurable: true});
        Object.defineProperty(li, "subtype", {value: "range"});
        Object.defineProperty(li, "items", {value: items});
        Object.defineProperty(li, "getValue", {value: getValue});
        return li;
    
    }
    webtraj.prototype.itemCreators['range'] = webtraj.prototype.rangeListItem;
    
    webtraj.prototype.counterListItem = function(name, obj) {
        var li = this.listItem(name);
        li.classList.add('item-counter');
        if (obj == null) {
            var obj = {'countAgainst': "'TIME'", 'timePreset': 1.0, 'monitorPreset': 1000};
        }
        
        var keys = [
            'countAgainst', 'timePreset', 'monitorPreset', 
            //'prefactor'
            ];
        var formats = ['%s', '%.1f', '%d']       
        var items = {};
        
        items['countAgainst'] = this.createEntry('countAgainst', {'type':'choice', 'choices': ["'TIME'", "'MONITOR'"], 'format_str':'%s'});
        li.appendChild(items['countAgainst']);
        items['timePreset'] = this.createEntry('timePreset', {'type':'float', 'width': 10, 'format_str': '%.1f'});
        li.appendChild(items['timePreset']);
        items['monitorPreset'] = this.createEntry('monitorPreset', {'type':'integer', 'width':10, 'format_str':'%d'});
        li.appendChild(items['monitorPreset']);
        //items['prefactor'] = this.createEntry('prefactor', 6, '%.2f');
        //li.appendChild(items['prefactor']);
                
        function setValue(newobj) {
            var items = this.items;
            keys.forEach( function(key) {
                if (newobj.hasOwnProperty(key)) {
                    //console.log(key, items, items[key]);
                    items[key].setValue(newobj[key]);
                }
            });
        }
        
        function getValue() {
            var output = {};
            for (var i in this.items) {
                var item = this.items[i];
                output[i] = item.getValue();
            }
            return output
        }
        
        //Object.defineProperty(li, "update", {value: update, configurable: true});
        Object.defineProperty(li, "subtype", {value: "counter"});
        Object.defineProperty(li, "items", {value: items});
        Object.defineProperty(li, "getValue", {value: getValue});
        Object.defineProperty(li, "setValue", {value: setValue});
        li.setValue(obj);
        return li;
    
    }
    webtraj.prototype.itemCreators['counter'] = webtraj.prototype.counterListItem;
    
    webtraj.prototype.qCounterListItem = function(name, obj) {
        var li = this.listItem(name);
        if (obj == null) {
            var obj = {'countAgainst': "'TIME'", 'timePreset': 1.0, 'monitorPreset': 1000};
        }
        
        var keys = ['countAgainst', 'Pre', 'Mon0', 'Mon1', 'exponent'];
        //var formats = ['%s', '%.1f', '%d']       
        var items = {};
        
        items['countAgainst'] = createChoiceEntry('countAgainst', ['TIME', 'MONITOR'], '%s');
        li.appendChild(items['countAgainst']);
        var formula = document.createElement('span');
        formula.textContent = "Formula: Pre*(Mon0 + Mon1 * q<sup>exponent</sup>)";
        li.appendChild(formula);
        items['timePreset'] = this.createEntry('timePreset', 10, '%.1f');
        li.appendChild(items['timePreset']);
        items['monitorPreset'] = this.createEntry('monitorPreset', 10, '%d');
        li.appendChild(items['monitorPreset']);
        items['prefactor'] = this.createEntry('prefactor', 5, '%d');
        li.appendChild(items['prefactor']);
                
        function setValue(newobj) {
            var items = this.items;
            keys.forEach( function(key) {
                if (newobj.hasOwnProperty(key)) {
                    //console.log(key, items, items[key]);
                    items[key].setValue(newobj[key]);
                }
            });
        }
        
        function getValue() {
            var output = {};
            for (var i in this.items) {
                var item = this.items[i];
                output[i] = item.getValue();
            }
            return output
        }
        
        //Object.defineProperty(li, "update", {value: update, configurable: true});
        Object.defineProperty(li, "subtype", {value: "counter"});
        Object.defineProperty(li, "items", {value: items});
        Object.defineProperty(li, "getValue", {value: getValue});
        Object.defineProperty(li, "setValue", {value: setValue});
        li.setValue(obj);
        return li;
    
    }
    webtraj.prototype.itemCreators['qcounter'] = webtraj.prototype.qCounterListItem;
    
    webtraj.prototype.listObjListItem = function(name, src_obj) {
        var li = this.listItem(name);
        li.classList.add('item-listobj');
        if (src_obj == null) {
            var src_obj = {'value': '', 'cyclic': true};
        }
        
        var keys = ['value', 'cyclic'];
        var types = ['list', 'boolean']
        var items = {};
        
        
        for (var i=0; i<keys.length; i++) {
            var key = keys[i];
            var type = types[i];
            items[key] = this.createEntry(key, {'type':type})
            li.appendChild(items[key]);
            if (src_obj.hasOwnProperty(key)) {
                items[key].setValue(src_obj[key]);
            }
        }
        
        function getValue() {
            var output = {};
            for (var i in this.items) {
                var item = this.items[i];
                output[i] = item.getValue();
            }
            return {'list': output}
        }
        
        Object.defineProperty(li, "disabled", {
            get: function() { items.some( function(item) { return (item.hasOwnProperty('disabled') && item.disabled == true)}); },
            set: function(val) { items.forEach( function(item) { if (item.hasOwnProperty('disabled')) { item.disabled = val }}); }});
        Object.defineProperty(li, "subtype", {value: "list"});
        Object.defineProperty(li, "items", {value: items});
        Object.defineProperty(li, "getValue", {value: getValue});
        return li;
    
    }
    webtraj.prototype.itemCreators['cycliclist'] = webtraj.prototype.listObjListItem;
    
    webtraj.prototype.enumListItem = function(name, initial_value, valid_values) {
        var li = this.listItem(name);
        li.classList.add('item-enum');
        var entry = this.createEntry('choice', {'type':'choice', 'choices':valid_values, 'format_str':'%s'});
        li.appendChild(entry);
        
        function getValue() {
            return this.entry.getValue();
        }
        
        function setValue(val) {
            this.entry.setValue(val);
        }
        
        Object.defineProperty(li, "disabled", {
            get: function() { return entry.disabled },
            set: function(val) { entry.disabled = val }});
        Object.defineProperty(li, "subtype", {value: "enum"});
        Object.defineProperty(li, "entry", {value: entry});
        Object.defineProperty(li, "getValue", {value: getValue});
        Object.defineProperty(li, "setValue", {value: setValue});
        li.setValue(initial_value == null? "" : initial_value);
        return li 
        
    }
    webtraj.prototype.itemCreators['enum'] = webtraj.prototype.enumListItem;
    
    webtraj.prototype.expressionListItem = function(name, initial_value) {
        var li = this.listItem(name);  
        li.classList.add('item-expression'); 
        var entry = this.createEntry('', {'width':30, 'format_str':'%s'});
        li.appendChild(entry);
        
        function getValue() {
            return this.entry.getValue();
        }
        
        function setValue(val) {
            this.entry.setValue(val);
        }
        
        Object.defineProperty(li, "disabled", {
            get: function() { return entry.disabled },
            set: function(val) { entry.disabled = val }});
        Object.defineProperty(li, "subtype", {value: "expression"});
        Object.defineProperty(li, "entry", {value: entry});
        Object.defineProperty(li, "getValue", {value: getValue});
        Object.defineProperty(li, "setValue", {value: setValue});
        li.setValue(initial_value == null? "" : initial_value);
        return li      
    }
    webtraj.prototype.itemCreators['expression'] = webtraj.prototype.expressionListItem;
    
    webtraj.prototype.listListItem = function(name, initial_value) {
        var li = this.listItem(name);
        li.classList.add('item-list');
        //var entry = createEntry('list', 20, '%s');
        //var entry = createListEntry('list', 20);
        var entry = this.createEntry('list', {'type':'list', 'width': 20});
        li.appendChild(entry);
        
        function getValue() {
            var contents = this.entry.getValue();
            //var listexpr = '[' +  contents + ']';
            //return JSON.parse(listexpr);
            return contents
        }
        
        function setValue(val) {
            //var listexpr = JSON.stringify(val);
            //var contents = listexpr.slice(1, listexpr.length-1);
            //this.entry.setValue(contents);
            this.entry.setValue(val);
        }
        
        function getNumPoints() {
            return this.getValue().length
        }   
        
        Object.defineProperty(li, "disabled", {
            get: function() { return entry.disabled },
            set: function(val) { entry.disabled = val }});
        Object.defineProperty(li, "getNumPoints", {value: getNumPoints});
        Object.defineProperty(li, "subtype", {value: "list"});
        Object.defineProperty(li, "entry", {value: entry});
        Object.defineProperty(li, "getValue", {value: getValue});
        Object.defineProperty(li, "setValue", {value: setValue});
        li.setValue(initial_value == null? [] : initial_value);
        return li      
    }
    webtraj.prototype.itemCreators['list'] = webtraj.prototype.listListItem;   
    
    webtraj.prototype.varyList = function(items) {
        var ul = document.createElement('ul');
        ul.classList.add('vary-section');
        
        var header = document.createElement('span');
        header.textContent = 'vary';
        header.classList.add('subsection-header');
        ul.appendChild(header);
        
        for (var i in items) {
            var item = items[i];
            var key = item[0];
            var value = item[1];
            //if (key == "counter") {
            //    var newctr = this.counterListItem(key, value);
            //    ul.appendChild(newctr);
            //}
            //else if (value.hasOwnProperty('range')) {
            if (value.hasOwnProperty('range')) {
                var newrange = this.rangeListItem(key, value.range);
                ul.appendChild(newrange);
            }
            else if (value.hasOwnProperty('list')) {
                var newlist = this.listObjListItem(key, value.list);
                ul.appendChild(newlist);
            }
            else if (isObject(value)) {
                var newobj = this.objListItem(key, value);
                ul.appendChild(newobj);
            }
            else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                if (key in ENUMS) {
                    var newenum = this.enumListItem(key, value, ENUMS[key]);
                    ul.appendChild(newenum);
                }
                else {
                    var newexpr = this.expressionListItem(key, value);
                    ul.appendChild(newexpr);
                }
            }
            else if (Array.isArray(value)) {
                var newlist = this.listListItem(key, value);
                ul.appendChild(newlist);
            }
        }
        
        function getLabel(){
            return "vary";
        }
        
        function getValue() {
            var output = [];
            $('>li', this).each( function(index, el) {
                output.push([el.getLabel(), el.getValue()]);
            });
            return output;
        }
        
        Object.defineProperty(ul, "header", {value: header});
        Object.defineProperty(ul, "subtype", {value: "vary"});
        Object.defineProperty(ul, "getValue", {value: getValue});
        Object.defineProperty(ul, "getLabel", {value: getLabel});
        return ul;
        
    }
    
    function isObject(thing) {
        var result;
        if (thing ===null) { return false }
        else {
            return (thing.constructor.toString().match(/object/i) != null);
        }
    }
    
    webtraj.prototype.objListItem = function(name, items) {
        var li = this.listItem(name);
        var ul = document.createElement('ul');
        ul.classList.add('object-item');
        li.appendChild(ul);
        
        for (var key in items) {
            var value = items[key];
            //if (value.hasOwnProperty('range')) {
            //    var newrange = rangeListItem(key, value.range);
            //    ul.appendChild(newrange);
            //}
            //else if (value.hasOwnProperty('list')) {
            //    var newlist = listObjListItem(key, value.list);
            //    ul.appendChild(newlist);
            //}
            if (key in this.enums) {
                var newenum = this.enumListItem(key, value, this.enums[key]);
                ul.appendChild(newenum);
            }
            else if (typeof value === 'string') {
                var newexpr = this.expressionListItem(key, value);
                ul.appendChild(newexpr);
            }
            else if (typeof value === 'number') {
                var newexpr = this.expressionListItem(key, value);
                ul.appendChild(newexpr);
            }
            else if (isObject(value)) {
                var newobj = this.objListItem(key, value);
                ul.appendChild(newobj);
            }
            else if (Array.isArray(value)) {
                var newlist = this.listListItem(key, value);
                ul.appendChild(newlist);
            }
        }
        
        //function getLabel(){
        //    return name;
        //}
        
        function getValue() {
            var output = {};
            $('>li', this.ul).each( function(index, el) {
                output[this.getLabel()] = this.getValue();
            });
            return output;
        }
        Object.defineProperty(li, "subtype", {value: "obj"});
        Object.defineProperty(li, "getValue", {value: getValue});
        Object.defineProperty(li, "ul", {value: ul});
        //Object.defineProperty(li, "getLabel", {value: getLabel});        
        return li;
        
    }
    webtraj.prototype.itemCreators['obj'] = webtraj.prototype.objListItem;  
    
    webtraj.prototype.initList = function(items) {
        var ul = document.createElement('ul');
        ul.classList.add('init-section');
        ul.classList.add('vary-section');
        var header = document.createElement('span');
        header.textContent = 'init';
        header.classList.add('section-header');
        ul.appendChild(header);
        
        for (var i in items) {
            var item = items[i];
            var key = item[0];
            var value = item[1];
            //if (value.hasOwnProperty('range')) {
            //    var newrange = rangeListItem(key, value.range);
            //    ul.appendChild(newrange);
            //}
            //else if (value.hasOwnProperty('list')) {
            //    var newlist = listObjListItem(key, value.list);
            //    ul.appendChild(newlist);
            //}
            //if (key == "counter") {
            //    var newctr = this.counterListItem(key, value);
            //    ul.appendChild(newctr);
            //}
            if (key in this.enums) {
                var newenum = this.enumListItem(key, value, this.enums[key]);
                ul.appendChild(newenum);
            }
            else if (isObject(value)) {
                var newobj = this.objListItem(key, value);
                ul.appendChild(newobj);
            }
            else if (typeof value === 'string') {
                var newexpr = this.expressionListItem(key, value);
                ul.appendChild(newexpr);
            }
            else if (typeof value === 'boolean') {
                var newexpr = this.expressionListItem(key, value);
                ul.appendChild(newexpr);
            }
            else if (typeof value === 'number') {
                var newexpr = this.expressionListItem(key, value);
                ul.appendChild(newexpr);
            }
            else if (Array.isArray(value)) {
                var newlist = this.listListItem(key, value);
                ul.appendChild(newlist);
            }
        }
        
        function getLabel(){
            return "init";
        }
        
        function getValue() {
            var output = [];
            $('>li', this).each( function(index, el) {
                output.push([this.getLabel(), this.getValue()]);
            });
            return output;
        }
        Object.defineProperty(ul, "header", {value: header});
        Object.defineProperty(ul, "subtype", {value: "init"});
        Object.defineProperty(ul, "getValue", {value: getValue});
        Object.defineProperty(ul, "getLabel", {value: getLabel});        
        return ul;
        
    }
    
    webtraj.prototype.loopsList = function(items, headerText) {
        var ul = document.createElement('ul');
        ul.classList.add('loops-section');
        
        var header = document.createElement('span');
        header.textContent = headerText == null? 'subloop' : headerText;
        header.classList.add('section-header');
        ul.appendChild(header);
        
        for (var i in items) {        
            var item = items[i];
            var li = this.loopItem(item);
            ul.appendChild(li);
        }
        
        function getLabel(){
            return "loops";
        }
        
        function getValue() {
            var output = [];
            var children = this.children;
            for (var l=0; l<children.length; l++) {
                var child = children[l];
                if (child.tagName === 'LI') {
                    // each subloop is a list item
                    output.push(child.getValue());
                }
            }
            return output;
        }
        Object.defineProperty(ul, "header", {value: header});
        Object.defineProperty(ul, "subtype", {value: "loops"});
        Object.defineProperty(ul, "getValue", {value: getValue});
        Object.defineProperty(ul, "getLabel", {value: getLabel});       
        return ul;
    }
    webtraj.prototype.itemCreators['subloop'] = webtraj.prototype.loopsList;
    
    webtraj.prototype.loopItem = function(src_obj) {
        var li = document.createElement('li');
        li.classList.add('loop-section');
        
        //var rb = removeButton(li);
        //li.appendChild(rb);
        
        var src_obj = src_obj || {};
        var newvary = this.varyList(src_obj.vary);
        li.appendChild(newvary);
        //$(newvary).sortable({items: "> li"});
        //$(newvary).disableSelection();
 
        if (src_obj.hasOwnProperty('loops')) {
            var newloops = this.loopsList(src_obj.loops);
            li.appendChild(newloops);
            //$(newloops).sortable({items: "> li"});
            //$(newloops).disableSelection();
        }
                
        function getLabel(){
            return "loops";
        }
        
        function getValue() {
            var output = {};
            var children = this.children;
            for (var m=0; m<children.length; m++) {
                var child = children[m];
                if (child.tagName === 'UL') {
                    // this catches the 'vary' and 'loops' grandchildren.
                    output[child.getLabel()]= child.getValue();
                }
            }
            return output;
        }
        Object.defineProperty(li, "subtype", {value: "loop"});
        Object.defineProperty(li, "getValue", {value: getValue});
        Object.defineProperty(li, "getLabel", {value: getLabel});
        return li;
    }
    webtraj.prototype.itemCreators['loop'] = webtraj.prototype.loopItem;
    
    webtraj.prototype.mainList = function(item) {
        var ul = document.createElement('ul');
        ul.classList.add('loop-section');
        ul.classList.add('main-list');
        
        var header = document.createElement('span');
        header.textContent = 'root';
        header.classList.add('section-header');
        ul.appendChild(header);
        
        var keys = Object.keys(item);
        for (var i=0; i<keys.length; i++) {
            var key = keys[i];
            if (key != "init" && key != "loops") {
                var value = item[key];
                if (typeof value === 'string' || typeof value === 'number') {
                    var newexpr = this.expressionListItem(key, value);
                    ul.appendChild(newexpr);
                }
                else if (Array.isArray(value)) {
                    var newlist = this.listListItem(key, value);
                    ul.appendChild(newlist);
                }
            }
        }
        
        //if (item.hasOwnProperty('init')) {
        if (keys.indexOf('init') > -1) {
            //var newinit = this.objListItem('init', item.init);
            //newinit.classList.add('init-section');
            //newinit.classList.add('vary-section');
            var newinit = this.initList(item.init);
            ul.appendChild(newinit);
        }
        
        if (item.hasOwnProperty('loops')) {            
            var newloops = this.loopsList(item.loops, "loops");
            ul.appendChild(newloops);
        }
               
        function getLabel(){
            return "main";
        }
        
        function getValue() {
            var output = {};            
            var children = this.children;
            for (var l=0; l<this.children.length; l++) {
                var child = this.children[l];
                if (child.tagName === 'UL' || child.tagName === 'LI') {
                    output[child.getLabel()] = child.getValue();
                }
            }
            return output;
        }
        Object.defineProperty(ul, "header", {value: header});
        Object.defineProperty(ul, "getValue", {value: getValue});
        Object.defineProperty(ul, "getLabel", {value: getLabel});
        return ul;
    }    
    
  })(jQuery);
