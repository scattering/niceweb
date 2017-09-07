(function(Ice, Glacier2, nice){
    // provides new global objects:
    // 
    // signin function (returns api from Promise);
    // subscribe function;
    // disconnect function;
    // 
    // and a new event 'niceServerShutdown' that is 
    // triggered on the window when the nice server shuts down.
    
    //var Promise = Ice.Promise;
    var RouterPrx = Glacier2.RouterPrx;
        
    var State = {
        Disconnected: 0,
        Connecting: 1,
        Connected:2
    };

    var state = State.Disconnected;
    var hasError = false;
    active = false;
    var api, communicator, router, session, adapter, server_state;
    var systemMonitor; // watch for shutdown
    var shutdown_event = new Event("niceServerShutdown");

    signin = function(routerEndpoint, encoding, disableACM, username, password)
    {
        var signinPromise = Promise.resolve();
        
        var username = (username == null) ? "" : username;
        var password = (password == null) ? "" : password;
        return signinPromise.then(
        //Promise.try (
            function()
            {              
                //
                // Initialize the communicator with the Ice.Default.Router property
                //
                var id = new Ice.InitializationData();
                id.properties = Ice.createProperties();
                id.properties.setProperty("Ice.Default.Router", routerEndpoint);
                //id.properties.setProperty("Ice.Plugin.IceSSL", "IceSSL:createIceSSL");
                //id.properties.setProperty("IceSSL.DefaultDir", "certs");
                //id.properties.setProperty("IceSSL.CAs", "cacert.pem");
                //id.properties.setProperty("IceSSL.Password", "iceicebaby");
                //id.properties.setProperty("IceSSL.TrustOnly=CN="Server"
                
                id.properties.setProperty("Ice.MessageSizeMax", "100000");
                id.properties.setProperty("Ice.ACM.Close", "0");
                id.properties.setProperty("Ice.ACM.Heartbeat", "3");
                //id.properties.setProperty("Ice.ACM.Timeout", "120");
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
                return Promise.all([
                    router.getACMTimeout(),
                    communicator.createObjectAdapterWithRouter("", router)
                ])
            }
        ).then(
            function(aa)
            {   
                var acmTimeout = aa[0];
                adapter = aa[1];
                console.log("acm timeout:", acmTimeout);
        
                if(acmTimeout > 0)
                    {
                        var connection = router.ice_getCachedConnection();
                        connection.setACM(acmTimeout, Ice.ACMClose.CloseOff, Ice.ACMHeartbeat.HeartbeatAlways);
                        connection.setCloseCallback(function(c) { alert("connection lost: ", String(c)) });
                        connection.setHeartbeatCallback(function(hb) { console.log('server heartbeat') });
                    }

                
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
                server_state = state;
                window.dispatchEvent(connection_event);
                
                systemMonitor = new SystemMonitorI();
                return subscribe(systemMonitor, 'system')
            }
        ).then(
            function() {
                return [api, communicator, router, session, adapter, server_state];
            }
        ).catch(
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
                throw ex.toString();
            }
        );
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
        return Promise.all([
            router.getSessionTimeout(),
            router.getCategoryForClient()
        ]).then(
            function(tc) //timeoutArgs, categoryArgs)
            {
                var timeout = tc[0];
                var category = tc[1];
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
    var SystemMonitorI = class extends nice.api.system.SystemMonitor {
        onSubscribe(state, __current) {};
        stateChanged(state, __current) {};
        serverShutdown( __current) {
            disconnect();
            window.dispatchEvent(shutdown_event);
        }
    }
})(Ice, Glacier2, nice);
