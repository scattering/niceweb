#!/bin/bash

export LD_LIBRARY_PATH=$GLACIER_HOME/lib
$GLACIER_HOME/bin/slice2js --underscore --output-dir=generated -I$GLACIER_HOME/slice/ -I/usr/local/nice/workspaceluna/NICE/slice/ /usr/local/nice/workspaceluna/NICE/slice/*.ice
