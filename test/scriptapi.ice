#ifndef _SCRIPTAPI_ICE
#define _SCRIPTAPI_ICE

#include <nice.ice>

module nice {
module api {

    interface ScriptApi;

    /* Simple interface for getting an interface for the actual Python API. */
    interface ScriptApiManager {
        /* Returns the Python scripting interface if supplied with the correct UUID token. */
        ScriptApi* getAPI(string uuidToken) throws exceptions::PermissionException;
    };

    /*
     * This interface should contain the API methods available to Python scripts.
     *
     * All methods should have as a final argument: SessionId session.  This allows the Server to identify if
     * the Python script has access to the lock and also determine which client issued the script that issued
     * the command.
     */
    interface ScriptApi {

    };

}; // api
}; // nice

#endif /* _SCRIPTAPI_ICE */
