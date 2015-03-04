(function(Ice, Glacier2){
    var Promise = Ice.Promise;
    var RouterPrx = Glacier2.RouterPrx;
        
    var State = {
        Disconnected: 0,
        Connecting: 1,
        Connected:2
    };

    var state = State.Disconnected;
    var hasError = false;
    active = false;

    signin = function(routerEndpoint, encoding, disableACM, username, password)
    {
        var signinPromise = new Promise();
        var communicator;
        var router;
        var session;
        var adapter;
        var username = (username == null) ? "" : username;
        var password = (password == null) ? "" : password;
        Promise.try (
            function()
            {              
                //
                // Initialize the communicator with the Ice.Default.Router property
                //
                var id = new Ice.InitializationData();
                id.properties = Ice.createProperties();
                id.properties.setProperty("Ice.Default.Router", routerEndpoint);
                if (encoding != null) {
                    id.properties.setProperty("Ice.Default.EncodingVersion", encoding);
                }
                if (disableACM) id.properties.setProperty("Ice.ACM.Client", "0");

                communicator = Ice.initialize(id);
                //
                // Get a proxy to the Glacier2 router using checkedCast to ensure
                // the Glacier2 server is available.
                //
                return RouterPrx.checkedCast(communicator.getDefaultRouter());
            }
        ).then(
            function(r)
            {
                router = r;
                return router.createSession(username, password);
            }
        ).then(
            function(s)
            {   
                session = s;
                return router.getSessionTimeout();
            }
        ).then(
            function(timeout) {
                var refreshSession = function()
                {
                    router.refreshSession().delay(timeout.toNumber() * 50).then(
                        function()
                        {
                            console.log('refreshing session... ' + (new Date()));
                            refreshSession();
                        });
                };
                refreshSession();
                //window.setInterval(router.refreshSession, timeout.toNumber() * 0.7 * 1000);
                return communicator.createObjectAdapterWithRouter("", router);
            }
        ).then(
            function(a) {
                adapter = a;
                active = true;
                signinPromise.succeed(communicator, router, session, adapter);
            }
        ).exception(
            function(ex)
            {
                //
                // Handle any exceptions that occurred during session creation.
                //
                alert(ex.toString());
                
                if(communicator)
                {
                    communicator.destroy();
                }
                signinPromise.fail(ex.toString());
            }
        );
        return signinPromise; 
    }
})(Ice, Glacier2);
