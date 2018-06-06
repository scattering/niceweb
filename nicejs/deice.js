"use strict";

// requires Ice 3.5 to 3.6 libraries (not needed in Ice 3.7?)

var recurse_on_array = true;

function deice(value) {
    var output_value;
    if (value == null) {
        output_value = value;
    }
    else if (value instanceof Array) {
        if (recurse_on_array) {
            output_value = value.map(deice);
        } else {
            output_value = value;
        }
    }
    else if (value instanceof Ice.Class || value instanceof Ice.Object ) {
        output_value = {};
        for (var k in value) {
            if (k != "__address" && value.hasOwnProperty(k)) {
                output_value[k] = deice(value[k]);
            }
        }
    }
    else if (value instanceof Ice.HashMap) {
        output_value = {}; 
        value.forEach( function(dn) { 
            output_value[dn]=deice(value.get(dn));
        });
    }
    else if (value instanceof Ice.EnumBase) {
        output_value = "'" + value._name + "'";
    }
    else if (value.toNumber) {
        // for Ice.Long type
        output_value = value.toNumber();
    }
    else if (typeof value != 'object') {
        output_value = value;
    }
    else {
        output_value = {};
        for (var k in value) {
            if (value.hasOwnProperty(k)) {
                output_value[k] = deice(value[k]);
            }
        }
    }
    return output_value;
}
