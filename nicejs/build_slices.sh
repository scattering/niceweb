#!/bin/bash

#export LD_LIBRARY_PATH=$GLACIER_HOME/lib
export NICE_HOME=/home/bbm/NICE
slice2js --underscore --output-dir=generated -I/usr/share/Ice/slice/ -I$NICE_HOME/slice/ $NICE_HOME/slice/*.ice
