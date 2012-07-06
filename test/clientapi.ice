#ifndef _CLIENTAPI_ICE
#define _CLIENTAPI_ICE

#include <exceptions.ice>
#include <queue.ice>
#include <console.ice>
#include <data.ice>
#include <devices.ice>

module nice {
module api {

    interface ClientApi;

    /* Simple interface for getting an interface for the actual Client API. */
    interface ClientApiManager {

        /* Returns an Api session and associates it with a name. */
        ClientApi* getAPI(string clientName);

        void subscribeToQueue(queue::QueueMonitor* monitor) throws exceptions::TopicException;
        void subscribeToData(data::DataMonitor* monitor) throws exceptions::TopicException;
        void subscribeToConsole(console::ConsoleMonitor* monitor) throws exceptions::TopicException;
        void subscribeToEvent(events::EventMonitor* monitor) throws exceptions::TopicException;
        void subscribeToDevice(devices::DeviceMonitor* monitor) throws exceptions::TopicException;
        
        /* Reports an error to the console */
        void logEvent(events::EventLevel level, string message) throws exceptions::TopicException;
        
        /* Register a client ID with the server; used by the server to be sure that the
         * data writers are listening before the data stream is started and that they
         * are done listening before the data writers are killed.
         */
        void clientCheckin(string uuid);
        void clientCheckout(string uuid);

    };

    /*
     * This interface should contain the API methods available to Clients.
     */
    interface ClientApi {
        void destroy();
        
        Object console(string command) throws exceptions::CommandException;
        data::CompletionResult complete(string command);
     
        queue::QueueNode move(data::StringArray moveList, bool relative) throws exceptions::CommandException;

        string getCanonicalNodeID(string node) throws exceptions::CommandException;
        devices::DeviceNodeArray getAllNodes() throws exceptions::CommandException;

        string read(string node) throws exceptions::CommandException;
        data::Value readValue(string node) throws exceptions::CommandException;
        devices::DeviceValue readFullValue(string node) throws exceptions::CommandException;
        
        data::StringValue echo(string message) throws exceptions::CommandException;
        
        void setUserBreak(long commandID, bool flag) throws exceptions::CommandException;
        void setSystemBreak(long commandID, bool flag) throws exceptions::CommandException;
    };

}; // api
}; // nice

#endif /* _CLIENTAPI_ICE */
