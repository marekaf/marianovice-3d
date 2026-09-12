// Garden layout — single source of truth for the 2D plan, the 2D editor and the 3D viewer.
// All coordinates in meters. Origin: fixed model datum (near the plot NW corner); the plot polygon is
// the surveyed parcel boundary registered to the buildings. x → east, y → south (= z in the 3D viewer).
// 2D pages render at m2px pixels per meter. Regenerate zahrada-plan.svg with: node generate-svg.js
const GARDEN = {
  m2px: 18,
  gridCellM: 2,
  gradingBanks: [{"id":"north","spotFoot":[35.701,-0.6585],"spotCrest":[35.78805148016373,4.340742146545947],"width":5,"designSlope":0.4,"maxSlope":0.48,"points":[[34.13,-0.6311442786069628],[41.529999999999994,-0.759999999999998],[41.61705148016373,4.239242146545946],[34.13,4.369613689732877]]},{"id":"east","spotFoot":[42.059,5.799],"spotCrest":[37.573788372089524,6.1635224997948495],"width":4.5,"designSlope":0.4,"maxSlope":0.48,"points":[[41.529999999999994,-0.759999999999998],[41.989999999999995,4.950000000000003],[42.68,13.439999999999998],[43.182254791431795,19.38],[38.66619708064055,19.38],[38.19538257682798,13.811833801576725],[37.50465950696631,5.312936898496222],[37.04453176295158,-0.39864879351273474]]}],
  title: "Zahrada · situace a terénní úpravy",
  docMeta: { project: "Zahrada Mariánovice", place: "Mariánovice, Benešov", drawing: "Situace — osazovací koncept", revision: "R1" },
  plot: {
    vertices: [[-2.16, 0.31], [41.86, -0.79], [43.75, 22.45], [43.3, 26.43], [42.41, 34.38], [0.3, 30.57]],
    sideLabels: [
      { text: "↔ 44.03 m (sever)", at: [19.85, -1.5] },
      { text: "↔ 23.32 m", at: [45.3, 10.83], rotate: 90 },
      { text: "↔ 12.01 m", at: [45.4, 27.4], rotate: 82 },
      { text: "↔ 42.28 m (jih)", at: [21.35, 33.9] },
      { text: "↔ 30.36 m (západ)", at: [-2.7, 15.44], rotate: -90 }
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
  gardenRoutes: [
    {id:"Wellness access",points:[[9.98,7.2],[9.98,5.7],[8,5.7]],width:1},
    {id:"Productive access",points:[[8,5.7],[6.6,6.2],[6.6,13.2],[5.6,13.2],[3.5,13.2]],width:1,levelAxis:{axis:"z",start:6.2,end:9.8},levelFractions:[0,0,1,1,1]},
    {id:"Bed access",points:[[3.5,10.6],[3.5,13.2],[1.8,13.2]],width:1,bankSlope:.48},
    {id:"Greenhouse access",points:[[2.5,5.7],[2.5,6.9]],width:.8,bankSlope:.35,startRelativeLevel:0,levelAxis:{axis:"z",start:6.2,end:6.9}},
    {"id":"Daily dining","levelAxis":{"axis":"z","start":11.4,"end":6.2},"points":[[23,12],[24.4,12],[24.4,8],[25.42785414913,5.38127450503]],"width":1.2},
    {id:"Quiet garden approach",points:[[9.98,18.6],[8,18.6],[6.8,19]],width:1},
    {"id":"Gathering connection","points":[[27.9,4.6],[28.8,4.6],[30.15,5.75]],"width":1.2,"startLanding":1.2,"endLanding":.5},
    {id:"Pond walk",points:[[24.2,17.8],[28,17.8],[32,17.8],[38.7,17.8],[39.6,13.5],[38.8,11.3],[31.7,11.3],[29,8.8],[29,6.3],[30.25,5.75]],width:1.2},
    {id:"Service connection",points:[[38.7,17.8],[37,20],[37,26.3]],width:1.2}
  ],
  gardenReserves: [{"id":"Eastern utilities: verify extent","kind":"rect","x":38,"y":19,"w":5,"d":7,"type":"reserve"},{"id":"Low ground: drainage investigation","kind":"rect","x":37.8,"y":0.2,"w":4.1,"d":5.8,"type":"reserve"}],
  elements: [
    {id:'heatPumpService',name:'Rovná servisní odbočka k tepelnému čerpadlu',short:'Servis TČ',meta:{grading:{relativeLevel:-.54}},parts:[{kind:'rect',x:17.125,y:26.7,w:4.155,d:.6,fill:'#c8c2b0',opacity:.65,stroke:'#77715f',sw:.7},{kind:'text',x:19.3,y:27.15,text:'servis TČ',cls:'lbl-sm'}]},
    {id:'heatPumpPad',name:'Základ pod venkovní jednotkou TČ',short:'Základ TČ',parts:[{kind:'rect',x:17.125,y:26.7,w:1.15,d:.6,fill:'#8d8a84',opacity:.9,stroke:'#666',sw:.7}]},
    {id:'westDrainageStrip',name:'Snížený pás zeleně u západní terasy',short:'Západní pás zeleně',meta:{plant:'perennials',palette:'bedTerrace',maxHeight:.45,grading:{relativeLevel:-.3}},parts:[{kind:'rect',x:8.73,y:7.18,w:.75,d:19.25,fill:'#8fa05a',opacity:.5,stroke:'#6a7a3a',sw:.8}]},
    {id:'arrivalStrip',name:'Kvetoucí pás podél jižní hranice příjezdu',meta:{palette:'arrivalStrip',plant:'perennials',maxHeight:.9},parts:[{kind:'polygon',points:[[21.4,30.1],[38.9,32.3],[38.9,33.5],[21.4,31.8]],fill:'#8fa05a',opacity:.4,stroke:'#6a7a3a',sw:1}]},
    {id:'tankCover',name:'Nízká zeleň nad nádrží: mocnost zeminy a zatížení k ověření',meta:{plant:'perennials',utilityCover:true,maxHeight:.25},parts:[{kind:'polygon',points:[[35.63,16.7],[38.63,16.7],[38.63,20.2],[35.63,20.2]],fill:'#8fa05a',opacity:.4,stroke:'#6a7a3a',sw:1}]},
    {id:'dressingNorthShrubs',name:'Stálezelená výsadba před šatnou',meta:{plant:'shrubs',leafHabit:'evergreen',proposal:true},parts:[
      {kind:'circle',cx:12.8,cy:2.4,r:1.55,fill:'#496748'},
      {kind:'circle',cx:15.1,cy:2.1,r:1.65,fill:'#496748'},
      {kind:'circle',cx:17.1,cy:2.4,r:1.6,fill:'#496748'}
    ]},
    {id:'westEvergreenShrubs',name:'Stálezelená výsadba podél západní hranice',meta:{plant:'shrubs',leafHabit:'evergreen',proposal:true},parts:[
      {kind:'circle',cx:.5,cy:9.6,r:1.15,fill:'#496748'},
      {kind:'circle',cx:1.05,cy:11.1,r:1.2,fill:'#496748'},
      {kind:'circle',cx:.45,cy:12.8,r:1.2,fill:'#496748'},
      {kind:'circle',cx:.95,cy:14.5,r:1.25,fill:'#496748'},
      {kind:'circle',cx:.55,cy:16.1,r:1.3,fill:'#496748'},
      {kind:'circle',cx:1.25,cy:17.4,r:1.35,fill:'#496748'},
      {kind:'circle',cx:.9,cy:18.9,r:1.3,fill:'#496748'},
      {kind:'circle',cx:1.35,cy:20.4,r:1.35,fill:'#496748'},
      {kind:'circle',cx:.9,cy:21.8,r:1.2,fill:'#496748'}
    ]},
    {id:'officeViewBorder',name:'Kvetoucí výsadba před pracovnou',meta:{palette:'prairieIsland',plant:'perennials',maxHeight:.8},parts:[{kind:'polygon',points:[[4.4,20],[5.8,19.7],[7.2,20],[7.6,21.4],[7.2,22.3],[5.1,22.5],[4.4,21.6]],fill:'#8fa05a',opacity:.4,stroke:'#6a7a3a',sw:1}]},
    {"id":"westBackbone","name":"Západní doprovodná výsadba","meta":{"palette":"saunaBed","plant":"mixed"},"parts":[{"kind":"polygon","points":[[-0.9,1],[1.7,1],[1.7,6.6],[1.7,12.5],[1.6,15.5],[1.5,21.7],[0.2,22],[-0.9,12]],"fill":"#8fa05a","opacity":0.4,"stroke":"#6a7a3a","sw":1}]},
    {"id":"productiveBorder","name":"Výsadba u užitkové zahrady","meta":{"palette":"prairieIsland","plant":"mixed"},"parts":[{"kind":"polygon","points":[[2.1,8.8],[5,8.5],[9,8.8],[9,9.5],[5.2,9.4],[2.1,9.5]],"fill":"#8fa05a","opacity":0.4,"stroke":"#6a7a3a","sw":1}]},
    {"id":"quietGardenBorder","name":"Výsadba u klidové zahrady","meta":{"palette":"prairieIsland","plant":"mixed"},"parts":[{"kind":"polygon","points":[[1.5,16.3],[3.3,16.3],[6.6,16.6],[8.1,17.4],[7.7,17.8],[6.2,17.3],[3.5,17.2],[2.3,18],[2.5,20.5],[5,21.3],[7,20.8],[8.2,21.5],[6,22],[1.5,21.7]],"fill":"#8fa05a","opacity":0.4,"stroke":"#6a7a3a","sw":1}]},
    {"id":"eastGatheringBorder","name":"Výsadba u posezení a jezírka","meta":{"palette":"pondFringe","plant":"mixed","exclude":"pond"},"parts":[{"kind":"polygon","points":[[22.5,0.8],[36.8,0.3],[37.4,6.5],[41.6,6.5],[42.3,17.7],[37.7,18.5],[34.8,18.2],[31.7,18.7],[27.8,18.5],[26.8,17.2],[31,16.7],[31.6,14],[30.8,11.9],[32.4,10.8],[32.4,5.2],[28,5],[24,6],[22.6,4]],"fill":"#8fa05a","opacity":0.4,"stroke":"#6a7a3a","sw":1}]},
    {"id":"terraceFrontage","name":"Nízká výsadba před terasou","meta":{"palette":"bedTerrace","plant":"perennials","maxHeight":0.65},"parts":[{"kind":"polygon","points":[[25,11.8],[25.6,12.8],[25.6,15.8],[25,16.6],[24.6,16],[24.6,12.5]],"fill":"#8fa05a","opacity":0.4,"stroke":"#6a7a3a","sw":1}]},
    {
      id: "house",
      name: "Dům 10,8 × 19,25 m",
      fixed: true,
      meta: { bbox: [10.48, 7.18, 21.28, 26.43], coreX: [14.93, 21.28], atrium: [10.48, 15.93, 14.93, 19.18], eNotch: [20.58, 11.58, 21.28, 22.53] },
      parts: [
        { kind: "polygon", points: [[10.48, 7.18], [21.28, 7.18], [21.28, 11.58], [20.58, 11.58], [20.58, 22.53], [21.28, 22.53], [21.28, 26.43], [10.48, 26.43], [10.48, 19.18], [14.93, 19.18], [14.93, 15.93], [10.48, 15.93]], fill: "#d4b896", opacity: 0.95, stroke: "#7a5e3e", sw: 2.5 },
        { kind: "text", x: 18.03, y: 17.78, text: "DŮM", cls: "lbl", size: 20, weight: 700 },
        { kind: "text", x: 18.03, y: 19.06, text: "10.8 × 19.25 m", cls: "lbl" }
      ]
    },
    {
      id: "westTerrace",
      name: "Západní terasa: atrium a chodník šířky 1 m",
      short: "Západní terasa",
      parts: [
        { kind: "rect", x: 9.48, y: 7.18, w: 1, d: 19.25, fill: "#a87d4a", opacity: 0.55, stroke: "#5a3e25", sw: 0.8 },
        { kind: "rect", x: 10.48, y: 15.93, w: 4.45, d: 3.25, fill: "#a87d4a", opacity: 0.55, stroke: "#5a3e25", sw: 0.8 },
        { kind: "text", x: 12.61, y: 17.33, text: "západní terasa", cls: "lbl-sm" },
        { kind: "text", x: 12.61, y: 18.11, text: "atrium + chodník 1 m", cls: "dim" }
      ]
    },
    {
      id: "eastTerrace",
      name: "Východní terasa 3 × 7,82 m",
      parts: [
        { kind: "rect", x: 20.58, y: 11.58, w: 3, d: 7.82, fill: "#a87d4a", opacity: 0.78, stroke: "#5a3e25", sw: 1.2 },
        { kind: "text", x: 22.08, y: 16.39, text: "východní terasa", cls: "lbl-w" },
        { kind: "text", x: 22.08, y: 17.28, text: "(E.02)", cls: "lbl-sm-w" },
        { kind: "text", x: 22.08, y: 17.6, text: "3 × 7.82 m", cls: "dim", fill: "#fff" }
      ]
    },
    {
      id: "saunaPath",
      name: "Bezbariérové propojení domu a sauny",
      parts: [
        {kind: "rect", role: "saunaLanding", x: 2.3, y: 5, w: 7, d: 1.2, fill: "#cdc1ad", opacity: 0.7},
        {kind: "rect", x: 9.3, y: 5.2, w: 1.18, d: 1, fill: "#cdc1ad", opacity: 0.7},
        {kind: "rect", x: 9.48, y: 5.7, w: 1, d: 1.48, fill: "#cdc1ad", opacity: 0.7}
      ]
    },
    {
      id: "carport",
      name: "Přístřešek pro auta 6,35 × 7,05 m",
      fixed: true,
      parts: [
        { kind: "rect", x: 21.28, y: 19.4, w: 6.35, d: 7.05, fill: "#bdbdbd", opacity: 0.5, stroke: "#888", sw: 1.2, dash: "4,3" },
        { kind: "text", x: 24.44, y: 23, text: "přístřešek", cls: "lbl-sm" },
        { kind: "text", x: 24.44, y: 24.33, text: "6.35 × 7.05 m", cls: "dim" }
      ]
    },
    {
      id: "garage",
      name: "Garáž 6,50 × 7,05 m",
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
        { kind: "text", x: 30.88, y: 22.67, text: "GARÁŽ", cls: "lbl-w", size: 14, weight: 700 },
        { kind: "text", x: 30.88, y: 23.67, text: "6.50 × 7.05 m", cls: "dim", fill: "#fff" }
      ]
    },
    {
      id: "driveway",
      name: "Příjezd a parkování",
      meta: {apron: {x: 21.28, y: 26.43, w: 12.85, d: 4}},
      parts: [
        { kind: "polygon", points: [[21.28,19.4],[27.63,19.4],[27.63,26.43],[34.13,26.43],[43.070913189862225,28.47633723662397],[42.62589441523663,32.451504942549185],[34.13,30.43],[21.28,30.43]], fill: "#cccccc", opacity: 0.55 },
        { kind: "text", x: 30.83, y: 28.33, text: "příjezd", cls: "lbl-sm" },
        { kind: "text", x: 30.83, y: 29.17, text: "rovina / sjezd k bráně", cls: "dim" }
      ]
    },
    {
      id: "gate",
      name: "Brána z tahokovu: světlá šířka 4 m",
      parts: [
        { kind: "line", x1: 43.070913189862225, y1: 28.47633723662397, x2: 42.62589441523663, y2: 32.451504942549185, stroke: "#3a3a3a", sw: 6, cap: "round" },
        { kind: "text", x: 43.7, y: 30, text: "BRÁNA", cls: "lbl-sm", weight: 700, anchor: "start" },
        { kind: "text", x: 43.7, y: 30.78, text: "průjezd 4,0 m", cls: "dim", anchor: "start" }
      ]
    },
    {
      id: "binStore",
      name: "Box na popelnice 1,41 × 0,82 m",
      short: "Popelnice",
      parts: [
        { kind: "rect", x: 40, y: 32.4, w: 0.82, d: 1.41, clipToPlot: true, fill: "#5a5e64", opacity: 0.92, stroke: "#33363a", sw: 1 },
        { kind: "text", x: 39.9, y: 33.3, text: "popelnice", cls: "lbl-sm", fill: "#333", anchor: "end" }
      ]
    },
    {
      id: "rainTank",
      name: "Podzemní dešťová nádrž 8–10 m³ dle C.3; poloha orientační",
      meta: {source: "Projekt C.3, str. 1: 2 m od východní stěny garáže; severojižní poloha a délka odměřeny z výkresu", positionApproximate: true, accessCover: {x:37.13,z:17.8}},
      parts: [
        { kind: "rect", x: 36.13, y: 17.2, w: 2, d: 2.5, fill: "#3a7ab8", opacity: 0.35, stroke: "#1f3a5f", sw: 1.5, dash: "4,3" },
        { kind: "text", x: 37.13, y: 18.25, text: "dešťová nádrž", cls: "lbl-sm", weight: 700 },
        { kind: "text", x: 37.13, y: 19, text: "8–10 m³ · orientačně", cls: "dim" }
      ]
    },
    {
      id: "waterSource",
      name: "Vodovodní šachta — poklop dle upřesnění vlastníka",
      parts: [
        {kind: "circle", cx: 41.25, cy: 23.45, r: .45, fill: "#444444", stroke: "#222222", sw: 1.2},
        {kind: "text", x: 41.25, y: 24.5, text: "vodovodní šachta", cls: "lbl-sm"}
      ]
    },

    {
      id: "pond",
      name: "Jezírko: půdorys 2,4 × 1,6 m",
      meta: {proposal:true},
      parts: [
        {kind: "ellipse", cx: 35.6, cy: 14, rx: 1.2, ry: .8, fill: "#3a7ab8", opacity: 0.65, stroke: "#5a4a30", sw: 1.5},
        {kind: "text", x: 35.6, y: 13.89, text: "jezírko", cls: "lbl-sm", fill: "#fff", weight: 700},
        {kind: "text", x: 35.6, y: 14.56, text: "2,4 × 1,6 m", cls: "dim", fill: "#fff"}
      ]
    },
    {
      id: "firePit",
      name: "Ohniště ø 1 m a mlatové posezení ø 4 m",
      meta: {grading: {level: 1.865, surfaceOffset: 0.092}},
      parts: [
        {kind: "circle", cx: 31.5, cy: 6.5, r: 2, fill: "none", stroke: "#8a7a5a", sw: 1, dash: "5, 4"},
        {kind: "circle", cx: 31.5, cy: 6.5, r: 0.5, fill: "#a75e36", opacity: 0.85, stroke: "#693e28", sw: 1},
        {kind: "circle", cx: 31.5, cy: 6.5, r: 0.496, fill: "#514d45", opacity: 0.9},
        {kind: "text", x: 31.5, y: 8.9, text: "ohniště ø 1 m · mlat ø 4 m", cls: "lbl-sm", fill: "#5a4828"}
      ]
    },
    {
      id: "northTrees",
      name: "Stromy u posezení",
      parts: [
        {kind: "circle", cx: 24.7, cy: 3.6, r: 0.5, canopyRadius: 2, fill: "#4d7a4d"},
        {kind: "circle", cx: 34.8, cy: 3.1, r: 0.5, canopyRadius: 2, fill: "#4d7a4d"},
        {kind: "circle", cx: 29.8, cy: 2.5, r: 0.5, canopyRadius: 1.7, fill: "#4d7a4d"},
        {kind: "circle", cx: 0.25, cy: 4.4, r: 0.5, canopyRadius: 1.2, form: "evergreen", fill: "#4d7a4d"},
        {kind: "circle", cx: .55, cy: 10.3, r: .5, canopyRadius: 1, form: "evergreen", fill: "#426544"},
        {kind: "circle", cx: .7, cy: 16.8, r: .5, canopyRadius: 1.1, form: "evergreen", fill: "#426544"},
        {kind: "circle", cx: .7, cy: 21.1, r: .5, canopyRadius: 1, form: "evergreen", fill: "#426544"},
        {kind: "circle", cx: 15, cy: 3.8, r: .5, canopyRadius: .9, form: "multistem", fill: "#567447"},
        {kind: "circle", cx: 14.6, cy: 1.5, r: .5, canopyRadius: 1, form: "evergreen", fill: "#426544"},
        {kind: "circle", cx: 2.8, cy: 18.2, r: 0.5, canopyRadius: 1.3, fill: "#4d7a4d"},
        {kind: "circle", cx: 6, cy: 20.8, r: 0.5, canopyRadius: 1.1, form:'multistem', fill: "#4d7a4d"}
      ]
    },
    {
      id: "eastTrees",
      name: "Stromy u jezírka",
      parts: [
        {kind: "circle", cx: 40.2, cy: 14, r: 0.5, canopyRadius: 1.8, fill: "#4d7a4d"},
        {kind: "circle", cx: 39.5, cy: 8, r: 0.5, canopyRadius: 1.5, form: "evergreen", fill: "#4d7a4d"},
        {kind: "circle", cx: 41, cy: 10.6, r: 0.5, canopyRadius: 1.3, fill: "#4d7a4d"}
      ]
    },
    {
      id: "sauna",
      name: "Sauna 4 × 3 m",
      parts: [
        {kind: "rect", x: 5.3, y: 2, w: 4, d: 3, fill: "#8b6f47", opacity: 0.9, stroke: "#5a3e25", sw: 1.2},
        {kind: "text", x: 7.3, y: 3.33, text: "SAUNA", cls: "lbl-w"},
        {kind: "text", x: 7.3, y: 4.22, text: "4 × 3 m", cls: "dim", fill: "#fff"}
      ]
    },
    {
      id: "saunaShelter",
      name: "Přístřešek nad vířivkou 3 × 3 m",
      parts: [
        {kind: "rect", x: 2.3, y: 2, w: 3, d: 3, fill: "#cdc1ad", opacity: 0.4, stroke: "#7a5e3e", sw: 1, dash: "4, 3"},
        {kind: "text", x: 3.8, y: 5.67, text: "přístřešek", cls: "lbl-sm", fill: "#5a4828"},
        {kind: "text", x: 3.8, y: 6.4, text: "3 × 3 m", cls: "dim"}
      ]
    },
    {
      id: "toolStore",
      name: "Box na nářadí a sekačku 1,905 × 1,09 m",
      short: "Nářadí",
      parts: [
        { kind: "rect", x: 0.25, y: 0.7, w: 1.905, d: 1.09, clipToPlot: true, fill: "#5a5e64", opacity: 0.92, stroke: "#33363a", sw: 1 },
        { kind: "text", x: 1.2, y: 1.4, text: "sekačka", cls: "lbl-sm", fill: "#fff" }
      ]
    },
    {
      id: "softub",
      name: "Vířivka Softub ø 1,8 m",
      parts: [
        {kind: "circle", cx: 3.8, cy: 3.5, r: 0.9, fill: "#5dade2", opacity: 0.7, stroke: "#1f618d", sw: 1.5},
        {kind: "text", x: 3.8, y: 3.72, text: "Softub", cls: "lbl-sm", weight: 700, fill: "#1f3a5f"}
      ]
    },
    {
      id: "pergola",
      name: "Pergola a gril 6 × 4 m",
      meta: {grading: {level: 1.915, blend: 1.2, fenceBankSlope: .65}},
      parts: [
        {kind: "rect", x: 22.42785414913, y: 1.68127450503, w: 6, d: 4, fill: "#c8a878", opacity: 0.55, stroke: "#7a5e3e", sw: 1.5, dash: "6, 3"},
        {kind: "rect", role: "paving", x: 22.62785414913, y: 1.88127450503, w: 5.6, d: 3.6, fill: "#d8d2c8", opacity: 0.9},
        {kind: "rect", role: "table", x: 24.24785414913, y: 3.13127450503, w: 2.4, d: 1.1, fill: "#d9d3c7"},
        {kind: "text", x: 25.42785414913, y: 3.54127450503, text: "pergola + gril", cls: "lbl"},
        {kind: "text", x: 25.42785414913, y: 4.28127450503, text: "6 × 4 m", cls: "dim"},
        {kind: "text", x: 25.42785414913, y: 5.18127450503, text: "společné posezení", cls: "lbl-sm", fill: "#5a4828"}
      ]
    },
    {
      id: "raisedBedsPad",
      name: "Užitková zahrada: plocha záhonů 4,2 × 6,2 m",
      meta: {grading: {level: 2.805, blend: 1, bankSlope: .48}},
      parts: [
        {kind: "rect", x: 1.4, y: 10.1, w: 4.2, d: 6.2, fill: "#c8c2b0", opacity: 0.55, stroke: "#9a9074", sw: 1}
      ]
    },
    {
      id: "raisedBed1",
      name: "Vyvýšený záhon 1 (1 × 2 m)",
      parts: [
        {kind: "rect", x: 2, y: 10.7, w: 1, d: 2, fill: "#7a5a3a", opacity: 0.78},
        {kind: "text", x: 2.5, y: 11.7, text: "záhon 1", cls: "lbl-sm-w", rotate: -90}
      ]
    },
    {
      id: "raisedBed2",
      name: "Vyvýšený záhon 2 (1 × 2 m)",
      parts: [
        {kind: "rect", x: 4, y: 10.7, w: 1, d: 2, fill: "#7a5a3a", opacity: 0.78},
        {kind: "text", x: 4.5, y: 11.7, text: "záhon 2", cls: "lbl-sm-w", rotate: -90}
      ]
    },
    {
      id: "raisedBed3",
      name: "Vyvýšený záhon 3 (1 × 2 m)",
      parts: [
        {kind: "rect", x: 2, y: 13.7, w: 1, d: 2, fill: "#7a5a3a", opacity: 0.78},
        {kind: "text", x: 2.5, y: 14.7, text: "záhon 3", cls: "lbl-sm-w", rotate: -90}
      ]
    },
    {
      id: "raisedBed4",
      name: "Vyvýšený záhon 4 (1 × 2 m)",
      parts: [
        {kind: "rect", x: 4, y: 13.7, w: 1, d: 2, fill: "#7a5a3a", opacity: 0.78},
        {kind: "text", x: 4.5, y: 14.7, text: "záhon 4", cls: "lbl-sm-w", rotate: -90},
        {kind: "text", x: 1.4, y: 16.7, text: "4× záhon 1 × 2 m, výška 0,6 m", cls: "dim", anchor: "start"}
      ]
    },
    {
      id: "screenWest",
      name: "Západní clona u sauny",
      meta: {screen: {h: 2}},
      parts: [
        {kind: "rect", x: 2.08, y: 2, w: 0.14, d: 3, fill: "#4a4a4e"}
      ]
    },
    {
      id: "screenSouth",
      name: "Severní clona u sauny",
      meta: {screen: {h: 2}},
      parts: [
        {kind: "rect", x: 2.3, y: 1.78, w: 7, d: 0.14, fill: "#4a4a4e"}
      ]
    },
    {
      id: "orchardMeadow",
      name: "Sad s loukou",
      meta: {plant: "meadow"},
      parts: [
        {kind: "polygon", points: [[1.5,23],[8.7,23],[8.7,29.6],[3.2,29.6],[3.2,27.5],[1.5,27.5]], fill: "#b5c98a", opacity: 0.35}
      ]
    },
    {
      id: "orchard",
      name: "Ovocné stromy",
      parts: [
        {kind: "circle", cx: 3, cy: 25, r: 0.5, canopyRadius: 1.7, fill: "#4d7a4d"},
        {kind: "circle", cx: 6.8, cy: 27, r: 0.5, canopyRadius: 1.7, fill: "#4d7a4d"},
        {kind: "circle", cx: 2, cy: 28.5, r: .5, canopyRadius: 1, fill: "#4d7a4d"},
        {kind: "circle", cx: 4.4, cy: 28.6, r: .5, canopyRadius: 1.1, fill: "#4d7a4d"}
      ]
    },
    {
      id: "greenhouse",
      name: "Skleník 2 × 2 m (návrh)",
      short: "Skleník",
      meta: {grading: {finishedLevel: 2.385}},
      parts: [
        {kind: "rect", x: 1.5, y: 7.1, w: 2, d: 2, clipToPlot: true, fill: "#cfe8ef", opacity: 0.8, stroke: "#5f93a8", sw: 1.2},
        {kind: "text", x: 2.5, y: 8.1, text: "skleník", cls: "lbl-sm", fill: "#245a6a", rotate: -90}
      ]
    },
    {
      id: "compost",
      name: "Kompostér 2 × 1 m",
      short: "Kompostér",
      parts: [
        {kind: "rect", x: -1.25, y: 0.7, w: 1, d: 2, clipToPlot: true, fill: "#6a4a2a", opacity: 0.6, stroke: "#4a3218", sw: 1},
        {kind: "text", x: -0.75, y: 1.85, text: "kompost", cls: "lbl-sm", fill: "#fff"}
      ]
    },






    {
      id: "atriumPots",
      name: "Nádoby v atriu: muchovník a stínomilná výsadba",
      short: "Nádoby v atriu",
      meta: { plant: "shrubs" },
      parts: [
        { kind: "circle", cx: 11.3, cy: 16.4, r: 0.35, fill: "#6a8e5a", opacity: 0.8 },
        { kind: "circle", cx: 13.6, cy: 16.5, r: 0.6, fill: "#6a8e5a", opacity: 0.8 },
        { kind: "circle", cx: 13.9, cy: 18.5, r: 0.35, fill: "#6a8e5a", opacity: 0.8 }
      ]
    },
    {
      id: "northPassage",
      name: "Průchod na severní a západní straně domu",
      short: "Severní průchod",
      meta: { circulation: true },
      parts: [
        { kind: "rect", x: 9.48, y: 5.53, w: 12.3, d: 1.2, fill: "#b4c69e", opacity: 0.15, stroke: "#6a7a3a", sw: 1, dash: "5,3" },
        { kind: "rect", x: 9.48, y: 5.53, w: 1.02, d: 1.65, fill: "#b4c69e", opacity: 0.15 },
        { kind: "text", cls: "lbl-sm", fill: "#3a5a28", x: 16, y: 6.3, text: "průchod: ponechat volný" }
      ]
    },


    {
      id: "facadeClimbers",
      name: "Popínavé rostliny na garáži a v atriu",
      short: "Popínavé rostliny",
      parts: [
        { kind: "rect", x: 34.86, y: 19.6, w: 0.25, d: 6.6, fill: "#5a8a4a", opacity: 0.85 },
        { kind: "rect", x: 10.7, y: 15.98, w: 3.9, d: 0.25, fill: "#5a8a4a", opacity: 0.85 },
        { kind: "rect", x: 10.7, y: 18.95, w: 3.9, d: 0.25, fill: "#5a8a4a", opacity: 0.85 }
      ]
    },
    {
      id: "zasivarna",
      name: "Červená lavička HAY Palissade",
      short: "Zašívárna",
      parts: [
        {kind: "rect", x: 31.66, y: 18.2, w: 1.28, d: 0.7, fill: "#91463e", stroke: "#8a2a1e", sw: 0.8},
        {kind: "text", x: 32.3, y: 17.95, text: "zašívárna", cls: "lbl-sm", fill: "#8a2a1e"}
      ]
    },

    {
      id: "pathLights",
      name: "Sloupkové osvětlení cest",
      short: "Osvětlení cest",
      meta: { light: "bollard" },
      parts: [
        { kind: "circle", cx: 8, cy: 6.8, r: 0.18, route: "Wellness access", fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 7.7, cy: 14.2, r: 0.18, route: "Productive access", fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 7.7, cy: 20.1, r: 0.18, route: "Quiet garden approach", fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 23.1, cy: 10.5, r: 0.18, route: "Daily dining", fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 28, cy: 16.6, r: 0.18, route: "Pond walk", fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 35.9, cy: 23, r: 0.18, route: "Service connection", fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 }
      ]
    },
    {
      id: "gardenSpots",
      name: "Bodové osvětlení stromů a jezírka",
      short: "Bodová světla",
      meta: { light: "spot" },
      parts: [
        { kind: "circle", cx: 9, cy: 27, r: 0.22, target: [6.8, 27], fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 9, cy: 27, r: 0.07, fill: "#8a6a1a" },
        { kind: "circle", cx: 30.4, cy: 14, r: 0.22, target: [34.8, 14], fill: "#ffd54a", stroke: "#8a6a1a", sw: 0.8 },
        { kind: "circle", cx: 30.4, cy: 14, r: 0.07, fill: "#8a6a1a" }
      ]
    }
  ]
};

if (typeof module !== "undefined") module.exports = { GARDEN };
