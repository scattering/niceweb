#ifndef _CONSOLE_ICE
#define _CONSOLE_ICE

#include <events.ice>

module nice {
module api {


module console {

    /**************************************************************************
    *
    * Console state
    *
    **************************************************************************/

    class ConsoleEvent {
        events::EventLevel level;
        long timestamp;
        long commandID;
        int eventID;
        string message;
    };

    /**************************************************************************
    *
    * Console topic
    *
    **************************************************************************/

    sequence<ConsoleEvent> ConsoleEventArray;

    interface ConsoleMonitor {
        void report(ConsoleEvent event);
        void onSubscribe(ConsoleEventArray history);
    };

}; // console


}; // api
}; // nice

#endif /* _CONSOLE_ICE */
