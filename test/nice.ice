#ifndef _NICE_ICE
#define _NICE_ICE

#include <data.ice>
#include <exceptions.ice>

/* TODO:  Use generics for lists and maps.  See here: http://doc.zeroc.com/pages/viewpage.action?pageId=3900845
 * We can instruct Ice to use Java Lists instead of primitive arrays like this:
 * ["java:type:java.util.LinkedList<Integer>"] sequence<int> IntList;
 */

module nice {
module api {
    /**************************************************************************
    *
    * Misc
    *
    **************************************************************************/

    /* We want to keep SessionId as a struct to give it an equals() and hashCode() implementation. */
    struct SessionId {
        /* A name for the Client, which allows two Clients from the same IP to have separate sessions */
        string name;
        /* The remote (client) IP address associated with this session. */
        string ip;
    };

    /* A wrapper class that lets us pass a SessionId struct as an Ice.Object instance */
    class SessionIdValue extends data::Value { SessionId val; };
}; // api
}; // nice

#endif /* _NICE_ICE */
