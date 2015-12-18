(function(Ice, Glacier2, nice){
    // provides new global objects:
    // 
    // signin function (returns api from Promise);
    // subscribe function;
    // disconnect function;
    // 
    // and a new event 'niceServerShutdown' that is 
    // triggered on the window when the nice server shuts down.
    
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
    var api, communicator, router, session, adapter;
    var systemMonitor; // watch for shutdown
    var shutdown_event = new Event("niceServerShutdown");

    signin = function(routerEndpoint, encoding, disableACM, username, password)
    {
        var signinPromise = new Promise();
        
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
                id.properties.setProperty("Ice.MessageSizeMax", "100000");
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
                    if (communicator.isShutdown()) {
                        // we're done...
                        return 
                    }
                    router.refreshSession().exception(
                        function(ex) 
                        {
                            //console.log("refresh failed: ", ex);
                            alert('Sesssion refresh failed' + ex);
                        }
                    ).delay(timeout.toNumber() * 500).then(
                        function()
                        {
                            //console.log('refreshing session... ' + (new Date()));
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
                
                // disconnect on page unload
                window.addEventListener("beforeunload", disconnect);
                
                // get the client api
                var mgr = nice.api.Glacier2ClientApiSessionPrx.uncheckedCast(session);
                return mgr.getAPI('client')
            }
        ).then(
            function(ca) {
                return nice.api.ClientApiPrx.checkedCast(ca)
            }
        ).then(
            function(cam) {
                api = cam;                
                active = true;
                return api.getStaticSystemState()
            }
        ).then(
            function(state) {
                // say we're connected now
                var connection_event = new CustomEvent("niceServerConnected", {
                    'detail': state // {'instrumentID': state.instrumentID}
                }); 
                window.dispatchEvent(connection_event);
                
                systemMonitor = new SystemMonitorI();
                return subscribe(systemMonitor, 'system')
            }
        ).then(
            function() {
                signinPromise.succeed(api);
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

    disconnect = function(event) {
        adapter.deactivate().then(
            function() {
                adapter.destroy();
                communicator.shutdown();
            }
        );
    }
        
    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    subscribe = function(servant, stream) {
        return Promise.all(
            router.getSessionTimeout(),
            router.getCategoryForClient()
        ).then(
            function(timeoutArgs, categoryArgs)
            {
                var timeout = timeoutArgs[0];
                var category = categoryArgs[0];
                //
                // Create the  servant and add it to the
                // ObjectAdapter.
                //
                var proxyClass = nice.api[stream][capitalize(stream) + 'MonitorPrx'];
                var preProxy = adapter.add(servant, new Ice.Identity(stream + "Monitor", category));
                var monitorProxy = proxyClass.uncheckedCast(preProxy);
                return api['subscribeTo' + capitalize(stream)](monitorProxy);
            }
        );
    }
    
    // basic system monitor to watch for server shutdowns
    var SystemMonitorI = Ice.Class(nice.api.system.SystemMonitor, {
        onSubscribe: function(state, __current) {},
        stateChanged: function(state, __current) {},
        serverShutdown: function( __current) {
            disconnect();
            window.dispatchEvent(shutdown_event);
        }
    });
})(Ice, Glacier2, nice);
