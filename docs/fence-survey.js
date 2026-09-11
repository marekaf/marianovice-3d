const FENCE_SURVEY = {
  "source": {
    "sha256": "acfbef363bd16877fa28acb535b92a7fd43f876c3d75601b153c9b06eb98bd7b",
    "layer": "geo_Ploty-zdi",
    "description": "Existing fences and walls as surveyed, not the proposed D.3 fence."
  },
  "registration": {
    "eastOffset": -2.77,
    "northOrigin": 42.86
  },
  "segments": [
    {
      "sourceIndex": 0,
      "start": [
        43.73,
        26.34
      ],
      "end": [
        43.419999999999995,
        26.33
      ]
    },
    {
      "sourceIndex": 1,
      "start": [
        43.419999999999995,
        26.33
      ],
      "end": [
        43.43,
        22.31
      ]
    },
    {
      "sourceIndex": 2,
      "start": [
        43.43,
        22.31
      ],
      "end": [
        42.68,
        13.439999999999998
      ]
    },
    {
      "sourceIndex": 3,
      "start": [
        42.68,
        13.439999999999998
      ],
      "end": [
        41.989999999999995,
        4.950000000000003
      ]
    },
    {
      "sourceIndex": 4,
      "start": [
        41.989999999999995,
        4.950000000000003
      ],
      "end": [
        41.529999999999994,
        -0.759999999999998
      ]
    },
    {
      "sourceIndex": 5,
      "start": [
        41.529999999999994,
        -0.759999999999998
      ],
      "end": [
        33.489999999999995,
        -0.6199999999999974
      ]
    },
    {
      "sourceIndex": 6,
      "start": [
        33.489999999999995,
        -0.6199999999999974
      ],
      "end": [
        24.650000000000002,
        -0.4399999999999977
      ]
    },
    {
      "sourceIndex": 7,
      "start": [
        24.650000000000002,
        -0.4399999999999977
      ],
      "end": [
        15.830000000000002,
        -0.2700000000000031
      ]
    },
    {
      "sourceIndex": 8,
      "start": [
        15.830000000000002,
        -0.2700000000000031
      ],
      "end": [
        6.940000000000001,
        -0.09000000000000341
      ]
    },
    {
      "sourceIndex": 9,
      "start": [
        6.940000000000001,
        -0.09000000000000341
      ],
      "end": [
        -1.94,
        0.060000000000002274
      ]
    },
    {
      "sourceIndex": 10,
      "start": [
        -1.94,
        0.060000000000002274
      ],
      "end": [
        -1.35,
        7.640000000000001
      ]
    },
    {
      "sourceIndex": 11,
      "start": [
        -1.35,
        7.640000000000001
      ],
      "end": [
        -0.8300000000000001,
        15.04
      ]
    },
    {
      "sourceIndex": 12,
      "start": [
        -0.8300000000000001,
        15.04
      ],
      "end": [
        -0.2200000000000002,
        22.57
      ]
    },
    {
      "sourceIndex": 13,
      "start": [
        -0.2200000000000002,
        22.57
      ],
      "end": [
        0.45999999999999996,
        30.36
      ]
    }
  ],
  "excludedSegments": [
    {
      "sourceIndex": 14,
      "start": [
        48.12,
        26.8
      ],
      "end": [
        47.76,
        26.75
      ]
    }
  ],
  "selection": "Longest connected surveyed fence chain; detached road segment excluded",
  "heightSource": "Survey ground interpolation; fence tops are not measured"
};
if(typeof module!=='undefined')module.exports={FENCE_SURVEY};
