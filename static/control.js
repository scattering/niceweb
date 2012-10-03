// opening a control channel for niceweb

control = io.connect(ConfigSpace.root + '/control')

// sample commands:
// control.emit('move', ['sampleAngle', '5'], false) // for relative move
// control.emit('console', 'help')
