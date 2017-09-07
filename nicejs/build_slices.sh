#!/bin/bash

#export LD_LIBRARY_PATH=$GLACIER_HOME/lib
export NICE_HOME=/home/bbm/dev/NICE
#export PATH=/opt/Ice-3.6.1/bin:$PATH
#export ICE_HOME=/opt/Ice-3.6.1
#slice2js --underscore --output-dir=generated -I$ICE_HOME/slice/ -I$NICE_HOME/slice/ $NICE_HOME/slice/*.ice
slice2js --underscore --output-dir=generated -I$NICE_HOME/slice/ $NICE_HOME/slice/*.ice
