polspec = {
        "neverWrite": ["i"],
        "alwaysWrite": ["t1"],
        "entryName": "['A','B','C','D'][polarizationIn+2*polarizationOut]",
        "init": [
                ["down", 0],
                ["up", 1],
                ["counter", {
                        "countAgainst": "'MONITOR'",
                        "monitorPreset": 30000
                }],
                ["vertSlitAperture1", 0.2],
                ["vertSlitAperture2", 0.2]
        ],
        "loops": [{
                "vary": [
                        ["detectorAngle", {
                                "range": {
                                        "start": 0,"stop": 4,"step": 0.02}}],
                        ["sampleAngle", "detectorAngle/2.0"],
                        ["slit1Aperture", [1,2,3,4,5]],
                        ["slit2Aperture",
                                {"list": {
                                        "value": [1,2,3,1],
                                        "cyclic": true
                                }}
                        ]
                ],
                "loops": [{
                        "vary": [
                                ["i", {"range": 12}],
                                ["t0", "i*12+200"],
                                ["skip", "(t0==248)"]
                        ],
                        "loops": [{
                                "vary": [
                                        ["frontPolarization", ["down","up","down","up"]],
                                        ["backPolarization", ["down","down","up","up"]]
                                ]},
                                {"vary": ["middlePolarization", [1,0,0,1]]}
                                
                        ]
                }]
        }]
}

polspec_raw = JSON.stringify(polspec);
