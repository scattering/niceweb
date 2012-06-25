#ifndef _EVENTS_ICE
#define _EVENTS_ICE

module nice {
module api {


module events {

    /**************************************************************************
    *
    * Event state
    *
    **************************************************************************/

    enum EventLevel { TRACE, DEBUG, INFO, IMPORTANT, WARNING, ERROR, SERIOUS, CRITICAL, FATAL };

    enum EventState { OPEN, ACKNOWLEDGED, RESOLVED };

    /*
     * Information about how an Event was "resolved"
     *
     * An EventResolution of {0, ""} means there is no resolution.
     */
    class EventResolution {
        long timestamp;
        string info;
    };

    /*
     * Information about what command caused this event.
     *
     * An EventSourceCommand of {0, ""} means there is no source command.
     */
    class EventSourceCommand {
        long id;
        string command;
    };

    class NiceEvent {
        int id;
        long timestamp;
        EventLevel level;
        EventState state;
        EventSourceCommand sourceCommand;
        string message;
        string debug;
        EventResolution resolution;
    };

    /**************************************************************************
    *
    * Event topic
    *
    **************************************************************************/

    sequence<NiceEvent> NiceEventArray;

    interface EventMonitor {
        void created(NiceEvent e);
        void acknowledged(int id);
        void resolved(int id, EventResolution resolution);
        void onSubscribe(NiceEventArray eventHistory);
    };

}; // events


}; // api
}; // nice

#endif /* _EVENTS_ICE */
