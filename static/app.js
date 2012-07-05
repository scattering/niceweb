        Ext.define('TestClass', {
            name: 'none',
            constructor: function(name) {
        	if (name) {
        		this.name = name;
        	}
        	
        	return this;
        	
        },
        
        move: function (moveType) {
        	alert(this.name + " is taking action: " + moveType);
        	
        	return this;
        	
        }
    });
    var bot = Ext.create('TestClass', 'Bot');
    bot.move("run"); //displays message "Bot is taking action: run"