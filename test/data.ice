#ifndef DATASTREAM_ICE
#define DATASTREAM_ICE

module nice {
module api {
module data {
	
    /**************************************************************************
    *
    * Various data types
    *
    **************************************************************************/

	/* An enum used to describe to the data writer how a node should be stored. */	
	enum StorageMode{NONE, 
		/* nodes not expected to change during trajectory */
		STATIC, 
	   	/* nodes that change during trajectory */
		STATE, 
		/* nodes that output counter values */
		COUNTS, 
    	/* background logged nodes */
 		LOG
	};

	enum DeviceState
	{
		IDLE, BUSY, STOPPING
	};
  
	enum SansSampleMode
	{
		CHAMBER, HUBER, BOTH, POLARIZED_BEAM
	};

	enum CountAgainst
	{
	    TIME, MONITOR, ROI, TIME_AND_MONITOR, TIME_AND_ROI, MONITOR_AND_ROI, TIME_AND_MONITOR_AND_ROI
	};
	
    sequence<bool> BoolArray;
    sequence<byte> ByteArray;
    sequence<int> IntArray;
    sequence<long> LongArray;
    sequence<double> DoubleArray;
    sequence<string> StringArray;

    dictionary<string, double> StringToDoubleMap;
    dictionary<string, int> StringToIntMap;
    dictionary<string, string> StringToStringMap;
    dictionary<int, double> IntToDoubleMap;
    

    /* +
     * There are data types used by NICE to exchange data between the client and server.
     * Well, it's mostly for the client to be able to receive values in a generic manner.
     * Some methods might return different data types based on the arguments given, so
     * it is up to the client to know what data type to expect.  For example, the read()
     * command might return an array of ints when reading a counter, or it could return
     * a single double when reading a motor.
     */

    class Value {
    };

    sequence<Value> ValueArray;

    class NullValue extends Value {};

    /* Scalar values */
    class BoolValue extends Value { bool val; };
    class IntValue extends Value { int val; };
    class LongValue extends Value { long val; };
    class DoubleValue extends Value { double val; };
    class StringValue extends Value { string val; };
	class DeviceStateValue extends Value { DeviceState val; };
	class SansSampleModeValue extends Value { SansSampleMode val; };
	class CountAgainstValue extends Value { CountAgainst val; };
		
    /* Array Values */
    class BoolArrayValue extends Value { BoolArray val; };
    class IntArrayValue extends Value { IntArray val; };
    class LongArrayValue extends Value { LongArray val; };
    class DoubleArrayValue extends Value { DoubleArray val; };
    class StringArrayValue extends Value { StringArray val; };
    
    class StringToDoubleMapValue extends Value { StringToDoubleMap val; };
    class StringToIntMapValue extends Value { StringToIntMap val; };
    class StringToStringMapValue extends Value { StringToStringMap val; };
    class IntToDoubleMapValue extends Value { IntToDoubleMap val; };

    /* Admittedly, this sounds a little silly. But it allows heterogeneous arrays. */
    class ValueArrayValue extends Value { ValueArray val; };

	class CompletionResult
	{
  		// The end part of the original text, which one of the fullCompletions should take the place of
  		string originalTrailingText;
		// best replacement for original text which is consistent with all possible completions
		string partialCompletion;
 		// list of all matching replacements for the original text
 		StringArray fullCompletions;
	};

	interface DataMonitor
	{
		void emit(ByteArray record);
	};
  
};
};};

#endif
