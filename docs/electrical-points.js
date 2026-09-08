export const ELECTRICAL_POINTS = [
  {
    "id": "1.06-S02",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "vertical",
    "frameId": "1.06-S02",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 130
    },
    "additionalSources": [
      {
        "document": "interior/kitchen.md",
        "line": 719
      }
    ],
    "wallLabel": "Island side, integrated Berker Integro Pure double socket",
    "heightText": "Upper edge 30 mm below the worktop underside, kitchen section A-A",
    "offsetText": "Floor supply approximately 310cm from office wall and 225cm from kitchen-run wall; socket face not dimensioned.",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "S02 supplies the integrated Berker Integro Pure double socket, not the separate Z04 floor box. Section A-A places its upper edge 30 mm below the worktop underside; approximate floor-feed coordinates do not identify its global side-panel position."
  },
  {
    "id": "1.06-Z-pending-fireplace",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.06-Z-pending-fireplace",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 170
    },
    "wallLabel": "Under fireplace firebox / inside plinth",
    "heightText": null,
    "offsetText": null,
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Unnumbered requirement for one 230V Timpex controller supply socket. The source leaves its position and final Z number pending fireplace installer measurement; this ID is an inventory placeholder."
  },
  {
    "id": "1.02-Z01",
    "room": "1.02",
    "building": "house",
    "kind": "power",
    "count": 3,
    "orientation": "horizontal",
    "frameId": "1.02-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 94
    },
    "wallLabel": "u dveří (zeď s rackem)",
    "heightText": "240 cm",
    "offsetText": "nad rackem, hned pod stropem",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Specified above the entrance-wall rack, but no horizontal offset is dimensioned. The modeled rack position remains a coordination proposal."
  },
  {
    "id": "1.02-Z02",
    "room": "1.02",
    "building": "house",
    "kind": "power",
    "count": 3,
    "orientation": "horizontal",
    "frameId": "1.02-Z02",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 95
    },
    "wallLabel": "k exteriéru",
    "heightText": "30 cm",
    "offsetText": "160 cm od dveří",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "1600mm from door to an adjacent exterior wall does not identify the measurement origin along that wall."
  },
  {
    "id": "1.02-Z03",
    "room": "1.02",
    "building": "house",
    "kind": "power",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.02-Z03",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 96
    },
    "wallLabel": "ke koupelně",
    "heightText": "30 cm",
    "offsetText": "u hlavního přívodu vody",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Main water inlet position is not encoded in current room geometry."
  },
  {
    "id": "1.02-Z04",
    "room": "1.02",
    "building": "house",
    "kind": "power",
    "count": 3,
    "orientation": "horizontal",
    "frameId": "1.02-Z04",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 97
    },
    "wallLabel": "s oknem",
    "heightText": "30 cm",
    "offsetText": "120 cm od stěny k exteriéru",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W2",
    "position": [
      9.15,
      0.3,
      18.8
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "Window wall, 1200mm from east interior wall."
  },
  {
    "id": "1.02-Z05",
    "room": "1.02",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.02-Z05",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 98
    },
    "wallLabel": "u dveří",
    "heightText": "30 cm",
    "offsetText": "23 cm od dveří vpravo",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Door-side direction needs confirmation; source says right without viewing direction."
  },
  {
    "id": "1.06-Z01",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 4,
    "orientation": "horizontal",
    "frameId": "1.06-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 122
    },
    "wallLabel": "za spodními skříňkami — u myčky/lednice",
    "heightText": "35 cm",
    "offsetText": "90 cm od zdi s kancelářemi",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W17",
    "position": [6.75,0.35,4.2],
    "normal": [0,0,1],
    "resolutionBasis": "Kitchen elevation page 1 dated 2026-02-15 locates this group 900mm from left kitchen edge, anchored to current W18 east face x 5.85. Latest electrical schedule supplies 350mm height."
  },
  {
    "id": "1.06-Z12",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.06-Z12",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 123
    },
    "wallLabel": "za spodními skříňkami — u varné desky",
    "heightText": "35 cm",
    "offsetText": "42,5 cm od zdi s oknem",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W17",
    "position": [
      9.225,
      0.35,
      4.2
    ],
    "normal": [
      0,
      0,
      1
    ],
    "resolutionBasis": "425mm from east window-wall inner face."
  },
  {
    "id": "1.06-Z02",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "vertical",
    "frameId": "1.06-Z02",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 124
    },
    "wallLabel": "v horní skříňce s digestoří",
    "heightText": "37 cm od stropu",
    "offsetText": "128 cm od portálové zdi (ne od okna)",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W17",
    "position": [
      8.37,
      2.15,
      4.2
    ],
    "normal": [
      0,
      0,
      1
    ],
    "resolutionBasis": "1280mm from east portal-wall inner face; 370mm below 2520mm ceiling."
  },
  {
    "id": "1.06-Z04",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.06-Z04",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 125
    },
    "wallLabel": "ostrůvek — podlahová zásuvka",
    "heightText": "v podlaze",
    "offsetText": "~310 cm od zdi s kancelářemi, ~225 cm od zdi s linkou",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Both plan dimensions explicitly approximate; island position must be reconciled with latest fitout."
  },
  {
    "id": "1.06-Z17",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.06-Z17",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 126
    },
    "wallLabel": "nad linkou",
    "heightText": "110 cm",
    "offsetText": "81 cm od zdi ke kancelářím/spíži",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W17",
    "position": [6.66,1.1,4.2],
    "normal": [0,0,1],
    "resolutionBasis": "Kitchen elevation page 1 dated 2026-02-15 identifies 810mm offset from left kitchen edge, current W18 east face x 5.85. Latest electrical schedule 1100mm height supersedes older drawing 1120mm."
  },
  {
    "id": "1.06-Z18",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 3,
    "orientation": "horizontal",
    "frameId": "1.06-Z18",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 127
    },
    "wallLabel": "nad linkou",
    "heightText": "110 cm",
    "offsetText": "20,6 cm od líce stavebního výstupku (střed rámečku)",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Latest electrical schedule explicitly requires on-site measurement of the drawing's ±100mm corner protrusion. The February kitchen drawing135mm socket offset is superseded by206mm, so no exact point can be assigned from the drawing alone."
  },
  {
    "id": "1.06-Z15",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.06-Z15",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 128
    },
    "wallLabel": "příčka s linkou — u chodby k ložnici",
    "heightText": "30 cm",
    "offsetText": "-",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "No horizontal dimension; referenced switch also lacks offset."
  },
  {
    "id": "1.06-Z11",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 4,
    "orientation": "horizontal",
    "frameId": "1.06-Z11",
    "switchCount": 1,
    "source": {
      "document": "electrical/mains-power.md",
      "line": 145
    },
    "wallLabel": "nad pracovní deskou — u zdi ke kanceláři",
    "heightText": "110 cm",
    "offsetText": "střed",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W23",
    "position": [
      4.1,
      1.1,
      7.7
    ],
    "normal": [
      1,
      0,
      0
    ],
    "resolutionBasis": "Coffee niche back wall; center of 1200mm niche."
  },
  {
    "id": "1.06-Z14",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 3,
    "orientation": "horizontal",
    "frameId": "1.06-Z14",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 152
    },
    "wallLabel": "TV stěna (u portálu)",
    "heightText": "20 cm",
    "offsetText": "20 cm od zdi s portálem",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W25",
    "position": [
      9.45,
      0.2,
      12.8
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "200mm from east portal wall."
  },
  {
    "id": "1.06-Z05",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 4,
    "orientation": "horizontal",
    "frameId": "1.06-Z05",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 153
    },
    "wallLabel": "TV stěna",
    "heightText": "20 cm",
    "offsetText": "101 cm od zdi s portálem",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W25",
    "position": [
      8.64,
      0.2,
      12.8
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "1010mm from east portal wall."
  },
  {
    "id": "1.06-Z13",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 4,
    "orientation": "horizontal",
    "frameId": "1.06-Z13",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 154
    },
    "wallLabel": "TV stěna",
    "heightText": "20 cm",
    "offsetText": "166 cm od zdi s portálem",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W25",
    "position": [
      7.99,
      0.2,
      12.8
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "1660mm from east portal wall."
  },
  {
    "id": "1.06-Z19",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 3,
    "orientation": "horizontal",
    "frameId": "1.06-Z19",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 155
    },
    "wallLabel": "TV stěna",
    "heightText": "85 cm",
    "offsetText": "125 cm od zdi s portálem",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W25",
    "position": [
      8.4,
      0.85,
      12.8
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "1250mm from east portal wall."
  },
  {
    "id": "1.06-Z08",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.06-Z08",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 156
    },
    "wallLabel": "zeď ke kanceláři, nalevo od niky na kafe, napravo od atria",
    "heightText": "30 cm",
    "offsetText": "střed",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W5",
    "position": [4.7,0.3,8.525],
    "normal": [1,0,0],
    "resolutionBasis": "Source center between coffee niche and atrium is the east end face of W5, z 8.30-8.75; 450mm-wide wall return confirmed against floor plan."
  },
  {
    "id": "1.06-Z09",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.06-Z09",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 157
    },
    "wallLabel": "mezi sedačkou a portálem",
    "heightText": "v podlaze",
    "offsetText": "200 cm od TV stěny, 30 cm od stěny s portálem",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": null,
    "position": [
      9.35,
      0,
      10.8
    ],
    "normal": [
      0,
      1,
      0
    ],
    "resolutionBasis": "Floor box, 300mm from east portal wall and 2000mm from TV wall."
  },
  {
    "id": "1.06-Z10",
    "room": "1.06",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.06-Z10",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 158
    },
    "wallLabel": "u vstupu do obýváku",
    "heightText": "30 cm",
    "offsetText": "15 cm od atria portálu nalevo",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W6",
    "position": [4.7,0.3,12.15],
    "normal": [1,0,0],
    "resolutionBasis": "From inside facing atrium portal, left is south:150mm past portal endz 12.00 locates point on east end face of W6."
  },
  {
    "id": "1.05-Z01",
    "room": "1.05",
    "building": "house",
    "kind": "power",
    "count": 4,
    "orientation": "horizontal",
    "frameId": "1.05-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 182
    },
    "wallLabel": "s oknem",
    "heightText": "50–60 cm (za stolem)",
    "offsetText": "25 cm od zdi k atriu",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Height specified as 500-600mm, not an exact value. Plan anchor: W4 at x0.45,z12.70."
  },
  {
    "id": "1.05-Z02",
    "room": "1.05",
    "building": "house",
    "kind": "power",
    "count": 4,
    "orientation": "horizontal",
    "frameId": "1.05-Z02",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 183
    },
    "wallLabel": "k obýváku",
    "heightText": "50–60 cm",
    "offsetText": "25 cm od zdi k atriu",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Height specified as 500-600mm, not an exact value. Plan anchor: W26 at x4.45,z12.70."
  },
  {
    "id": "1.05-Z05",
    "room": "1.05",
    "building": "house",
    "kind": "power",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.05-Z05",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 184
    },
    "wallLabel": "k host. pokoji — u stropu",
    "heightText": "u stropu (~220 cm)",
    "offsetText": "20 cm od zdi s oknem",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Height is approximate 2200mm, not exact."
  },
  {
    "id": "1.05-Z06",
    "room": "1.05",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.05-Z06",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 185
    },
    "wallLabel": "k host. pokoji — střed",
    "heightText": "30 cm",
    "offsetText": "200 cm od dveří (střed zdi)",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W27",
    "position": [
      2.45,
      0.3,
      15.55
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "Center of 4000mm guest-room partition; matches 2000mm dimension."
  },
  {
    "id": "1.05-Z03",
    "room": "1.05",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.05-Z03",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 186
    },
    "wallLabel": "k obýváku — u dveří",
    "heightText": "30 cm",
    "offsetText": "15 cm od dveří napravo",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Right of door requires viewing direction; potential duplicate of Z07 needs clarification."
  },
  {
    "id": "1.05-Z04",
    "room": "1.05",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.05-Z04",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 187
    },
    "wallLabel": "s oknem",
    "heightText": "30 cm",
    "offsetText": "15 cm od zdi s oknem nalevo",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Self-referential dimension says window wall, 150mm from window wall to left."
  },
  {
    "id": "1.05-Z07",
    "room": "1.05",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.05-Z07",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 188
    },
    "wallLabel": "k obýváku — u dveří",
    "heightText": "30 cm",
    "offsetText": "15 cm od dveří",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Unspecified side of door; potential duplicate of Z03."
  },
  {
    "id": "1.08-Z01",
    "room": "1.08",
    "building": "house",
    "kind": "power",
    "count": 4,
    "orientation": "horizontal",
    "frameId": "1.08-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 202
    },
    "wallLabel": "s oknem",
    "heightText": "50–60 cm (za stolem)",
    "offsetText": "25 cm od zdi k atriu",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Height specified as 500-600mm, not exact. Plan anchor W3 x0.45,z8.05."
  },
  {
    "id": "1.08-Z02",
    "room": "1.08",
    "building": "house",
    "kind": "power",
    "count": 4,
    "orientation": "horizontal",
    "frameId": "1.08-Z02",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 203
    },
    "wallLabel": "k obýváku",
    "heightText": "50–60 cm",
    "offsetText": "25 cm od zdi k atriu",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Height specified as 500-600mm; stepped niche means room east face is W23 x3.95 at z8.05, not W22 x4.45."
  },
  {
    "id": "1.08-Z05",
    "room": "1.08",
    "building": "house",
    "kind": "power",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.08-Z05",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 204
    },
    "wallLabel": "s oknem — u stropu, mezi oknem a koupelnou",
    "heightText": "u stropu (~220 cm)",
    "offsetText": "10 cm od zdi s oknem",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Approximate height and self-referential 100mm from same window wall; horizontal origin unresolved."
  },
  {
    "id": "1.08-Z03",
    "room": "1.08",
    "building": "house",
    "kind": "power",
    "count": 3,
    "orientation": "horizontal",
    "frameId": "1.08-Z03",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 205
    },
    "wallLabel": "k obýváku — u spíže",
    "heightText": "30 cm",
    "offsetText": "20 cm od stěny s koupelnou",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Source says living/pantry wall but 200mm from bathroom wall lands on west pantry face; confirm intended W19 return."
  },
  {
    "id": "1.08-Z04",
    "room": "1.08",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.08-Z04",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 206
    },
    "wallLabel": "s oknem",
    "heightText": "30 cm",
    "offsetText": "20 cm od zdi s koupelnou",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W3",
    "position": [
      0.45,
      0.3,
      4.5
    ],
    "normal": [
      1,
      0,
      0
    ],
    "resolutionBasis": "200mm from bathroom partition inner face."
  },
  {
    "id": "1.08-Z06",
    "room": "1.08",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.08-Z06",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 207
    },
    "wallLabel": "k obýváku — u dveří (asi na kafe koutku a ne pilíři)",
    "heightText": "30 cm",
    "offsetText": "15 cm od zdi k obýváku",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Source explicitly uncertain whether at coffee niche or pillar; 150mm from living wall is not an along-wall anchor."
  },
  {
    "id": "1.12-Z01",
    "room": "1.12",
    "building": "house",
    "kind": "power",
    "count": 3,
    "orientation": "horizontal",
    "frameId": "1.12-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 223
    },
    "wallLabel": "za postelí — levý noční stolek",
    "heightText": "41 cm",
    "offsetText": "31 cm od zdi u dveří",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W1",
    "position": [
      6.16,
      0.41,
      0.45
    ],
    "normal": [
      0,
      0,
      1
    ],
    "resolutionBasis": "310mm from bedroom west inner wall."
  },
  {
    "id": "1.12-Z02",
    "room": "1.12",
    "building": "house",
    "kind": "power",
    "count": 3,
    "orientation": "horizontal",
    "frameId": "1.12-Z02",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 224
    },
    "wallLabel": "za postelí — pravý noční stolek",
    "heightText": "41 cm",
    "offsetText": "302 cm od zdi u dveří",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W1",
    "position": [
      8.87,
      0.41,
      0.45
    ],
    "normal": [
      0,
      0,
      1
    ],
    "resolutionBasis": "3020mm from bedroom west inner wall."
  },
  {
    "id": "1.12-Z03",
    "room": "1.12",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.12-Z03",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 225
    },
    "wallLabel": "k obýváku",
    "heightText": "30 cm",
    "offsetText": "23 cm od zdi u dveří",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W17",
    "position": [
      6.08,
      0.3,
      3.95
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "230mm from bedroom west inner wall."
  },
  {
    "id": "1.12-Z04",
    "room": "1.12",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.12-Z04",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 226
    },
    "wallLabel": "k obýváku",
    "heightText": "30 cm",
    "offsetText": "95 cm od zdi u okna",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W17",
    "position": [
      9.4,
      0.3,
      3.95
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "950mm from bedroom east inner wall."
  },
  {
    "id": "1.12-Z05",
    "room": "1.12",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.12-Z05",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 227
    },
    "wallLabel": "u dveří",
    "heightText": "30 cm",
    "offsetText": "23 cm od dveří napravo",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Right of door without viewing direction."
  },
  {
    "id": "1.12-Z06",
    "room": "1.12",
    "building": "house",
    "kind": "power",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.12-Z06",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 228
    },
    "wallLabel": "za postelí — u stropu, mezi pravým nočním stolkem a oknem",
    "heightText": "u stropu (~220 cm)",
    "offsetText": "85 cm od zdi u okna",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Height approximate 2200mm."
  },
  {
    "id": "1.04-Z01",
    "room": "1.04",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.04-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 247
    },
    "wallLabel": "za postelí — levá strana",
    "heightText": "70 cm",
    "offsetText": "115 cm od zdi ke koupelně",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W2",
    "position": [
      3.3,
      0.7,
      18.8
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "1150mm from guest-room east wall."
  },
  {
    "id": "1.04-Z02",
    "room": "1.04",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.04-Z02",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 248
    },
    "wallLabel": "za postelí — pravá strana",
    "heightText": "70 cm",
    "offsetText": "65 cm od zdi s oknem",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W2",
    "position": [
      1.1,
      0.7,
      18.8
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "650mm from guest-room west wall."
  },
  {
    "id": "1.04-Z04",
    "room": "1.04",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.04-Z04",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 249
    },
    "wallLabel": "u dveří — dole",
    "heightText": "30 cm",
    "offsetText": "15 cm od dveří",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Unspecified side of guest doorway; current room has a corridor arm."
  },
  {
    "id": "1.04-Z05",
    "room": "1.04",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.04-Z05",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 250
    },
    "wallLabel": "u okna",
    "heightText": "30 cm",
    "offsetText": "30 cm od zdi s kanceláří",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W4",
    "position": [
      0.45,
      0.3,
      16.1
    ],
    "normal": [
      1,
      0,
      0
    ],
    "resolutionBasis": "300mm from guest-room north wall."
  },
  {
    "id": "1.04-Z06",
    "room": "1.04",
    "building": "house",
    "kind": "power",
    "count": 3,
    "orientation": "horizontal",
    "frameId": "1.04-Z06",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 251
    },
    "wallLabel": "ke kanceláři",
    "heightText": "120 cm",
    "offsetText": "200 cm od zdi s oknem",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W27",
    "position": [
      2.45,
      1.2,
      15.8
    ],
    "normal": [
      0,
      0,
      1
    ],
    "resolutionBasis": "2000mm from guest-room west wall."
  },
  {
    "id": "1.11-Z01",
    "room": "1.11",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.11-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 264
    },
    "wallLabel": "k chodbě — u dveří",
    "heightText": "30 cm",
    "offsetText": "15 cm od dveří nalevo",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Left of door requires viewing direction."
  },
  {
    "id": "1.10-Z01",
    "room": "1.10",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.10-Z01",
    "switchCount": 1,
    "source": {
      "document": "electrical/mains-power.md",
      "line": 278
    },
    "wallLabel": "k chodbě/šatně",
    "heightText": "120 cm",
    "offsetText": "32 cm od zdi ke kanceláři 2",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W12",
    "position": [
      3.25,
      1.2,
      3.63
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "resolutionBasis": "320mm from south bathroom partition face."
  },
  {
    "id": "1.10-Z04",
    "room": "1.10",
    "building": "house",
    "kind": "power",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.10-Z04",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 279
    },
    "wallLabel": "s oknem",
    "heightText": "30 cm",
    "offsetText": "65 cm od zdi ke kanceláři 2",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W3",
    "position": [
      0.45,
      0.3,
      3.3
    ],
    "normal": [
      1,
      0,
      0
    ],
    "resolutionBasis": "650mm from south bathroom partition face."
  },
  {
    "id": "1.03-Z01",
    "room": "1.03",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.03-Z01",
    "switchCount": 1,
    "source": {
      "document": "electrical/mains-power.md",
      "line": 293
    },
    "wallLabel": "k tech. místnosti",
    "heightText": "120 cm",
    "offsetText": "95 cm od zdi k zádveří",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W34",
    "position": [
      7.2,
      1.2,
      16.75
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "resolutionBasis": "950mm from north bathroom partition face."
  },
  {
    "id": "1.03-Z02",
    "room": "1.03",
    "building": "house",
    "kind": "power",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.03-Z02",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 294
    },
    "wallLabel": "k tech. místnosti",
    "heightText": "30 cm",
    "offsetText": "95 cm od zdi k zádveří",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W34",
    "position": [
      7.2,
      0.3,
      16.75
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "resolutionBasis": "Same wall offset as mirror outlet, lower mounting height."
  },
  {
    "id": "1.01-Z03",
    "room": "1.01",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.01-Z03",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 307
    },
    "wallLabel": "mezi host. pokoji/koupelna",
    "heightText": "30 cm",
    "offsetText": "střed",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W27",
    "position": [
      5.825,
      0.3,
      15.55
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "Center of 250mm pier between guest and bathroom door openings."
  },
  {
    "id": "1.01-Z04",
    "room": "1.01",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.01-Z04",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 308
    },
    "wallLabel": "k tech. místnosti",
    "heightText": "30 cm",
    "offsetText": "20 cm od zdi vstupní",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W27",
    "position": [
      9.45,
      0.3,
      15.55
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "200mm from east entrance wall."
  },
  {
    "id": "1.01-Z05",
    "room": "1.01",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.01-Z05",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 309
    },
    "wallLabel": "ke kanceláři",
    "heightText": "30 cm",
    "offsetText": "20 cm od zdi k obýváku",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W26",
    "position": [
      4.7,
      0.3,
      13.25
    ],
    "normal": [
      1,
      0,
      0
    ],
    "resolutionBasis": "200mm from north living-room partition."
  },
  {
    "id": "1.09-Z01",
    "room": "1.09",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.09-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 324
    },
    "wallLabel": "k obýváku",
    "heightText": "30 cm",
    "offsetText": "30 cm od zdi ke koupelně",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W15",
    "position": [
      3.7,
      0.3,
      3.45
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "300mm from west bathroom wall."
  },
  {
    "id": "1.07-Z01",
    "room": "1.07",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.07-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 336
    },
    "wallLabel": "ke kanceláři",
    "heightText": "30 cm",
    "offsetText": "90 cm od zdi (střed)",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "900mm from unspecified wall vs center of current 1800mm room span; source pantry north/south extents need confirmation."
  },
  {
    "id": "1.07-Z02",
    "room": "1.07",
    "building": "house",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.07-Z02",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 337
    },
    "wallLabel": "k šatně",
    "heightText": "30 cm",
    "offsetText": "50 cm od zdi k obýváku",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W15",
    "position": [
      3.95,
      0.3,
      3.55
    ],
    "normal": [
      0,
      0,
      1
    ],
    "resolutionBasis": "500mm from east pantry wall."
  },
  {
    "id": "2.01-Z01",
    "room": "2.01",
    "building": "loft",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "2.01-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 347
    },
    "wallLabel": "-",
    "heightText": "30 cm",
    "offsetText": "30 cm od zdi k obýváku",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Wall not specified."
  },
  {
    "id": "2.02-Z01",
    "room": "2.02",
    "building": "loft",
    "kind": "power",
    "count": 4,
    "orientation": "horizontal",
    "frameId": "2.02-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 356
    },
    "wallLabel": "ke schodišti",
    "heightText": "50-60 cm",
    "offsetText": "440 cm od západní zdi",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Height range 500-600mm; plan could map x8.00 to stair partition P11, but height unresolved."
  },
  {
    "id": "2.02-Z03",
    "room": "2.02",
    "building": "loft",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "2.02-Z03",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 357
    },
    "wallLabel": "protilehlá ke schodišti - vlevo",
    "heightText": "30 cm",
    "offsetText": "230 cm od východní zdi",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "P2",
    "position": [
      7.25,
      0.3,
      18.8
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "2300mm from east loft-room boundary."
  },
  {
    "id": "2.02-Z04",
    "room": "2.02",
    "building": "loft",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "2.02-Z04",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 358
    },
    "wallLabel": "protilehlá ke schodišti - vpravo",
    "heightText": "30 cm",
    "offsetText": "230 cm od západní zdi",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "P2",
    "position": [
      5.9,
      0.3,
      18.8
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "2300mm from west loft-room boundary."
  },
  {
    "id": "2.03-Z01",
    "room": "2.03",
    "building": "loft",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "2.03-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 370
    },
    "wallLabel": "naproti štítu/oknu",
    "heightText": "30 cm",
    "offsetText": "střed",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "P7",
    "position": [
      6.575,
      0.3,
      6.75
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "Center of wall opposite north gable."
  },
  {
    "id": "0.01-Z01",
    "room": "0.01",
    "building": "garage",
    "kind": "power",
    "count": 4,
    "orientation": "horizontal",
    "frameId": "0.01-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 401
    },
    "wallLabel": "zadní — u ponku",
    "heightText": "110 cm (nad pracovní deskou)",
    "offsetText": "160 cm od zdi do domu",
    "coordinateSpace": "garage-local",
    "resolved": true,
    "wallId": "N",
    "position": [
      1.85,
      1.1,
      0.25
    ],
    "normal": [
      0,
      0,
      1
    ],
    "resolutionBasis": "1600mm from west interior wall, garage-local coordinates."
  },
  {
    "id": "0.01-Z02",
    "room": "0.01",
    "building": "garage",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "0.01-Z02",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 402
    },
    "wallLabel": "do domu - vpravo od dveří",
    "heightText": "30 cm",
    "offsetText": "30 cm od dveří vpravo",
    "coordinateSpace": "garage-local",
    "resolved": false,
    "reason": "Door right direction not defined in drawing."
  },
  {
    "id": "0.01-Z03",
    "room": "0.01",
    "building": "garage",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "0.01-Z03",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 403
    },
    "wallLabel": "do domu - vlevo od dveří",
    "heightText": "30 cm",
    "offsetText": "30 cm od dveří vlevo",
    "coordinateSpace": "garage-local",
    "resolved": false,
    "reason": "Door left direction not defined in drawing."
  },
  {
    "id": "0.01-Z04",
    "room": "0.01",
    "building": "garage",
    "kind": "power",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "0.01-Z04",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 404
    },
    "wallLabel": "s vraty — strop",
    "heightText": "na stropu",
    "offsetText": "Ceiling track location requires confirmation",
    "coordinateSpace": "garage-local",
    "resolved": false,
    "reason": "Ceiling outlet by garage drive track requires supplier confirmation; never map onto lower wall."
  },
  {
    "id": "0.01-Z05",
    "room": "0.01",
    "building": "garage",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "0.01-Z05",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 405
    },
    "wallLabel": "východní",
    "heightText": "30 cm",
    "offsetText": "325 cm od zadní zdi",
    "coordinateSpace": "garage-local",
    "resolved": true,
    "wallId": "E",
    "position": [
      6.25,
      0.3,
      3.5
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "resolutionBasis": "3250mm from north interior wall, garage-local coordinates."
  },
  {
    "id": "0.01-Z06",
    "room": "0.01",
    "building": "garage",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "0.01-Z06",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 406
    },
    "wallLabel": "s vraty — vlevo",
    "heightText": "30 cm",
    "offsetText": "25 cm od vrat",
    "coordinateSpace": "garage-local",
    "resolved": false,
    "reason": "Left of garage gate needs viewing direction."
  },
  {
    "id": "0.01-Z07",
    "room": "0.01",
    "building": "garage",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "0.01-Z07",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 407
    },
    "wallLabel": "s vraty — vpravo",
    "heightText": "30 cm",
    "offsetText": "25 cm od vrat",
    "coordinateSpace": "garage-local",
    "resolved": false,
    "reason": "Right of garage gate needs viewing direction."
  },
  {
    "id": "E.01-Z01",
    "room": "E.01",
    "building": "exterior",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "E.01-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 420
    },
    "wallLabel": "zeď s kancelářemi sever",
    "heightText": "100 cm",
    "offsetText": "50 cm od portálu",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "North atrium wall can be identified but 500mm reference portal edge must be selected."
  },
  {
    "id": "E.02-Z01",
    "room": "E.02",
    "building": "exterior",
    "kind": "power",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "E.02-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 427
    },
    "wallLabel": "výklenek u ložnice (venkovní kuchyně)",
    "heightText": "100 cm",
    "offsetText": "35 cm od kraje (střed)",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "350mm from unspecified edge of outdoor kitchen notch."
  },
  {
    "id": "E.04-Z01",
    "room": "E.04",
    "building": "exterior",
    "kind": "power",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "E.04-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 435
    },
    "wallLabel": "u hlavního vchodu",
    "heightText": "100 cm",
    "offsetText": "30 cm napravo od dveří",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "300mm right of entrance crosses the recessed facade return; surface needs confirmation."
  },
  {
    "id": "E.08-Z01",
    "room": "E.08",
    "building": "exterior",
    "kind": "power",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "E.08-Z01",
    "source": {
      "document": "electrical/mains-power.md",
      "line": 446
    },
    "wallLabel": "u dveří do garáže (záp. fasáda)",
    "heightText": "100 cm",
    "offsetText": "30 cm napravo od dveří",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Garage exterior door right-side direction needs confirmation."
  },
  {
    "id": "1.05-D01",
    "room": "1.05",
    "building": "house",
    "kind": "data",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.05-Z01",
    "source": {
      "document": "electrical/low-voltage.md",
      "line": 83
    },
    "wallLabel": "u pracovního stolu",
    "heightText": null,
    "offsetText": "viz 1.05-Z01 silnoproud",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Shared frame 1.05-Z01: Height specified as 500-600mm, not an exact value. Plan anchor: W4 at x0.45,z12.70."
  },
  {
    "id": "1.08-D01",
    "room": "1.08",
    "building": "house",
    "kind": "data",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.08-Z01",
    "source": {
      "document": "electrical/low-voltage.md",
      "line": 84
    },
    "wallLabel": "u pracovního stolu",
    "heightText": null,
    "offsetText": "viz 1.08-Z01 silnoproud",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Shared frame 1.08-Z01: Height specified as 500-600mm, not exact. Plan anchor W3 x0.45,z8.05."
  },
  {
    "id": "1.06-D01",
    "room": "1.06",
    "building": "house",
    "kind": "data",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "1.06-Z05",
    "source": {
      "document": "electrical/low-voltage.md",
      "line": 85
    },
    "wallLabel": "TV stěna",
    "heightText": null,
    "offsetText": "viz 1.06-Z05 silnoproud",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W25",
    "position": [
      8.64,
      0.2,
      12.8
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "Shared frame 1.06-Z05; use one mixed-module faceplate."
  },
  {
    "id": "1.06-D02",
    "room": "1.06",
    "building": "house",
    "kind": "data",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.06-D02",
    "source": {
      "document": "electrical/low-voltage.md",
      "line": 86
    },
    "wallLabel": "u dveří na atrium (u Z08)",
    "heightText": null,
    "offsetText": "u Z08, střed, viz 1.06-Z08 silnoproud",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Plan reference Z08 now maps to W5 east return; tablet mounting height remains absent from the current electrical schedule."
  },
  {
    "id": "1.12-D01",
    "room": "1.12",
    "building": "house",
    "kind": "data",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.12-Z04",
    "source": {
      "document": "electrical/low-voltage.md",
      "line": 87
    },
    "wallLabel": "k obýváku",
    "heightText": null,
    "offsetText": "viz 1.12-Z04 silnoproud",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W17",
    "position": [
      9.4,
      0.3,
      3.95
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "Shared frame 1.12-Z04; use one mixed-module faceplate."
  },
  {
    "id": "1.04-D01",
    "room": "1.04",
    "building": "house",
    "kind": "data",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.04-Z06",
    "source": {
      "document": "electrical/low-voltage.md",
      "line": 88
    },
    "wallLabel": "ke kanceláři (TV)",
    "heightText": null,
    "offsetText": "viz 1.04-Z06 silnoproud",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W27",
    "position": [
      2.45,
      1.2,
      15.8
    ],
    "normal": [
      0,
      0,
      1
    ],
    "resolutionBasis": "Shared frame 1.04-Z06; use one mixed-module faceplate."
  },
  {
    "id": "2.02-D01",
    "room": "2.02",
    "building": "loft",
    "kind": "data",
    "count": 2,
    "orientation": "horizontal",
    "frameId": "2.02-Z01",
    "source": {
      "document": "electrical/low-voltage.md",
      "line": 89
    },
    "wallLabel": "u PC stolu",
    "heightText": null,
    "offsetText": "viz 2.02-Z01 silnoproud",
    "coordinateSpace": "house-local",
    "resolved": false,
    "reason": "Shared frame 2.02-Z01: Height range 500-600mm; plan could map x8.00 to stair partition P11, but height unresolved."
  },
  {
    "id": "1.01-D01",
    "room": "1.01",
    "building": "house",
    "kind": "data",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.01-D01",
    "source": {
      "document": "electrical/low-voltage.md",
      "line": 90
    },
    "wallLabel": "vstupní zeď u dveří D1, 140 cm",
    "heightText": null,
    "offsetText": "15 cm od dveří",
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W28",
    "position": [9.65, 1.40, 15.50],
    "normal": [-1, 0, 0],
    "resolutionBasis": "Aligned with the existing entrance Intercom Viewer layout: documented 1400mm height and 150mm from the south door jamb.",
    "occupiedBy": "entrance_intercom_body"
  },
  {
    "id": "1.06-KOAX01",
    "room": "1.06",
    "building": "house",
    "kind": "coax",
    "count": 1,
    "orientation": "horizontal",
    "frameId": "1.06-Z13",
    "source": {
      "document": "electrical/low-voltage.md",
      "line": 121
    },
    "wallLabel": "TV wall",
    "heightText": null,
    "offsetText": null,
    "coordinateSpace": "house-local",
    "resolved": true,
    "wallId": "W25",
    "position": [
      7.99,
      0.2,
      12.8
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "resolutionBasis": "Shared frame 1.06-Z13; use one mixed-module faceplate."
  }
];
