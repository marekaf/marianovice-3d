// Garden layout — single source of truth for the 2D plan, the 2D editor and the 3D viewer.
// All coordinates in meters. Origin: fixed model datum (near the plot NW corner); the plot polygon is
// the surveyed parcel boundary registered to the buildings. x → east, y → south (= z in the 3D viewer).
// 2D pages render at m2px pixels per meter. Regenerate zahrada-plan.svg with: node generate-svg.js
const GARDEN = {
  m2px: 18,
  gridCellM: 2,
  title: "Garden schematic plan",
  docMeta: { project: "Zahrada Mariánovice", place: "Mariánovice, Benešov", drawing: "Situace — osazovací koncept", revision: "R1" },
  plot: {
    vertices: [[-2.16, 0.31], [41.86, -0.79], [43.75, 22.45], [43.3, 26.43], [42.41, 34.38], [0.3, 30.57]],
    sideLabels: [
      { text: "↔ 44.03 m (north)", at: [19.85, -1.5] },
      { text: "↔ 23.32 m", at: [45.3, 10.83], rotate: 90 },
      { text: "↔ 12.01 m", at: [45.4, 27.4], rotate: 82 },
      { text: "↔ 42.28 m (south)", at: [21.35, 33.9] },
      { text: "↔ 30.36 m (west)", at: [-2.7, 15.44], rotate: -90 }
    ]
  },
  setbacks: [
    { from: [10.5, 0], to: [10.5, 7.17], label: "7.18 m", at: [10.83, 3.78], anchor: "start" },
    { from: [1, 26.78], to: [10.5, 26.44], label: "10.48 m", at: [5.72, 26.17], anchor: "middle" },
    { from: [10.5, 26.44], to: [9.89, 31.44], label: "5.05 m", at: [11.11, 29.17], anchor: "start" },
    { from: [34.78, 19.39], to: [44.11, 19.39], label: "9.35 m", at: [39.44, 19.17], anchor: "middle" }
  ],
  // Vehicle fleet — nominal manufacturer dimensions (m): length, width (excl. mirrors), turning
  // circle Ø. Parked nose-north; cx = lane centre; noseZ = front bumper. Carport cars are spaced to
  // leave ~0.8 m walkways to the two pedestrian doors; garage cars sit south of the north-wall
  // workbench. hinge = A-pillar distance back from the front bumper; doorLen = front-door leaf
  // length (a coupe like the M4 has one long door, hatchbacks/estates shorter front doors).
  vehicles: [
    { name: "Škoda Scala",       l: 4.36, w: 1.79, turn: 10.4, bay: "carport", col: "#3a72b8", cx: 22.98, noseZ: 20.0, hinge: 1.65, doorLen: 1.00 },
    { name: "Audi A6 allroad",   l: 4.95, w: 1.90, turn: 12.1, bay: "carport", col: "#b3a06e", cx: 25.83, noseZ: 20.0, hinge: 1.80, doorLen: 1.05 },
    { name: "BMW M4 F82",        l: 4.67, w: 1.87, turn: 11.9, bay: "garage",  col: "#0f5aa8", cx: 30.7,  noseZ: 20.95, reversed: true, hinge: 2.00, doorLen: 1.35 }, // reverse-parked (low coupe) squarely in the 5 m door
    { name: "Yamaha Ténéré 700", l: 2.37, w: 0.91, turn: 5.0,  bay: "garage",  col: "#462482", cx: 33.1,  noseZ: 20.95, moto: true }
  ],
  elements: [
    {
      id: "house",
      name: "House 10.8 × 19.25 m",
      fixed: true,
      meta: { bbox: [10.48, 7.18, 21.28, 26.43], coreX: [14.78, 21.28], atrium: [10.48, 15.93, 14.78, 19.18], eNotch: [20.58, 11.58, 21.28, 22.53] },
      parts: [
        { kind: "polygon", points: [[10.48, 7.18], [21.28, 7.18], [21.28, 11.58], [20.58, 11.58], [20.58, 22.53], [21.28, 22.53], [21.28, 26.43], [10.48, 26.43], [10.48, 19.18], [14.78, 19.18], [14.78, 15.93], [10.48, 15.93]], fill: "#d4b896", opacity: 0.95, stroke: "#7a5e3e", sw: 2.5 },
        { kind: "text", x: 18.03, y: 17.78, text: "HOUSE", cls: "lbl", size: 20, weight: 700 },
        { kind: "text", x: 18.03, y: 19.06, text: "10.8 × 19.25 m", cls: "lbl" }
      ]
    },
    {
      id: "westTerrace",
      name: "West terrace — atrium + 1 m sidewalk",
      short: "West terrace",
      parts: [
        { kind: "rect", x: 9.48, y: 7.18, w: 1, d: 19.25, fill: "#a87d4a", opacity: 0.55, stroke: "#5a3e25", sw: 0.8 },
        { kind: "rect", x: 10.48, y: 15.93, w: 4.3, d: 3.25, fill: "#a87d4a", opacity: 0.55, stroke: "#5a3e25", sw: 0.8 },
        { kind: "text", x: 12.61, y: 17.33, text: "west terrace", cls: "lbl-sm" },
        { kind: "text", x: 12.61, y: 18.11, text: "atrium + 1 m sidewalk", cls: "dim" }
      ]
    },
    {
      id: "eastTerrace",
      name: "East terrace 3 × 11 m",
      parts: [
        { kind: "rect", x: 20.58, y: 11.58, w: 3, d: 7.82, fill: "#a87d4a", opacity: 0.78, stroke: "#5a3e25", sw: 1.2 },
        { kind: "text", x: 22.08, y: 16.39, text: "east terrace", cls: "lbl-w" },
        { kind: "text", x: 22.08, y: 17.28, text: "(E.02)", cls: "lbl-sm-w" },
        { kind: "text", x: 22.08, y: 17.6, text: "3 × 11 m", cls: "dim", fill: "#fff" }
      ]
    },
    {
      id: "saunaPath",
      name: "Path sauna → west terrace",
      short: "Sauna path",
      parts: [
        { kind: "rect", x: 9.5, y: 5.17, w: 1, d: 2.01, fill: "#cdc1ad", opacity: 0.7 }
      ]
    },
    {
      id: "carport",
      name: "Carport 6.35 × 7.05 m",
      fixed: true,
      parts: [
        { kind: "rect", x: 21.28, y: 19.4, w: 6.35, d: 7.05, fill: "#bdbdbd", opacity: 0.5, stroke: "#888", sw: 1.2, dash: "4,3" },
        { kind: "text", x: 24.44, y: 23, text: "carport", cls: "lbl-sm" },
        { kind: "text", x: 24.44, y: 24.33, text: "6.35 × 7.05 m", cls: "dim" }
      ]
    },
    {
      id: "garage",
      name: "Garage 6.50 × 7.05 m",
      fixed: true,
      // interior openings: from/w in plot meters along the wall (x for N/S walls, y for W/E),
      // h = clear height above the interior floor slab
      meta: { wallT: 0.25, workbench: { d: 0.75, h: 0.9 }, openings: [
        { wall: "S", from: 28.38, w: 5, h: 2.05, kind: "gate" },
        { wall: "W", from: 21.13, w: 1.425, h: 2.15, kind: "door" }
      ] },
      parts: [
        { kind: "rect", x: 27.63, y: 19.38, w: 6.5, d: 7.05, fill: "#888", opacity: 0.88, stroke: "#3a3a3a", sw: 2 },
        { kind: "rect", x: 28.38, y: 26.26, w: 5, d: 0.33, fill: "#222" },
        { kind: "rect", x: 27.5, y: 21.13, w: 0.26, d: 1.425, fill: "#222" },
        { kind: "text", x: 30.88, y: 22.67, text: "GARAGE", cls: "lbl-w", size: 14, weight: 700 },
        { kind: "text", x: 30.88, y: 23.67, text: "6.50 × 7.05 m", cls: "dim", fill: "#fff" }
      ]
    },
    {
      id: "driveway",
      name: "Driveway 4.5 m × ~22 m",
      parts: [
        { kind: "polygon", points: [[21.28, 19.4], [27.63, 19.4], [27.63, 26.43], [34.13, 26.43], [37.33, 27.02], [43.08, 27.89], [42.55, 32.39], [21.28, 29.72]], fill: "#cccccc", opacity: 0.55 },
        { kind: "text", x: 30.83, y: 28.33, text: "driveway", cls: "lbl-sm" },
        { kind: "text", x: 30.83, y: 29.17, text: "4.5 m × ~22 m", cls: "dim" }
      ]
    },
    {
      id: "gate",
      name: "Gate ~4.5 m",
      parts: [
        { kind: "line", x1: 43.14, y1: 27.89, x2: 42.63, y2: 32.39, stroke: "#3a3a3a", sw: 6, cap: "round" },
        { kind: "text", x: 43.7, y: 30, text: "GATE", cls: "lbl-sm", weight: 700, anchor: "start" },
        { kind: "text", x: 43.7, y: 30.78, text: "4.0 m clear", cls: "dim", anchor: "start" }
      ]
    },
    {
      id: "binStore",
      name: "Bin store (plastic box) 1.41 × 0.82 m",
      short: "Bin store",
      parts: [
        { kind: "rect", x: 40, y: 32.4, w: 0.82, d: 1.41, clipToPlot: true, fill: "#5a5e64", opacity: 0.92, stroke: "#33363a", sw: 1 },
        { kind: "text", x: 39.9, y: 33.3, text: "bins", cls: "lbl-sm", fill: "#333", anchor: "end" }
      ]
    },
    {
      id: "rainTank",
      name: "Rainwater tank 12 m³ (underground, 2.5 × 2.5 m)",
      parts: [
        { kind: "rect", x: 40, y: 22.2, w: 2.5, d: 2.5, fill: "#3a7ab8", opacity: 0.78, stroke: "#1f3a5f", sw: 1.5 },
        { kind: "text", x: 41.22, y: 23.33, text: "rain tank", cls: "lbl-sm", fill: "#fff", weight: 700 },
        { kind: "text", x: 41.22, y: 24.06, text: "12 m³", cls: "dim", fill: "#fff" }
      ]
    },
    {
      id: "pondFringe",
      name: "Pond fringe — Léto u vody (Z2)",
      short: "Pond fringe",
      meta: { plant: "perennials", exclude: "pond" },
      parts: [
        { kind: "ellipse", cx: 30.5, cy: 15.4, rx: 4.4, ry: 3.4, fill: "#8fa05a", opacity: 0.4, stroke: "#6a7a3a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 33.4, y: 12.9, text: "pond fringe Z2" }
      ]
    },
    {
      id: "pond",
      name: "Pond 5.6 × 4 m",
      parts: [
        { kind: "ellipse", cx: 30, cy: 15, rx: 2.8, ry: 2, fill: "#3a7ab8", opacity: 0.65, stroke: "#5a4a30", sw: 1.5 },
        { kind: "text", x: 30, y: 14.89, text: "pond", cls: "lbl-sm", fill: "#fff", weight: 700 },
        { kind: "text", x: 30, y: 15.56, text: "5.6 × 4 m", cls: "dim", fill: "#fff" }
      ]
    },
    {
      id: "firePit",
      name: "Fire pit + seating",
      parts: [
        { kind: "circle", cx: 37.5, cy: 6.6, r: 1.75, fill: "none", stroke: "#8a7a5a", sw: 1, dash: "5,4" },
        { kind: "circle", cx: 37.5, cy: 6.6, r: 0.5, fill: "#5a4030", opacity: 0.85, stroke: "#3a2818", sw: 1 },
        { kind: "circle", cx: 37.5, cy: 6.6, r: 0.32, fill: "#ff7733", opacity: 0.7 },
        { kind: "text", x: 37.5, y: 9.0, text: "fire pit + seating ø3.5 m", cls: "lbl-sm", fill: "#5a4828" }
      ]
    },
    {
      id: "northTrees",
      name: "Trees along north fence",
      short: "North trees",
      parts: [
        { kind: "circle", cx: 13, cy: 1.2, r: 0.5, fill: "#4d7a4d" },
        { kind: "circle", cx: 17, cy: 1.5, r: 0.5, fill: "#4d7a4d" },
        { kind: "circle", cx: 21, cy: 1, r: 0.5, fill: "#4d7a4d" },
        { kind: "circle", cx: 34, cy: 1.3, r: 0.5, fill: "#4d7a4d" },
        { kind: "circle", cx: 38, cy: 1.6, r: 0.5, fill: "#4d7a4d" },
        { kind: "circle", cx: 41, cy: 1.2, r: 0.5, fill: "#4d7a4d" },
        { kind: "circle", cx: 40.5, cy: 1.8, r: 0.5, fill: "#4d7a4d" }
      ]
    },
    {
      id: "eastTrees",
      name: "Trees along east fence (privacy)",
      short: "East trees",
      parts: [
        { kind: "circle", cx: 41.8, cy: 8, r: 0.5, fill: "#4d7a4d" },
        { kind: "circle", cx: 42, cy: 12, r: 0.5, fill: "#4d7a4d" },
        { kind: "circle", cx: 42.5, cy: 16, r: 0.5, fill: "#4d7a4d" },
        { kind: "circle", cx: 42.5, cy: 20, r: 0.5, fill: "#4d7a4d" },
        { kind: "circle", cx: 42, cy: 33, r: 0.5, fill: "#4d7a4d" },
        { kind: "circle", cx: 41, cy: 33.5, r: 0.5, fill: "#4d7a4d" }
      ]
    },
    {
      id: "sauna",
      name: "Sauna 4 × 3 m",
      parts: [
        { kind: "rect", x: 6.5, y: 2.17, w: 4, d: 3, fill: "#8b6f47", opacity: 0.9, stroke: "#5a3e25", sw: 1.2 },
        { kind: "text", x: 8.5, y: 3.5, text: "SAUNA", cls: "lbl-w" },
        { kind: "text", x: 8.5, y: 4.39, text: "4 × 3 m", cls: "dim", fill: "#fff" }
      ]
    },
    {
      id: "saunaShelter",
      name: "Sauna shelter 3 × 3 m (covers hot tub)",
      parts: [
        { kind: "rect", x: 3.5, y: 2.17, w: 3, d: 3, fill: "#cdc1ad", opacity: 0.4, stroke: "#7a5e3e", sw: 1, dash: "4,3" },
        { kind: "text", x: 5, y: 5.84, text: "shelter", cls: "lbl-sm", fill: "#5a4828" },
        { kind: "text", x: 5, y: 6.57, text: "3 × 3 m", cls: "dim" }
      ]
    },
    {
      id: "toolStore",
      name: "Garden tool + mower store (plastic box) 1.905 × 1.09 m",
      short: "Tool store",
      parts: [
        { kind: "rect", x: 0.25, y: 0.7, w: 1.905, d: 1.09, clipToPlot: true, fill: "#5a5e64", opacity: 0.92, stroke: "#33363a", sw: 1 },
        { kind: "text", x: 1.2, y: 1.4, text: "mower", cls: "lbl-sm", fill: "#fff" }
      ]
    },
    {
      id: "softub",
      name: "Softub hot tub ø 1.8 m",
      parts: [
        { kind: "circle", cx: 5, cy: 3.67, r: 0.9, fill: "#5dade2", opacity: 0.7, stroke: "#1f618d", sw: 1.5 },
        { kind: "text", x: 5, y: 3.89, text: "Softub", cls: "lbl-sm", weight: 700, fill: "#1f3a5f" }
      ]
    },
    {
      id: "pergola",
      name: "Pergola + grill 6 × 4 m",
      parts: [
        { kind: "rect", x: 25.78, y: 1.61, w: 6, d: 4, fill: "#c8a878", opacity: 0.55, stroke: "#7a5e3e", sw: 1.5, dash: "6,3" },
        { kind: "rect", x: 25.98, y: 1.81, w: 5.6, d: 3.6, fill: "#d8d2c8", opacity: 0.9 },
        { kind: "rect", x: 27.4, y: 3.11, w: 2.8, d: 1, fill: "#8a6a4a" },
        { kind: "text", x: 28.78, y: 3.47, text: "pergola + grill", cls: "lbl" },
        { kind: "text", x: 28.78, y: 4.21, text: "6 × 4 m", cls: "dim" },
        { kind: "text", x: 28.78, y: 5.11, text: "2 m off N fence", cls: "lbl-sm", fill: "#5a4828" }
      ]
    },
    {
      id: "raisedBedsPad",
      name: "Raised-beds pad (flat) 3.1 × 5.6 m",
      short: "Raised-beds pad",
      parts: [
        { kind: "rect", x: 0.7, y: 9.7, w: 3.1, d: 5.6, clipToPlot: true, fill: "#c8c2b0", opacity: 0.55, stroke: "#9a9074", sw: 1 },
        { kind: "text", x: 3.9, y: 12.5, text: "beds pad — flat", cls: "lbl-sm", fill: "#5a5030", anchor: "start" }
      ]
    },
    {
      id: "raisedBed1",
      name: "Raised bed 1 (1.0 × 2.0 m)",
      parts: [
        { kind: "rect", x: 1, y: 10, w: 1.0, d: 2.0, fill: "#7a5a3a", opacity: 0.78 },
        { kind: "text", x: 1.6, y: 11.0, text: "raised bed 1", cls: "lbl-sm-w", rotate: -90 }
      ]
    },
    {
      id: "raisedBed2",
      name: "Raised bed 2 (1.0 × 2.0 m)",
      parts: [
        { kind: "rect", x: 1, y: 13.0, w: 1.0, d: 2.0, fill: "#7a5a3a", opacity: 0.78 },
        { kind: "text", x: 1.6, y: 14.0, text: "raised bed 2", cls: "lbl-sm-w", rotate: -90 }
      ]
    },
    {
      id: "raisedBed3",
      name: "Raised bed 3 (1.0 × 2.0 m)",
      parts: [
        { kind: "rect", x: 2.5, y: 10, w: 1.0, d: 2.0, fill: "#7a5a3a", opacity: 0.78 },
        { kind: "text", x: 3.1, y: 11.0, text: "raised bed 3", cls: "lbl-sm-w", rotate: -90 }
      ]
    },
    {
      id: "raisedBed4",
      name: "Raised bed 4 (1.0 × 2.0 m)",
      parts: [
        { kind: "rect", x: 2.5, y: 13.0, w: 1.0, d: 2.0, fill: "#7a5a3a", opacity: 0.78 },
        { kind: "text", x: 3.1, y: 14.0, text: "raised bed 4", cls: "lbl-sm-w", rotate: -90 },
        { kind: "text", x: 4.2, y: 12.5, text: "each 1.0 × 2.0 m, 0.6 m tall", cls: "dim", anchor: "start" }
      ]
    },
    {
      id: "screenNorth",
      name: "Privacy screen — north neighbour (2 × 2 m louvre)",
      meta: { screen: { h: 2.0 } },
      parts: [
        { kind: "rect", x: 13.83, y: 0.2, w: 2.4, d: 0.14, fill: "#4a4a4e", opacity: 0.92, stroke: "#26262a", sw: 1 },
        { kind: "text", x: 15.03, y: 0.95, text: "paraván N", cls: "lbl-sm", fill: "#3a3a3e" }
      ]
    },
    {
      id: "screenWest",
      name: "Privacy screen — west neighbour (2 × 2 m louvre)",
      meta: { screen: { h: 2.0 } },
      parts: [
        { kind: "rect", x: 0.86, y: 16.36, w: 0.14, d: 2.4, fill: "#4a4a4e", opacity: 0.92, stroke: "#26262a", sw: 1 },
        { kind: "text", x: 1.35, y: 17.56, text: "paraván Z", cls: "lbl-sm", fill: "#3a3a3e", rotate: -90 }
      ]
    },
    {
      id: "screenSouth",
      name: "Privacy screen — south neighbour (2 × 2 m louvre)",
      meta: { screen: { h: 2.0 } },
      parts: [
        { kind: "rect", x: 14.0, y: 31.4, w: 2.4, d: 0.14, fill: "#4a4a4e", opacity: 0.92, stroke: "#26262a", sw: 1 },
        { kind: "text", x: 15.2, y: 31.1, text: "paraván J", cls: "lbl-sm", fill: "#3a3a3e" }
      ]
    },
    {
      id: "orchardMeadow",
      name: "Orchard meadow understory (Z12)",
      short: "Orchard meadow",
      meta: { plant: "meadow" },
      parts: [
        { kind: "rect", x: 0.5, y: 21.3, w: 5.2, d: 8.8, clipToPlot: true, fill: "#b5c98a", opacity: 0.35, stroke: "#8aa85a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 4.8, y: 24.6, text: "meadow Z12", rotate: -90 }
      ]
    },
    {
      id: "orchard",
      name: "Orchard ~5.5 × 11 m",
      parts: [
        { kind: "rect", x: 0.4, y: 21.11, w: 5.56, d: 9.0, fill: "#7fa66f", opacity: 0.4, clipToPlot: true },
        { kind: "circle", cx: 1.2, cy: 22, r: 0.5, fill: "#5a8a5a" },
        { kind: "circle", cx: 4, cy: 23.5, r: 0.5, fill: "#5a8a5a" },
        { kind: "circle", cx: 1.2, cy: 26, r: 0.5, fill: "#5a8a5a" },
        { kind: "circle", cx: 4, cy: 27.5, r: 0.5, fill: "#5a8a5a" },
        { kind: "circle", cx: 1.2, cy: 30, r: 0.5, fill: "#5a8a5a" },
        { kind: "circle", cx: 4, cy: 29, r: 0.5, fill: "#5a8a5a" },
        { kind: "text", x: 2.78, y: 27.22, text: "orchard", cls: "lbl", rotate: -90 },
        { kind: "text", x: 6.39, y: 27.22, text: "~5.5 × 11 m", cls: "dim", anchor: "start" }
      ]
    },
    {
      id: "greenhouse",
      name: "Greenhouse 2.6 × 3.6 m",
      short: "Greenhouse",
      parts: [
        { kind: "rect", x: 1.5, y: 24.0, w: 2.6, d: 3.6, clipToPlot: true, fill: "#cfe8ef", opacity: 0.8, stroke: "#5f93a8", sw: 1.2 },
        { kind: "text", x: 2.8, y: 25.8, text: "greenhouse", cls: "lbl-sm", fill: "#245a6a", rotate: -90 }
      ]
    },
    {
      id: "compost",
      name: "Compost bin 2.0 × 1.0 m (open, slatted)",
      short: "Compost",
      parts: [
        { kind: "rect", x: 1.6, y: 28.3, w: 2.0, d: 1.0, clipToPlot: true, fill: "#6a4a2a", opacity: 0.6, stroke: "#4a3218", sw: 1 },
        { kind: "text", x: 2.6, y: 28.95, text: "compost", cls: "lbl-sm", fill: "#fff" }
      ]
    },
    {
      id: "bedTerrace",
      name: "Terrace bed — Citrónový sorbet (Z1)",
      short: "Terrace bed",
      meta: { plant: "perennials" },
      parts: [
        { kind: "rect", x: 24.6, y: 11.6, w: 2.4, d: 7.8, fill: "#8fa05a", opacity: 0.4, stroke: "#6a7a3a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 25.9, y: 15.5, text: "terrace bed Z1", rotate: -90 }
      ]
    },
    {
      id: "prairieIsland",
      name: "Prairie island — Oudolf mix (Z3)",
      short: "Prairie island",
      meta: { plant: "perennials" },
      parts: [
        { kind: "rect", x: 28.5, y: 7.2, w: 4.5, d: 3.6, fill: "#8fa05a", opacity: 0.4, stroke: "#6a7a3a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 30.75, y: 9.15, text: "prairie island Z3" }
      ]
    },
    {
      id: "saunaBed",
      name: "Sauna surround — shrubs + aromatics (Z4)",
      short: "Sauna bed",
      meta: { plant: "mixed" },
      parts: [
        { kind: "rect", x: 0.6, y: 1.97, w: 2.6, d: 3.2, fill: "#6a8e5a", opacity: 0.4, stroke: "#4a6e3a", sw: 1, dash: "5,3" },
        { kind: "rect", x: 2, y: 5.37, w: 6, d: 1.6, fill: "#6a8e5a", opacity: 0.4, stroke: "#4a6e3a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 1.9, y: 3.67, text: "sauna bed Z4", rotate: -90 }
      ]
    },
    {
      id: "pergolaBeds",
      name: "Pergola climbers + underplanting (Z5)",
      short: "Pergola beds",
      meta: { plant: "mixed" },
      parts: [
        { kind: "rect", x: 23.2, y: 1.61, w: 2, d: 4, fill: "#6a8e5a", opacity: 0.4, stroke: "#4a6e3a", sw: 1, dash: "5,3" },
        { kind: "rect", x: 32.4, y: 1.61, w: 2, d: 4, fill: "#6a8e5a", opacity: 0.4, stroke: "#4a6e3a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 24.2, y: 5.31, text: "climbers Z5" }
      ]
    },
    {
      id: "arrivalStrip",
      name: "Arrival strip — Citrónový sorbet (Z6)",
      short: "Arrival strip",
      meta: { plant: "perennials" },
      parts: [
        { kind: "polygon", points: [[21.3, 29.95], [42.4, 32.2], [41.8, 33.6], [21.3, 32.4]], fill: "#8fa05a", opacity: 0.4, stroke: "#6a7a3a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 30, y: 31.9, text: "arrival strip Z6" }
      ]
    },
    {
      id: "eastUnderstory",
      name: "East privacy understory — Růžové mámení (Z7)",
      short: "East understory",
      meta: { plant: "shrubs" },
      parts: [
        { kind: "rect", x: 40, y: 4.5, w: 2.2, d: 16.5, fill: "#6a8e5a", opacity: 0.4, stroke: "#4a6e3a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 41.9, y: 12.6, text: "east understory Z7", rotate: -90 }
      ]
    },
    {
      id: "atriumPots",
      name: "Atrium planters — Amelanchier + shade pots (Z8)",
      short: "Atrium pots",
      meta: { plant: "shrubs" },
      parts: [
        { kind: "circle", cx: 11.3, cy: 16.4, r: 0.35, fill: "#6a8e5a", opacity: 0.8 },
        { kind: "circle", cx: 13.6, cy: 16.5, r: 0.6, fill: "#6a8e5a", opacity: 0.8 },
        { kind: "circle", cx: 13.9, cy: 18.5, r: 0.35, fill: "#6a8e5a", opacity: 0.8 }
      ]
    },
    {
      id: "northFoundation",
      name: "North foundation bed — Kvetoucí stín (Z9a)",
      short: "North bed",
      meta: { plant: "perennials" },
      parts: [
        { kind: "rect", x: 10.7, y: 5.6, w: 10.6, d: 1.5, fill: "#8fa05a", opacity: 0.4, stroke: "#6a7a3a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 16, y: 6.55, text: "north bed Z9a" }
      ]
    },
    {
      id: "southFoundation",
      name: "South foundation bed — peonies, roses, lilac (Z9b)",
      short: "Peony bed",
      meta: { plant: "mixed" },
      parts: [
        { kind: "rect", x: 10.5, y: 26.6, w: 10.8, d: 1.8, fill: "#6a8e5a", opacity: 0.4, stroke: "#4a6e3a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 16, y: 27.75, text: "peony bed Z9b" }
      ]
    },
    {
      id: "garageFaceBed",
      name: "Garage north-face bed — Růžové mámení (Z10)",
      short: "Garage bed",
      meta: { plant: "perennials" },
      parts: [
        { kind: "rect", x: 24.7, y: 17.8, w: 10, d: 1.5, fill: "#8fa05a", opacity: 0.4, stroke: "#6a7a3a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 27.4, y: 18.8, text: "shade bed Z10" }
      ]
    },
    {
      id: "facadeClimbers",
      name: "Facade climbers — garage E wall + atrium walls",
      short: "Facade climbers",
      parts: [
        { kind: "rect", x: 34.86, y: 19.6, w: 0.25, d: 6.6, fill: "#5a8a4a", opacity: 0.85 },
        { kind: "rect", x: 10.7, y: 15.98, w: 3.9, d: 0.25, fill: "#5a8a4a", opacity: 0.85 },
        { kind: "rect", x: 10.7, y: 18.95, w: 3.9, d: 0.25, fill: "#5a8a4a", opacity: 0.85 }
      ]
    },
    {
      id: "zasivarna",
      name: "Zašívárna — hidden bench (blue/red)",
      short: "Zašívárna",
      parts: [
        { kind: "rect", x: 31.4, y: 18.3, w: 1.8, d: 0.5, fill: "#c0392b", stroke: "#8a2a1e", sw: 0.8 },
        { kind: "text", x: 32.3, y: 17.95, text: "zašívárna", cls: "lbl-sm", fill: "#8a2a1e" }
      ]
    },
    {
      id: "rainGarden",
      name: "NE rain garden — Léto u vody swale (Z11)",
      short: "Rain garden",
      meta: { plant: "perennials" },
      parts: [
        { kind: "rect", x: 38.2, y: 2.2, w: 3.7, d: 3.8, fill: "#7aa88a", opacity: 0.45, stroke: "#4a7a6a", sw: 1, dash: "5,3" },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 40.2, y: 4.35, text: "rain garden Z11" }
      ]
    },
    {
      id: "steppingPaths",
      name: "Stepping-stone paths (šlapáky)",
      short: "Paths",
      parts: [
        { kind: "circle", cx: 9.9, cy: 25.43, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 9.27, cy: 25, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 9.02, cy: 24.28, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 8.39, cy: 23.86, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 8.14, cy: 23.14, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 7.51, cy: 22.72, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 7.34, cy: 21.97, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 6.77, cy: 21.46, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 6.63, cy: 20.72, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 6.06, cy: 20.21, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 5.92, cy: 19.47, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 5.47, cy: 18.88, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 5.47, cy: 18.12, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 5.01, cy: 17.52, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 5.01, cy: 16.76, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 25.02, cy: 14.53, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 24.98, cy: 13.77, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 25.4, cy: 13.15, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 25.37, cy: 12.39, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 25.81, cy: 11.77, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 25.82, cy: 11.01, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 26.28, cy: 10.41, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 26.29, cy: 9.65, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 26.79, cy: 9.07, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 26.84, cy: 8.31, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 27.33, cy: 7.74, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 27.5, cy: 7.01, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 28.11, cy: 6.57, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 32.47, cy: 4.92, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 33.23, cy: 4.88, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 33.86, cy: 5.3, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 34.62, cy: 5.28, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 35.21, cy: 5.75, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 35.97, cy: 5.76, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 37.49, cy: 8.45, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 37.42, cy: 9.21, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 36.92, cy: 9.77, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 36.85, cy: 10.53, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 36.31, cy: 11.06, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 36.15, cy: 11.8, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 35.57, cy: 12.3, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 35.42, cy: 13.04, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 34.84, cy: 13.54, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 34.68, cy: 14.28, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 34.11, cy: 14.78, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 34, cy: 15.52, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 33.52, cy: 16.11, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 33.49, cy: 16.87, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 33, cy: 17.44, r: 0.24, fill: "#9a958c", opacity: 0.95 },
        { kind: "circle", cx: 32.92, cy: 18.2, r: 0.24, fill: "#9a958c", opacity: 0.95 }
      ]
    },
    {
      id: "pathLights",
      name: "Path lights — bollards",
      short: "Path lights",
      meta: { light: "bollard" },
      parts: [
        { kind: "circle", cx: 23, cy: 30.3, r: 0.18, fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 29, cy: 31, r: 0.18, fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 35, cy: 31.7, r: 0.18, fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 41, cy: 32.4, r: 0.18, fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 9.1, cy: 4.5, r: 0.18, fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 9.1, cy: 6.5, r: 0.18, fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 24.2, cy: 21.9, r: 0.18, fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "text", x: 26, y: 31.3, text: "path lights", cls: "lbl-sm", fill: "#8a6a1a" }
      ]
    },
    {
      id: "gardenSpots",
      name: "Garden spotlights — tree/pond uplights",
      short: "Garden spots",
      meta: { light: "spot" },
      parts: [
        { kind: "circle", cx: 41.4, cy: 33.6, r: 0.22, fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 41.4, cy: 33.6, r: 0.07, fill: "#8a6a1a" },
        { kind: "circle", cx: 33.8, cy: 13.6, r: 0.22, fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 33.8, cy: 13.6, r: 0.07, fill: "#8a6a1a" },
        { kind: "circle", cx: 25, cy: 6.3, r: 0.22, fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 25, cy: 6.3, r: 0.07, fill: "#8a6a1a" }
      ]
    }
  ]
};

if (typeof module !== "undefined") module.exports = { GARDEN };
