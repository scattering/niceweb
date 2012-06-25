#ifndef _QUEUE_ICE
#define _QUEUE_ICE

#include <data.ice>
#include <nice.ice>

module nice {
module api {


module queue {

    /**************************************************************************
    *
    * Command state
    *
    **************************************************************************/

    /* Possible states of a command. */
    enum CommandState { QUEUED, RUNNING, CHILDREN, FINISHED, SKIPPED };

    /* These command error classes are used in lieu of first-class exceptions in ZeroC Ice. */
    class CommandError {
        string message;
    };
    class CommandUnknownError extends CommandError { };
    class CommandWarningError extends CommandError { };
    class CommandSeriousError extends CommandError { };

    sequence<CommandError> CommandErrorSeq;

    /*
     * We use a struct here so we can directly compare two status's using equals(). This is mostly
     * only useful for testing, though.
     */
    struct CommandStatus {
        CommandState state;
        string commandStr;
        bool isBreakPoint;
        /* Allows commands to declare their own "meta" state that can be anything it decides. */
        string metaState;
        /* Indicates any errors that might have occurred with this command. */
        CommandErrorSeq errors;
    };

    /**************************************************************************
    *
    * Queue structure
    *
    **************************************************************************/

    class BaseQueueNode { };

    class NullQueueNode extends BaseQueueNode { };

    class ParentQueueNode extends BaseQueueNode {
        BaseQueueNode child;
    };

    class RootQueueNode extends ParentQueueNode { };

    class QueueNode extends ParentQueueNode {
        long id;
        SessionId origin;
        CommandStatus status;
        long parentID;
        long prevID;
        BaseQueueNode next;
    };

    /**************************************************************************
    *
    * Queue topic
    *
    **************************************************************************/

    /* Possible Queue event types.
     * ADDED: Nodes were added to the queue.
     * REMOVED: Nodes were removed.
     * MOVED: Nodes were removed from their current location and inserted somewhere else.
     * CHANGED: means a node's (command's) status has changed.
     */
    enum QueueEventType { ADDED, REMOVED, MOVED, CHANGED };

    interface QueueMonitor {
        void nodesAdded(QueueNode node);
        void nodesRemoved(data::LongArray nodeIDs, long oldParentID, long oldIndex);
        void nodeMoved(QueueNode node, long oldParentID, long oldIndex);
        void nodeChanged(QueueNode node);
        void onSubscribe(RootQueueNode queue);
    };

}; // queue


}; // api
}; // nice

#endif /* _QUEUE_ICE */
