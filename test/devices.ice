#ifndef _DEVICES_ICE
#define _DEVICES_ICE

#include <data.ice>
#include <nice.ice>

module nice {
module api {

module devices {

    /* These values indicate if the value returned is possibly in an inconsistent state. */
    enum ValidityT { BAD, SUSPECT, GOOD };

    class DeviceValue {
        data::Value val;
        ValidityT validity;
        string validityString;
        long timeStampBefore;
        long timeStampAfter;
    };
    
    class DeviceNode {
        /* TODO: Is this complete as far as the device model is concerned? Remove any unused fields and add if any missing. */
        string id;
        string description;
        string units;
        double precision;
        bool isScannable;
        data::StorageMode storageMode;
        bool isStored;
        bool isUserLocked;
        bool isAdminLocked;
        DeviceValue desiredValue;
        DeviceValue currentValue;
    };

    sequence<DeviceNode> DeviceNodeArray;

    interface DeviceMonitor {
        void added(DeviceNodeArray nodes);
        void removed(data::StringArray nodeIDs);
        void changed(DeviceNodeArray nodes);
        void onSubscribe(DeviceNodeArray nodes);
    };

}; // devices

}; // api
}; // nice

#endif /* _DEVICES_ICE */
