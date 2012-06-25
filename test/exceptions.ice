#ifndef _EXCEPTIONS_ICE
#define _EXCEPTIONS_ICE

module nice {
module api {

    
module exceptions {

    exception TopicException {
        string reason;
    };
    exception SubscriberNotReachableException extends TopicException { };
    exception TopicNotActiveException extends TopicException { };
    
    /* These are all exceptions that can be thrown as a result of running a command. */
    
    exception CommandException {
        string reason;
    };
    exception InvalidArgumentsException extends CommandException { };
    exception CannotQueueException extends CommandException { };
    exception MustQueueException extends CommandException { };
    exception PermissionException extends CommandException { };
    exception ServerLockException extends PermissionException { };
    
    
    /* These exceptions are thrown when a Client attempts to access the server when it is not fully ready. */
    
    exception ServerNotReadyException {
        string message;
    };
    exception ServerStartingException extends ServerNotReadyException { };
    exception ServerSuspendingException extends ServerNotReadyException { };
    exception ServerShuttingDownException extends ServerNotReadyException { };
    exception ServerUnrecoverableErrorException extends ServerNotReadyException {
        string trace;
    };

}; // exceptions


}; // api
}; // nice

#endif /* _EXCEPTIONS_ICE */
