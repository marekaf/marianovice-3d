// DWG coords: x 0..10800 (W→E), y 0..19250 (S→N). Mapping here: x_local = x/1000,
// z_local = 19.25 − y/1000 (so z → south, matching the plot convention).
// Coordinates: house-local meters. Origin = NW EXTERIOR corner (plot 10.48, 7.18).
// Walls: a/b are the wall rectangle's min/max corners (x0,z0)-(x1,z1).
// Openings: at = metres from the wall's min corner along its axis; no sill = floor-to-lintel.
const HOUSE_INTERIOR = {
  wallLayerModel:'project250-200',
  originPlot: { x: 10.48, z: 7.18 },
  clearH: 2.52,
  outline: [[0, 0], [10.8, 0], [10.8, 4.4], [10.1, 4.4], [10.1, 15.35], [10.8, 15.35], [10.8, 19.25], [0, 19.25], [0, 11.99], [4.45, 11.99], [4.45, 8.75], [0, 8.75]],
  rooms: [
    { id: '1.01', name: 'Zádveří',        x0: 4.70, z0: 13.05, x1: 9.65,  z1: 15.55, area: 10.5 },
    { id: '1.02', name: 'Tech. místnost', x0: 7.35, z0: 15.80, x1: 10.35, z1: 18.80, area: 9.0 },
    { id: '1.03', name: 'Koupelna',       x0: 5.90, z0: 15.80, x1: 7.20,  z1: 18.80, area: 5.7 },
    { id: '1.04', name: 'Pokoj pro hosty',x0: 0.45, z0: 15.80, x1: 4.45,  z1: 18.80, area: 13.7 },
    { id: '1.05', name: 'Pracovna',       x0: 0.45, z0: 12.45, x1: 4.45,  z1: 15.55, area: 12.7 },
    { id: '1.06', name: 'Obývací pokoj + KK', x0: 4.70, z0: 4.20, x1: 9.65, z1: 12.80, area: 44.1, ceil: 'open' },
    { id: '1.07', name: 'Spíž',           x0: 3.40, z0: 3.55,  x1: 4.45,  z1: 5.35, area: 1.9, ceil: 'open' }, // ceiling comes from 1.08's slab above (rects overlap)
    { id: '1.08', name: 'Pracovna',       x0: 0.45, z0: 4.30,  x1: 4.45,  z1: 8.30, area: 13.9 },
    { id: '1.09', name: 'Chodba',         x0: 3.40, z0: 2.30,  x1: 5.70,  z1: 3.45, area: 2.3 },
    { id: '1.10', name: 'Koupelna',       x0: 0.45, z0: 0.45,  x1: 3.25,  z1: 3.95, area: 9.7 },
    { id: '1.11', name: 'Šatna',          x0: 3.40, z0: 0.45,  x1: 5.70,  z1: 2.15, area: 3.9 },
    { id: '1.12', name: 'Ložnice',        x0: 5.85, z0: 0.45,  x1: 10.35, z1: 3.95, area: 15.7 },
    { id: 'nook', name: '', x0: 4.70, z0: 3.55, x1: 5.70, z1: 4.20, noLabel: true },
    { id: 'nika', name: '', x0: 4.10, z0: 7.10, x1: 4.70, z1: 8.30, noLabel: true },  // coffee-nika pocket in 1.08, open to 1.06
    { id: 'chod04', name: '', x0: 4.45, z0: 15.80, x1: 5.75, z1: 17.00, noLabel: true },
    { id: 'sprcha', name: '', x0: 4.70, z0: 17.15, x1: 5.90, z1: 18.65, noLabel: true },
  ],
  extWalls: [
    { id: 'W1', face: 'N', a: [0, 0],      b: [10.8, 0.45],
      openings: [{ at: 4.14, w: 0.82, h: 2.27 }] },                                  // O6 fixed, šatna
    { id: 'W2', face: 'S', a: [0, 18.80],  b: [10.8, 19.25],
      openings: [{ at: 5.79, w: 0.82, h: 1.25, sill: 1.02 }, { at: 8.04, w: 0.82, h: 1.25, sill: 1.02 }] }, // O1 (1.03 shower), O1 (1.02)
    { id: 'W3', face: 'W', a: [0, 0.45],   b: [0.45, 8.75],
      openings: [{ at: 1.04, w: 1.17, h: 2.27 }, { at: 5.29, w: 1.52, h: 2.27 }] },  // O2b (1.10), O3b (1.08)
    { id: 'W4', face: 'W', a: [0, 11.99],  b: [0.45, 18.80],
      openings: [{ at: 1.50, w: 1.52, h: 2.27 }, { at: 4.60, w: 1.17, h: 2.27 }] },  // O3a (1.05), O2a (1.04)
    { id: 'W5', face: 'court', a: [0.45, 8.30], b: [4.70, 8.75], openings: [] },
    { id: 'W6', face: 'court', a: [0.45, 11.99], b: [4.70, 12.45], openings: [] },
    { id: 'W7', face: 'court', a: [4.45, 8.75], b: [4.70, 12.00],
      openings: [{ at: 0.00, w: 3.25, h: 2.27, door: true }] },                                  // HS1 portal living ↔ atrium
    { id: 'W8', face: 'E', a: [10.35, 0.45], b: [10.8, 4.40],
      openings: [{ at: 0.79, w: 1.92, h: 2.27 }] },                                  // ložnice east glazing
    { id: 'W9', face: 'E', a: [9.65, 4.20], b: [10.1, 15.35],
      openings: [
        { at: 0.39, w: 2.30, h: 1.41, sill: 0.86 },                                  // kitchen window (O5), z 4.59–6.89
        { at: 2.80, w: 5.16, h: 2.27, door: true },                                              // HS2 portal, z 7.00–12.16
        { at: 9.77, w: 1.38, h: 2.27, door: true },                                              // D1 entrance, z 13.97–15.35
      ] },
    { id: 'W10', face: 'E', a: [10.35, 15.35], b: [10.8, 18.80], openings: [] },
    { id: 'W11', face: 'court', a: [10.1, 3.95], b: [10.35, 4.40], openings: [] },                       // notch north return wall
  ],
  intWalls: [
    { id: 'W12', a: [3.25, 0.45], b: [3.40, 3.95], openings: [{ at: 2.00, w: 0.80, h: 2.10 }] },   // 1.10 | šatna col, D09 z 2.45–3.25
    { id: 'W13', a: [5.70, 0.45], b: [5.85, 4.20], openings: [{ at: 2.05, w: 0.90, h: 2.10 }] },   // col | 1.12, D11 z 2.50–3.40
    { id: 'W14', a: [3.40, 2.15], b: [5.70, 2.30], openings: [{ at: 0.75, w: 0.80, h: 2.10 }] },   // 1.11 | 1.09, D10 x 4.15–4.95
    { id: 'W15', a: [3.40, 3.45], b: [5.70, 3.55], openings: [{ at: 1.35, w: 0.90, h: 2.10 }] },   // 1.09 south, D08 x 4.75–5.65
    { id: 'W16', a: [0.45, 3.95], b: [3.25, 4.30], openings: [] },                                  // row wall west (350)
    { id: 'W17', a: [5.85, 3.95], b: [10.10, 4.20], openings: [] },                                  // kitchen back wall (250)
    { id: 'W18', a: [5.70, 4.20], b: [5.85, 4.80], block: true, openings: [] },                       // pillar stub at the kitchen run's west end
    { id: 'W19', a: [3.25, 3.95], b: [3.40, 5.50], openings: [] },                                  // spíž west
    { id: 'W20', a: [3.40, 5.35], b: [4.45, 5.50], openings: [] },                                  // spíž south
    { id: 'W21', a: [4.45, 3.55], b: [4.70, 5.675], openings: [{ at: 0.50, w: 0.80, h: 2.10 }] },  // spíž east, D07 z 4.05–4.85
    { id: 'W22', a: [4.45, 5.675], b: [4.70, 7.10], openings: [{ at: 0.175, w: 0.90, h: 2.10 }] }, // D06 z 5.85–6.75
    { id: 'W23', a: [3.95, 7.10], b: [4.10, 8.30], openings: [] },                                 // nika casing, back
    { id: 'W23b', a: [3.95, 6.95], b: [4.45, 7.10], openings: [] },                                // nika casing, north band
    { id: 'W24', a: [4.70, 12.80], b: [5.70, 13.05], openings: [{ at: 0.00, w: 1.00, h: 2.20 }] }, // D05 passage under the průvlak
    { id: 'W25', a: [5.70, 12.80], b: [9.65, 13.05], openings: [] },
    { id: 'W26', a: [4.45, 12.45], b: [4.70, 15.55], openings: [{ at: 1.20, w: 0.90, h: 2.10 }] }, // D04 z 13.65–14.55
    { id: 'W27', a: [0.45, 15.55], b: [9.65, 15.80],
      openings: [{ at: 4.35, w: 0.90, h: 2.10 }, { at: 5.50, w: 0.90, h: 2.10 }, { at: 7.60, w: 0.90, h: 2.10 }] }, // D03, D02, D01
    { id: 'W28', a: [9.65, 15.35], b: [10.35, 15.80], openings: [] },                              // zádveří NE corner block
    { id: 'W29', a: [4.45, 17.00], b: [4.70, 18.80], openings: [] },
    { id: 'W30', a: [5.75, 15.80], b: [5.90, 17.15], openings: [] },                                // corridor | 1.03
    { id: 'W31', a: [4.70, 17.00], b: [5.75, 17.15], openings: [] },                                // shower niche north wall
    { id: 'W32', a: [4.70, 18.65], b: [5.90, 18.80], openings: [] },                                // shower niche south wall (předstěna)
    { id: 'W33', a: [0.45, 0.45], b: [0.60, 1.45], block: true, openings: [] },                                  // 1.10 installation wall (předstěna)
    { id: 'W34', a: [7.20, 15.80], b: [7.35, 18.80], openings: [] },                                // 1.03 | 1.02
  ],
  fireplace: { x0: 5.80, z0: 12.20, x1: 6.65, z1: 12.80 },  // Hoxter BLOX H60 insert + chimney casing
  stairs: { x0: 5.70, z0: 13.05, x1: 8.43, z1: 13.95, steps: 13, rise: 0.19429, toward: 'E' },  // 14 stupňů (DWG label) → rise 2.72/14; the 14th rise is the loft floor edge
  // Ceiling = one continuous lid (the loft floor plate) RESTING ON the walls — walls stop at
  // clearH, the plate spans the whole outline above them. Holes: stairwell, V1 vlez (chodba,
  // A-NADREZ rectangle), and the cathedral over the living + kitchen.
  lid: { holes: [
    { x0: 5.70, z0: 12.88, x1: 8.43, z1: 13.95 },  // stairwell — opening runs to the gallery wall
    { x0: 4.10, z0: 2.45, x1: 5.10, z1: 3.15 },    // V1 půdní vlez 1000×700
    { x0: 4.70, z0: 7.00, x1: 9.65, z1: 12.80 },   // cathedral — 2.03 attic floor ends at z 7.00, kitchen is under it
  ] },
  hatch: { x0: 4.10, z0: 2.45, x1: 5.10, z1: 3.15 },  // vlez lid with the loft ladder
  furniture: [
    //    Run anchored W18 east face x5.85 → W9 face x9.65 (3.80 real vs 4000 drawn; carcase
    //    3708 + the drawing's ±100 'prazdne' absorbs it).
    { kind: 'cab', room: '1.06', label: 'kuchyň tall lednice/mrazák 19+670', x0: 5.85, z0: 4.20, x1: 6.539, z1: 4.80, h: 2.50, plinth: 0.10, front: 'S', modules: [0.019, 0.67], tags: ['f', 'd'], fmat: 'green' },
    { kind: 'cab', room: '1.06', label: 'kuchyň base run 5×600 (úložný/odpad/myčka/trouba/úložný)', x0: 6.539, z0: 4.20, x1: 9.558, z1: 4.80, h: 0.91, plinth: 0.10, front: 'S', modules: [0.6, 0.6, 0.6, 0.6, 0.6, 0.019], tags: ['d', 'd', 'd', 'd', 'd', 'f'], fmat: 'green', wmat: 'stone', worktop: { th: 0.038, x0: 6.539, z0: 4.20, x1: 9.65, z1: 4.84 } },  // worktop wall-to-wall over the 92 mm void (stavební výstupek zone)
    { kind: 'cab', room: '1.06', label: 'kuchyň uppers 1050', x0: 6.539, z0: 4.20, x1: 9.65, z1: 4.55, y0: 1.45, h: 1.05, front: 'S', modules: [0.622, 0.622, 0.622, 0.622, 0.623], tags: ['d', 'd', 'd', 'd', 'd'], fmat: 'green' },  // digestor hides behind a green front (vestavěný)
    { kind: 'slab', room: '1.06', label: 'dřez Blanco PLEON 5', mat: 'appliance', x0: 7.18, z0: 4.35, x1: 7.70, z1: 4.72, y0: 0.948, h: 0.005 },
    { kind: 'slab', room: '1.06', label: 'varná deska Siemens', mat: 'appliance', x0: 8.36, z0: 4.32, x1: 8.92, z1: 4.75, y0: 0.948, h: 0.005 },
    { kind: 'cab', room: '1.06', label: 'kuchyň L-leg 2×960 (W9)', x0: 9.05, z0: 4.88, x1: 9.65, z1: 6.80, h: 0.91, plinth: 0.10, front: 'W', modules: [0.96, 0.96], tags: ['d', 'd'], fmat: 'green', wmat: 'stone', worktop: { th: 0.038, x0: 9.03, z0: 4.84, x1: 9.65, z1: 6.82 } },
    // Corner fillers at the O5 window: the drawing's 'prazdne' zones (92 mm run-end void +
    //    80 mm L-leg filler) are closed with panels IRL — no open slits under the worktop
    { kind: 'cab', room: '1.06', label: 'kuchyň roh filler E', x0: 9.558, z0: 4.20, x1: 9.65, z1: 4.80, h: 0.91, plinth: 0.10, front: 'S', modules: [0.092], tags: ['f'], cmat: 'green' },
    { kind: 'cab', room: '1.06', label: 'kuchyň roh filler S', x0: 9.05, z0: 4.80, x1: 9.65, z1: 4.88, h: 0.91, plinth: 0.10, front: 'W', modules: [0.08], tags: ['f'], cmat: 'green' },
    { kind: 'cab', room: '1.06', label: 'ostrov 2×960', x0: 6.01, z0: 5.95, x1: 8.01, z1: 6.55, h: 0.91, plinth: 0.10, front: 'N', modules: [0.02, 0.96, 0.96, 0.06], tags: ['f', 'd', 'd', 'f'], fmat: 'green', wmat: 'stone', cmat: 'green', worktop: { th: 0.038, x0: 5.99, z0: 5.93, x1: 8.03, z1: 6.85 } },
    { kind: 'cab', room: 'nika', label: 'nika base', x0: 4.10, z0: 7.10, x1: 4.70, z1: 8.30, h: 0.91, plinth: 0.10, front: 'E', modules: [0.6, 0.6], tags: ['d', 'd'], fmat: 'green', wmat: 'stone', worktop: 0.038 },
    { kind: 'slab', room: 'nika', label: 'nika back panel', mat: 'carc', x0: 4.10, z0: 7.10, x1: 4.125, z1: 8.30, y0: 0.948, h: 0.54 },
    { kind: 'cab', room: 'nika', label: 'nika uppers', x0: 4.10, z0: 7.10, x1: 4.70, z1: 8.30, y0: 1.488, h: 1.012, front: 'E', modules: [0.6, 0.6], tags: ['d', 'd'], fmat: 'green' },
    { kind: 'cab', room: '1.06', label: 'TV stolek 4×650', x0: 7.05, z0: 12.38, x1: 9.65, z1: 12.80, h: 0.42, front: 'N', modules: [0.65, 0.65, 0.65, 0.65], tags: ['d', 'd', 'd', 'd'] },
    { kind: 'slab', room: '1.06', label: 'TV', mat: 'appliance', x0: 7.62, z0: 12.75, x1: 9.08, z1: 12.80, y0: 0.72, h: 0.82 },
    { kind: 'bed', room: '1.12', label: 'CORONA 2100×2130', x0: 6.47, z0: 0.45, x1: 8.57, z1: 2.58, h: 0.68 },
    { kind: 'slab', room: '1.12', label: 'noční stolek W', mat: 'wood', x0: 5.87, z0: 0.45, x1: 6.47, z1: 0.85, y0: 0.15, h: 0.35 },
    { kind: 'slab', room: '1.12', label: 'noční stolek E', mat: 'wood', x0: 8.57, z0: 0.45, x1: 9.17, z1: 0.85, y0: 0.15, h: 0.35 },
    { kind: 'cab', room: '1.12', label: 'okno skříň N', x0: 9.95, z0: 0.45, x1: 10.35, z1: 1.22, h: 2.50, front: 'W', modules: [0.77], tags: ['d'], fmat: 'carc', handle: 'push' },
    { kind: 'cab', room: '1.12', label: 'okno skříň S', x0: 9.95, z0: 3.18, x1: 10.35, z1: 3.95, h: 2.50, front: 'W', modules: [0.77], tags: ['d'], fmat: 'carc', handle: 'push' },
    { kind: 'cab', room: '1.12', label: 'okenní lavice 2×940', x0: 9.95, z0: 1.22, x1: 10.35, z1: 3.18, h: 0.42, front: 'W', modules: [0.98, 0.98], tags: ['d', 'd'], fmat: 'carc', handle: 'push' },
    { kind: 'slab', room: '1.12', label: 'lavice polstr', mat: 'mattress', x0: 9.97, z0: 1.24, x1: 10.33, z1: 3.16, y0: 0.42, h: 0.06 },
    { kind: 'cab', room: '1.12', label: 'okno horní pás', x0: 9.95, z0: 1.22, x1: 10.35, z1: 3.18, y0: 2.27, h: 0.23, front: 'W', modules: [1.96], tags: ['f'], cmat: 'carc' },
    { kind: 'cab', room: '1.11', label: 'šatna skříň W', x0: 3.40, z0: 0.45, x1: 4.00, z1: 2.15, h: 2.52, front: 'E', modules: [0.85, 0.85], tags: ['o', 'o'], cmat: 'whiteBoard' },
    { kind: 'cab', room: '1.11', label: 'šatna skříň E', x0: 5.10, z0: 0.45, x1: 5.70, z1: 2.15, h: 2.52, front: 'W', modules: [0.85, 0.85], tags: ['o', 'o'], cmat: 'whiteBoard' },
    { kind: 'cab', room: '1.02', label: 'technická base 800+610+610', x0: 7.35, z0: 16.744, x1: 7.95, z1: 18.80, h: 0.90, plinth: 0.10, front: 'E', modules: [0.628, 0.628, 0.80], tags: ['a', 'a', 'd'], worktop: 0.038 },
    { kind: 'cab', room: '1.02', label: 'technická tall 926', x0: 7.35, z0: 15.80, x1: 7.95, z1: 16.726, h: 2.50, front: 'E', modules: [0.926], tags: ['d'] },
    { kind: 'slab', room: '1.01', label: 'vstup front nízký', mat: 'front', x0: 6.30, z0: 13.95, x1: 6.90, z1: 13.97, h: 0.52 },
    { kind: 'slab', room: '1.01', label: 'vstup front střední', mat: 'front', x0: 6.90, z0: 13.95, x1: 7.60, z1: 13.97, h: 1.08 },
    { kind: 'slab', room: '1.01', label: 'vstup front vysoký', mat: 'front', x0: 7.60, z0: 13.95, x1: 8.43, z1: 13.97, h: 1.70 },
    { kind: 'cab', room: '1.01', label: 'vstup skříň 470+750', x0: 8.43, z0: 13.05, x1: 9.65, z1: 13.65, h: 2.50, front: 'S', modules: [0.47, 0.75], tags: ['d', 'd'] },
    { kind: 'slab', room: '1.01', label: 'zrcadlo vstup', mat: 'mirror', x0: 8.95, z0: 13.663, x1: 9.55, z1: 13.683, y0: 0.40, h: 1.50 },
    { kind: 'glass', room: '1.10', label: 'walk-in 980 (1.10)', x0: 0.60, z0: 1.43, x1: 1.58, z1: 1.47, h: 2.00 },  // E–W on the shower's south line, anchored to the předstěna; entry from the east
    { kind: 'fix', type: 'bath', room: '1.10', label: 'vana Ravak FREEDOM W', x0: 2.35, z0: 0.55, x1: 3.15, z1: 2.21, h: 0.58 },
    { kind: 'fix', type: 'wc', room: '1.10', label: 'WC 1.10', x0: 0.90, z0: 3.42, x1: 1.27, z1: 3.95, y0: 0.25, h: 0.17 },
    { kind: 'cab', room: '1.10', label: 'umyvadlová skříň 1650', x0: 1.35, z0: 3.47, x1: 3.00, z1: 3.95, y0: 0.30, h: 0.50, front: 'N', modules: [0.825, 0.825], tags: ['d', 'd'], drawerRows: [.25, .25], handle: 'gola-c', worktop: 0.038 },
    { kind: 'fix', type: 'basin', room: '1.10', label: 'umyvadlo Vitra Geo', x0: 1.90, z0: 3.50, x1: 2.45, z1: 3.90, y0: 0.838, h: 0.13, tap: {mount:'wall',wall:'S',wallAt:3.95,height:1.05,reach:.23} },
    { kind: 'slab', room: '1.10', label: 'zrcadlo 1.10', mat: 'mirror', x0: 1.375, z0: 3.92, x1: 2.975, z1: 3.94, y0: 1.20, h: 0.80 },
    { kind: 'glass', room: 'sprcha', label: 'walk-in 800 (sprcha)', x0: 5.86, z0: 17.85, x1: 5.90, z1: 18.65, h: 2.00 },  // across the niche mouth, anchored to W32; entry from the north
    { kind: 'cab', room: '1.03', label: 'umyvadlová skříň', x0: 6.70, z0: 17.025, x1: 7.20, z1: 18.025, y0: 0.30, h: 0.50, front: 'W', modules: [1], tags: ['d'], drawerRows: [.25, .25], handle: 'gola-c', worktop: 0.038 },
    { kind: 'fix', type: 'basin', room: '1.03', label: 'umyvadlo 1.03', x0: 6.75, z0: 17.25, x1: 7.15, z1: 17.80, y0: 0.838, h: 0.13, tap: {mount:'wall',wall:'E',wallAt:7.20,height:1.05,reach:.23} },
    { kind: 'fix', type: 'wc', room: '1.03', label: 'WC 1.03', x0: 6.67, z0: 18.165, x1: 7.20, z1: 18.535, y0: 0.25, h: 0.17 },
    { kind: 'slab', room: '1.03', label: 'zrcadlo 1.03', mat: 'mirror', x0: 7.16, z0: 17.025, x1: 7.18, z1: 18.025, y0: 1.20, h: 0.80 },
    { kind: 'slab', room: '1.03', label: 'radiátor 1.03', mat: 'appliance', x0: 7.15, z0: 16.35, x1: 7.19, z1: 16.85, y0: 0.30, h: 1.20 },  // towel ladder north of the vanity
    { kind: 'cab', room: 'chod04', label: 'hosté L skříň — rameno na D', x0: 4.45, z0: 16.63, x1: 5.75, z1: 17.00, h: 2.50, front: 'N', modules: [0.65, 0.65], tags: ['d', 'd'], handle: 'push' },
    { kind: 'cab', room: '1.04', label: 'hosté L skříň — rameno na E', x0: 3.85, z0: 16.63, x1: 4.45, z1: 18.80, h: 2.50, front: 'W', modules: [0.5425, 0.5425, 0.5425, 0.5425], tags: ['d', 'd', 'd', 'd'], handle: 'push' },  // extends to the bar's face — the two legs share a full edge, one continuous L
    { kind: 'bed', room: '1.04', label: 'postel hosté 1800', x0: 1.10, z0: 16.75, x1: 2.90, z1: 18.75, h: 0.45, head: 'S' },
    { kind: 'slab', room: '1.04', label: 'noční stolek hosté W', mat: 'wood', x0: 0.50, z0: 18.35, x1: 1.10, z1: 18.75, y0: 0.15, h: 0.35, front: 'N' },
    { kind: 'slab', room: '1.04', label: 'noční stolek hosté E', mat: 'wood', x0: 2.90, z0: 18.35, x1: 3.50, z1: 18.75, y0: 0.15, h: 0.35, front: 'N' },
    { kind: 'slab', room: '1.04', label: 'TV sideboard hosté', mat: 'appliance', x0: 1.20, z0: 15.80, x1: 2.40, z1: 16.25, h: 0.45 },
    { kind: 'slab', room: '1.04', label: 'TV hosté', mat: 'appliance', x0: 1.40, z0: 15.805, x1: 2.20, z1: 15.855, y0: 0.75, h: 0.50 },
    { kind: 'cab', room: '1.07', label: 'spíž regál W', x0: 3.40, z0: 3.55, x1: 3.70, z1: 5.35, h: 2.10, front: 'E', modules: [1.80], tags: ['o'] },
    { kind: 'cab', room: '1.07', label: 'spíž regál N', x0: 3.70, z0: 3.55, x1: 4.45, z1: 3.85, h: 2.10, front: 'S', modules: [0.75], tags: ['o'] },
    { kind: 'cab', room: '1.07', label: 'spíž regál S', x0: 3.70, z0: 5.05, x1: 4.45, z1: 5.35, h: 2.10, front: 'N', modules: [0.75], tags: ['o'] },
  ],
};
const HOUSE_OPENINGS = {
  'W1:0': { kind: 'window', width: .9, height: 2.27, single: true },
  'W2:0': { kind: 'window', width: .9, height: 1.25, single: true, movingHalf: 'single', hinge: 'west', concealedHinges: true },
  'W2:1': { kind: 'window', width: .9, height: 1.25, single: true, movingHalf: 'single', hinge: 'west', concealedHinges: true },
  'W3:0': { kind: 'window', width: 1.25, height: 2.27, split: .63, movingHalf: 'north', hinge: 'north', lowThreshold:true },
  'W3:1': { kind: 'window', width: 1.6, height: 2.27, movingHalf: 'south', hinge: 'south', lowThreshold:true },
  'W4:0': { kind: 'window', width: 1.6, height: 2.27, movingHalf: 'north', hinge: 'north', lowThreshold:true },
  'W4:1': { kind: 'window', width: 1.25, height: 2.27, split: .37, movingHalf: 'south', hinge: 'south', lowThreshold:true },
  'W7:0': { kind: 'window', width: 3.29, height: 2.27, sliding: true, movingHalf: 'north' },
  'W8:0': { kind: 'window', width: 2, height: 1.75, sill:.395, split: .71, movingHalf: 'south', hinge: 'south', concealedHinges: true },
  'W9:0': { kind: 'window', width: 2.3, height: 1.35, split: .74, movingHalf: 'south', hinge: 'south', concealedHinges: true },
  'W9:1': { kind: 'window', width: 5.16, height: 2.27, sliding: true, movingHalf: 'north' },
  'W22:0': { kind: 'door', width: 1, height: 2.2, leafWidth: 0.8, leafHeight: 2.1, hinge: 'north' },
  'W26:0': { kind: 'door', width: 1, height: 2.2, leafWidth: 0.8, leafHeight: 2.1, hinge: 'north' },
  'W9:2': { kind: 'entrance', width: 1.425, height: 2.27, hinge: 'south', sidelight: 'north' },
};
for (const [key, spec] of Object.entries(HOUSE_OPENINGS)) {
  const [id, index] = key.split(':');
  const wall = [...HOUSE_INTERIOR.extWalls, ...HOUSE_INTERIOR.intWalls].find(w => w.id === id);
  const opening = wall.openings[Number(index)];
  opening.h = spec.height;
  if(spec.sill!==undefined)opening.sill=spec.sill;
  const alongX=wall.b[0]-wall.a[0]>wall.b[1]-wall.a[1],cross=alongX?1:0;
  opening.reveal = { width: spec.width,
    depth0: spec.kind === 'window' ? wall.a[cross] : wall.a[0],
    depth1: spec.kind === 'window' ? wall.b[cross] : wall.b[0] - 0.07 };
}

HOUSE_INTERIOR.buildOpening = function (wall, opening, index, { doorOpen = false, specification = null } = {}) {
  const internalDoors = { 'W12:0':'D09', 'W13:0':'D11', 'W14:0':'D10', 'W15:0':'D08', 'W21:0':'D07',
    'W27:0':'D03', 'W27:1':'D02', 'W27:2':'D01', 'P10:0':'loft-D01' };
  const key = `${wall.id}:${index}`, doorId = internalDoors[key];
  const fallback = doorId ? { kind:'door', doorId, width:opening.w, height:opening.h,
    leafWidth:opening.w-.1, leafHeight:opening.h-.1,
    hinge:wall.b[0]-wall.a[0]>wall.b[1]-wall.a[1]?'west':'north',
    provisional:true, bottomGap:key==='W27:2'?.002:.01, acousticThreshold:key==='W27:2',
    doorModel:key==='W27:2'?'Superior M10':'Elegant Komfort M10' } : null;
  const spec = specification||HOUSE_OPENINGS[key]||fallback;
  if (!spec) return null;
  if (spec.provisional) doorOpen = false;
  const parts = [], materials = {
    frame: { color: spec.provisional ? '#202526' : '#45494a', roughness: 0.38, metalness: 0.16 },
    seal: { color: '#202526', roughness: 0.82 },
    glass: { color: '#dce9e8', roughness: 0.015, transmission: 1 },
    door: { color: spec.kind === 'entrance' ? '#515657' : spec.provisional ? '#f4f2ee' : '#e8e1d6', roughness: 0.55 },
    casing: { color: spec.provisional ? '#f4f2ee' : '#e8e1d6', roughness: 0.65 },
    metal: { color: '#bac0c1', roughness: 0.25, metalness: 0.9 },
  };
  const alongX=wall.b[0]-wall.a[0]>wall.b[1]-wall.a[1];
  const cross=alongX?1:0,axis=alongX?0:1;
  const inward=wall.face==='E'||wall.face==='S'?-1:1;
  const center = wall.a[axis] + opening.at + opening.w / 2;
  const start = center - spec.width / 2, end = center + spec.width / 2;
  const sill = opening.sill || 0;
  const depth = spec.kind === 'window'||spec.provisional ? (wall.a[cross]+wall.b[cross])/2 : wall.a[0] + 0.08;
  const hingeAtStart = spec.hinge === 'north' || spec.hinge === 'west';
  const doorEdge = (spec.width - (spec.leafWidth ?? spec.width - .2)) / 2;
  const prefix = `opening_${wall.id}_${index}`;
  const addBox = (name, x, z, y, w, d, h, material, moving = false) => {
    let position = [x, z, y], size = [w, d, h];
    if(spec.kind==='window'){
      position[0]=depth+inward*(x-depth);
      if(alongX){position=[position[1],position[0],y];size=[d,w,h];}
    }
    if (moving && doorOpen) {
      const hinge = hingeAtStart ? start + doorEdge : end - (spec.kind === 'entrance' ? .06 : doorEdge);
      const direction = hingeAtStart ? 1 : -1;
      position = [depth - direction * (z - hinge), hinge + direction * (x - depth), y];
      size = [d, w, h];
    }
    if (spec.kind !== 'window' && alongX) { position = [position[1], position[0], y]; size = [size[1], size[0], h]; }
    parts.push({ name: `${prefix}_${name}`, type: 'box', position, size, material, category: 'openings', bevel: 0.0015 });
  };
  const rail = (name, a, b, bottom, top, material, thickness = 0.075, x = depth, moving = false) =>
    addBox(name, x, (a + b) / 2, (bottom + top) / 2, thickness, b - a, top - bottom, material, moving);
  const perimeter = (name, a, b, bottom, top, edge, material, thickness, x = depth, sillEdge=edge) => {
    rail(`${name}_north`, a, a + edge, bottom, top, material, thickness, x);
    rail(`${name}_south`, b - edge, b, bottom, top, material, thickness, x);
    rail(`${name}_head`, a + edge, b - edge, top - edge, top, material, thickness, x);
    rail(`${name}_sill`, a + edge, b - edge, bottom, bottom + sillEdge, material, thickness, x);
  };
  let leafWidth = spec.leafWidth, leafHeight = spec.leafHeight;
  if (spec.kind === 'window') {
    const edge=spec.sliding?.025:.06,divider=start+spec.width*(spec.split??.5),mullion=spec.sliding?.0125:.03;
    const bottomEdge=spec.lowThreshold?.02:edge;
    perimeter('frame', start, end, sill, sill + spec.height, edge, 'frame', spec.sliding?.14:.08,depth,bottomEdge);
    if(!spec.single)rail('mullion', divider-mullion, divider+mullion, sill+edge, sill+spec.height-edge, 'frame',spec.sliding?.12:.08);
    const innerEdge=spec.sliding?-mullion:mullion;
    const panes=spec.single?[['single',start+edge,end-edge]]:[['north',start+edge,divider-innerEdge],['south',divider+innerEdge,end-edge]];
    for (const [half, a, b] of panes) {
      const moving = half === spec.movingHalf;
      const border = spec.sliding?.009:moving ? 0.035 : 0.018;
      const paneDepth=depth+(spec.sliding?(moving?.035:-.025):.01);
      perimeter(`${half}_seal`, a, b, sill+bottomEdge, sill+spec.height-edge, border+.004, 'seal',.034,paneDepth);
      perimeter(`${half}_bead`, a+.003,b-.003,sill+bottomEdge+.003,sill+spec.height-edge-.003,
        border,'frame',moving?.06:.044,paneDepth);
      rail(`${half}_glass`,a+border+.006,b-border-.006,sill+bottomEdge+.006+border,
        sill+spec.height-edge-.006-border,'glass',.024,paneDepth);
      if (moving) {
        const latch = half === 'north'||spec.hinge==='west' ? b - 0.025 : a + 0.025;
        const hinge = half === 'north' ? a + 0.012 : b - 0.012;
        const handleHeight=Math.min(1.02,spec.height*.5);
        addBox('handle_plate',depth+.075,latch,sill+handleHeight,.016,.027,.075,'frame');
        addBox('handle_stem',depth+.098,latch,sill+handleHeight,.036,.014,.014,'frame');
        addBox('handle_grip',depth+.114,latch,sill+handleHeight-.043,.016,.016,spec.sliding?.22:.1,'frame');
        if(!spec.concealedHinges&&!spec.sliding)for (const [j, y] of [0.18,spec.height-.19].entries())
          addBox(`sash_hinge_${j}`, depth + 0.065, hinge, sill + y, 0.025, 0.028, 0.07, 'metal');
      }
    }
    if(spec.sliding)for(const offset of [-.035,.035])rail(`track_${offset}`,start+.025,end-.025,sill+.003,sill+.009,'metal',.012,depth+offset);
    else if(sill>0)rail('exterior_sill',start-.015,end+.015,sill-.025,sill-.006,'frame',.18,depth-.06);
  } else {
    const entrance = spec.kind === 'entrance', edge = entrance ? 0.06 : doorEdge;
    const frameMaterial = entrance ? 'frame' : 'casing';
    rail('jamb_north', start, start + edge, 0, spec.height, frameMaterial, entrance ? 0.085 : 0.14);
    rail('jamb_south', end - edge, end, 0, spec.height, frameMaterial, entrance ? 0.085 : 0.14);
    rail('head', start + edge, end - edge, spec.height - 0.08, spec.height, frameMaterial, 0.14);
    const leafStart = entrance ? start + spec.width * 0.28 + 0.03 : start + edge;
    const leafEnd = end - edge;
    leafWidth = leafEnd - leafStart;
    leafHeight = entrance ? spec.height - 0.095 : spec.leafHeight;
    if (entrance) {
      const mullion = start + spec.width * 0.28;
      rail('sidelight_mullion', mullion - 0.03, mullion + 0.03, 0.025, spec.height - 0.06, 'frame', 0.085);
      perimeter('sidelight_seal', start + edge, mullion - 0.03, 0.025, spec.height - 0.06, 0.013, 'seal', 0.034);
      rail('sidelight_glass', start + edge + 0.013, mullion - 0.043, 0.038, spec.height - 0.073, 'glass', 0.026);
      rail('threshold', start + edge, end - edge, 0, 0.02, 'metal', 0.095);
    }
    const bottom = spec.bottomGap ?? .01;
    rail('leaf', leafStart, leafEnd, bottom, bottom + leafHeight, 'door', entrance ? 0.075 : 0.042, depth, true);
    if (spec.acousticThreshold) rail('drop_seal', leafStart+.004, leafEnd-.004, 0, bottom, 'seal', .035, depth, true);
    const hinge = hingeAtStart ? leafStart : leafEnd;
    if (entrance) for (const [j, y] of [0.2, 1.05, 1.94].entries())
      addBox(`door_hinge_${j}`, depth - 0.025, hinge, y, 0.023, 0.025, 0.075, 'metal');
    if (!entrance) {
      rail('edge_north', leafStart, leafStart + 0.003, bottom, bottom + leafHeight, 'frame', 0.043, depth, true);
      rail('edge_south', leafEnd - 0.003, leafEnd, bottom, bottom + leafHeight, 'frame', 0.043, depth, true);
      rail('edge_top', leafStart + 0.003, leafEnd - 0.003, leafHeight + bottom-.003, leafHeight + bottom, 'frame', 0.043, depth, true);
      rail('edge_bottom', leafStart + 0.003, leafEnd - 0.003, bottom, bottom+.003, 'frame', 0.043, depth, true);
    }
    const latch = hingeAtStart ? leafEnd - 0.055 : leafStart + 0.055;
    for (const side of [-1, 1]) {
      const surface = entrance ? 0.044 : 0.027;
      if (entrance && side === 1) {
        for (const [j, y] of [0.89, 1.39].entries())
          addBox(`pull_mount_${j}`, depth + surface + 0.025, latch, y, 0.06, 0.025, 0.025, 'metal', true);
        addBox('exterior_pull', depth + surface + 0.053, latch, 1.14, 0.026, 0.026, 0.58, 'metal', true);
      } else {
        addBox(`escutcheon_${side}`, depth + side * surface, latch, 1.03, 0.012, 0.045, 0.045, 'metal', true);
        addBox(`lever_stem_${side}`, depth + side * (surface + 0.02), latch, 1.03, 0.04, 0.016, 0.016, 'metal', true);
        addBox(`lever_${side}`, depth + side * (surface + 0.038), latch + (hingeAtStart ? -0.045 : 0.045), 1.03,
          0.018, 0.115, 0.018, 'metal', true);
      }
      addBox(`keyhole_${side}`, depth + side * surface, latch, 0.94, 0.01, 0.027, 0.037, 'metal', true);
    }
  }
  return { name: prefix, floorHeight: 0, materials, parts, lights: [],
    opening: { ...spec, x: alongX?center:depth, z: alongX?depth:center, axis:alongX?'x':'z', center, sill, leafWidth, leafHeight, doorOpen: spec.kind !== 'window' && doorOpen,
      notes: ['Frame profiles and hardware dimensions are visualization approximations.',
        ...(spec.provisional ? ['Measured wall openings are preserved. Leaf size, hinge hand and hinged versus pocket assignment await the door schedule; this is a closed-door visualization, not a fabrication specification.'] : []),
        ...(spec.kind === 'window' ? ['Pane divisions are approximate proportions read from the interior-view supplier drawings.'] : []),
        ...(spec.kind === 'entrance' ? ['Sidelight division is approximately 28%; its exact width is not dimensioned.'] : [])] } };
};

HOUSE_INTERIOR.exteriorOpenings = function () {
  return this.extWalls.flatMap(wall=>wall.openings.flatMap((opening,index)=>{
    const model=this.buildOpening(wall,opening,index);
    if(!model)return [];
    const spec=model.opening,alongX=wall.b[0]-wall.a[0]>wall.b[1]-wall.a[1];
    const min=[wall.a[0]-.001,wall.a[1]-.001,opening.sill||0],max=[wall.b[0]+.001,wall.b[1]+.001,(opening.sill||0)+spec.height];
    const axis=alongX?0:1;
    min[axis]=spec.center-spec.width/2;max[axis]=spec.center+spec.width/2;
    return [{model,match:{kind:spec.kind==='entrance'?'door':'window',axis:alongX?'z':'x',
      wall:alongX?this.originPlot.z+wall.a[1]:this.originPlot.x+wall.a[0],center:spec.center+(alongX?this.originPlot.x:this.originPlot.z)},cutout:{min,max}}];
  }));
};

HOUSE_INTERIOR.exteriorInterior = function (exteriorWallHeight = this.clearH) {
  const layers=typeof module!=='undefined'?require('./house-wall-layers.js').HouseWallLayers:HouseWallLayers;
  const parts = [], terrainCutouts = [], materials = {
    ...layers.materials,
    wall: { color: '#dedbd3', roughness: 0.9 }, floor: { color: '#b29470', roughness: 0.7 },
    ceiling: { color: '#DED3C8', roughness: 0.95 },
  };
  const box = (name, x0, z0, y0, x1, z1, y1, material) => {
    if (x1 <= x0 || z1 <= z0 || y1 <= y0) return;
    parts.push({ name, type: 'box', position: [(x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2],
      size: [x1 - x0, z1 - z0, y1 - y0], material, category: 'structure' });
  };
  for (const room of this.rooms.filter(r => !r.noLabel)) {
    const pantryWall = this.intWalls.find(w => w.id === 'W19'), pantryBottom = this.intWalls.find(w => w.id === 'W20');
    const nicheWall = this.intWalls.find(w => w.id === 'W23'), nicheTop = this.intWalls.find(w => w.id === 'W23b');
    const regions = room.id === '1.08' ? [
      [room.x0, room.z0, pantryWall.a[0], room.z1],
      [pantryWall.a[0], pantryBottom.b[1], nicheWall.a[0], room.z1],
      [nicheWall.a[0], pantryBottom.b[1], room.x1, nicheTop.a[1]],
    ] : [[room.x0, room.z0, room.x1, room.z1]];
    for (const [i, [x0, z0, x1, z1]] of regions.entries()) {
      box(`backing_floor_${room.id}_${i}`, x0, z0, -0.06, x1, z1, 0, 'floor');
      if(room.ceil!=='open')box(`backing_ceiling_${room.id}_${i}`, x0, z0, this.clearH, x1, z1, this.clearH + 0.08, 'ceiling');
      terrainCutouts.push({ min: [x0, z0, -1], max: [x1, z1, this.clearH] });
    }
  }
  for (const wall of [...this.extWalls, ...this.intWalls]) {
    const height=this.extWalls.includes(wall)?exteriorWallHeight:this.clearH;
    const alongX = wall.b[0] - wall.a[0] > wall.b[1] - wall.a[1];
    const axis = alongX ? 0 : 1, length = wall.b[axis] - wall.a[axis];
    const min=wall.a.slice(),max=wall.b.slice();
    if(this.extWalls.includes(wall)){
      for(let i=0;i<this.outline.length;i++){
        const a=this.outline[i],b=this.outline[(i+1)%this.outline.length],cross=a[0]===b[0]?0:1,along=1-cross;
        if(Math.min(max[along],Math.max(a[along],b[along]))<=Math.max(min[along],Math.min(a[along],b[along])))continue;
        if(Math.abs(wall.a[cross]-a[cross])<1e-6)min[cross]+=.002;
        if(Math.abs(wall.b[cross]-a[cross])<1e-6)max[cross]-=.002;
      }
    }
    let cursor = 0, serial = 0;
    const segment = (a, b, y0, y1) => {
      const name=`backing_${wall.id}_${serial++}`,rect={
        x0:alongX?Math.max(min[0],wall.a[0]+a):min[0],z0:alongX?min[1]:Math.max(min[1],wall.a[1]+a),y0,
        x1:alongX?Math.min(max[0],wall.a[0]+b):max[0],z1:alongX?max[1]:Math.min(max[1],wall.a[1]+b),y1};
      if(rect.x1<=rect.x0||rect.z1<=rect.z0||y1<=y0)return;
      for(const [i,cell]of layers.split(this,wall,rect).entries()){
        if(cell.layer)parts.push(...layers.modelParts(`${name}_${cell.layer}_${i}`,cell,Math.abs(y1-height)<1e-8));
        else box(name,cell.x0,cell.z0,y0,cell.x1,cell.z1,y1,'wall');
      }
    };
    for (const o of wall.openings) {
      const width = o.reveal?.width || o.w, a = o.at + (o.w - width) / 2;
      segment(cursor, a, 0, height);
      segment(a, a + width, 0, o.sill || 0);
      segment(a, a + width, (o.sill || 0) + o.h, height);
      cursor = a + width;
    }
    segment(cursor, length, 0, height);
  }
  for (const [id, index] of [['W3', 1], ['W4', 0], ['W22', 0], ['W26', 0]]) {
    const wall = [...this.extWalls, ...this.intWalls].find(w => w.id === id), o = wall.openings[index];
    const model = this.buildOpening(wall, o, index);
    if (model.opening.kind === 'window') {
      const room = this.rooms.find(r => r.id === (id === 'W3' ? '1.08' : '1.05'));
      box(`backing_threshold_${id}`, wall.a[0], room.z0, -0.06, wall.b[0], room.z1, 0, 'floor');
      terrainCutouts.push({ min: [wall.a[0], room.z0, -1], max: [wall.b[0], room.z1, this.clearH] });
      const { z, width, height } = model.opening, a = z - width / 2, b = z + width / 2;
      box(`backing_reveal_north_${id}`, wall.a[0], a - 0.001, 0, wall.b[0], a + 0.008, height, 'wall');
      box(`backing_reveal_south_${id}`, wall.a[0], b - 0.008, 0, wall.b[0], b + 0.001, height, 'wall');
      box(`backing_reveal_head_${id}`, wall.a[0], a, height - 0.008, wall.b[0], b, height + 0.001, 'wall');
    } else {
      Object.assign(materials, model.materials);
      parts.push(...model.parts);
      const { z, width } = model.opening;
      box(`backing_door_floor_${id}`, wall.a[0], z - width / 2, -0.06, wall.b[0], z + width / 2, 0, 'floor');
      terrainCutouts.push({ min: [wall.a[0], z - width / 2, -1], max: [wall.b[0], z + width / 2, this.clearH] });
    }
  }
  for(const {model,cutout} of this.exteriorOpenings()){
    if(model.opening.kind!=='window'||['opening_W3_1','opening_W4_0'].includes(model.name))continue;
    const {min,max}=cutout,alongX=model.opening.axis==='x',t=.009;
    const edge=(name,a,b)=>box(`${model.name}_${name}`,...a,...b,'wall');
    if(alongX){
      edge('reveal_left',[min[0]-t,min[1],min[2]],[min[0]+t,max[1],max[2]]);
      edge('reveal_right',[max[0]-t,min[1],min[2]],[max[0]+t,max[1],max[2]]);
    }else{
      edge('reveal_left',[min[0],min[1]-t,min[2]],[max[0],min[1]+t,max[2]]);
      edge('reveal_right',[min[0],max[1]-t,min[2]],[max[0],max[1]+t,max[2]]);
    }
    edge('reveal_head',[min[0],min[1],max[2]-t],[max[0],max[1],max[2]+t]);
    edge('reveal_sill',[min[0],min[1],min[2]-.04],[max[0],max[1],min[2]]);
  }
  return { name: 'opening-room-backing', floorHeight: 0, materials, parts, lights: [], terrainCutouts };
};
HOUSE_INTERIOR.gableOpening = function (floor=2.72) {
  const wall={id:'gable',face:'N',a:[6.55,0],b:[7.3,.45]};
  const opening={at:0,w:.75,h:1,sill:floor+1.1};
  const model=this.buildOpening(wall,opening,0,{specification:{kind:'window',width:.75,height:1,single:true,movingHalf:'single',hinge:'east',concealedHinges:true}});
  model.materials.reveal={color:'#cfc8ba',roughness:.9};
  for(const [name,x,y,w,h] of [['west',6.55,opening.sill,.008,1],['east',7.292,opening.sill,.008,1],
    ['head',6.55,opening.sill+.992,.75,.008],['sill',6.55,opening.sill,.75,.008]])
    model.parts.push({name:`gable_reveal_${name}`,type:'box',position:[x+w/2,.225,y+h/2],size:[w,.45,h],material:'reveal',category:'openings'});
  return model;
};
HOUSE_INTERIOR.roofWindowModelUrl='./docs/house-roof-windows.js';

const HOUSE_LOFT = {
  originPlot: { x: 10.48, z: 7.18 },
  clearH: 2.27,
  outline: [[0, 0], [10.8, 0], [10.8, 4.4], [10.1, 4.4], [10.1, 15.35], [10.8, 15.35], [10.8, 19.25], [0, 19.25], [0, 11.99], [4.45, 11.99], [4.45, 8.75], [0, 8.75]],
  floorHoles: [
    { x0: 4.70, z0: 7.00, x1: 9.65, z1: 12.80 },   // cathedral void (gallery edge)
    { x0: 5.70, z0: 12.88, x1: 8.43, z1: 13.95 },  // stairwell — opening runs to the gallery wall
    { x0: 4.10, z0: 2.45, x1: 5.10, z1: 3.15 },    // V1 vlez
  ],
  entryRooms: ['2.01', '2.03'],  // reached from below: stairs into 2.01, vlez ladder into 2.03
  rooms: [
    { id: '2.03', name: 'Půdní sklad', x0: 3.60, z0: 0.45, x1: 9.55, z1: 6.75, area: 41.2 },
    { id: '2.01', name: 'Hala',        x0: 7.80, z0: 12.88, x1: 9.55, z1: 15.50, area: 4.1 },
    { id: '2.02', name: 'Pokoj',       x0: 3.60, z0: 15.65, x1: 9.55, z1: 18.80, area: 30.7 },
    { id: '2.02b', name: '', x0: 3.60, z0: 12.88, x1: 7.65, z1: 15.65, noLabel: true },  // 2.02's L-arm west of the hala
  ],
  extWalls: [
    { id: 'P1', face: 'N', a: [0, 0],     b: [10.8, 0.45], openings: [],
      profile: [[0, 0.11], [3.50, 0.17], [7.55, 4.23], [10.8, 0.98]],
      glazing: [{ x0: 6.55, x1: 7.30, sill: 1.10, h: 1.00 }] },   // O7 gable window
    { id: 'P2', face: 'S', a: [0, 18.80], b: [10.8, 19.25], openings: [],
      profile: [[0, 0.11], [3.50, 0.17], [7.55, 4.23], [10.8, 0.98]] },
    { id: 'P18', face: 'E', a: [10.7, 0.45], b: [10.8, 4.40], h: 0.98, openings: [] },   // east eave wall, north run
    { id: 'P19', face: 'E', a: [10.7, 15.35], b: [10.8, 18.80], h: 0.98, openings: [] }, // east eave wall, south run
    { id: 'P20', face: 'E', a: [10.0, 4.40], b: [10.1, 15.35], h: 1.68, openings: [] },  // east wall above the notch (up to the roof plane)
    { id: 'P21', face: 'E', a: [10.0, 4.30],  b: [10.7, 4.40],  profile: [[10.0, 1.78], [10.7, 1.08]], openings: [] },  // notch return wall (north), top follows the east slope
    { id: 'P22', face: 'E', a: [10.0, 15.35], b: [10.7, 15.45], profile: [[10.0, 1.78], [10.7, 1.08]], openings: [] }, // notch return wall (south), top follows the east slope
  ],
  intWalls: [
    { id: 'P3', a: [3.50, 0.45],  b: [3.60, 8.30],  h: 0.20, block: true, openings: [] },  // west upstand at the gable/lean-to junction
    { id: 'P4', a: [3.50, 12.45], b: [3.60, 18.80], h: 0.20, block: true, openings: [] },  // west upstand (south run)
    { id: 'P5', a: [9.55, 0.45],  b: [9.65, 7.00],  h: 2.10, block: true, openings: [] },  // east boundary wall (north run)
    { id: 'P7', a: [5.59, 6.75],  b: [9.55, 7.00],  profile: [[5.59, 2.27], [7.55, 4.23], [9.55, 2.23]], openings: [] },  // 2.03 south wall — up to the ridge
    { id: 'P8', a: [3.60, 6.75],  b: [5.59, 7.00],  profile: [[3.60, 0.27], [5.59, 2.27]], openings: [] },  // 2.03 south wall under the west slope
    { id: 'P9', a: [5.59, 12.80], b: [9.55, 12.88], profile: [[5.59, 2.27], [7.55, 4.23], [9.55, 2.23]], block: true, openings: [] },  // gallery wall — up to the ridge
    { id: 'P14', a: [3.60, 12.80], b: [5.59, 12.88], profile: [[3.60, 0.27], [5.59, 2.27]], block: true, openings: [] },  // gallery wall under the west slope
    { id: 'P15', a: [5.62, 12.88], b: [5.70, 13.95], h: 2.27, block: true, openings: [] },   // stairwell railing, west side
    { id: 'P16', a: [5.70, 13.95], b: [7.65, 14.03], h: 2.27, block: true, openings: [] },   // stairwell railing, south side
    { id: 'P10', a: [7.65, 13.95], b: [7.80, 15.65], h: 2.27, openings: [{ at: 0.25, w: 0.80, h: 1.97 }] }, // 2.01 west partition (south of the stair band), D01
    { id: 'P11', a: [7.80, 15.50], b: [9.55, 15.65], h: 2.27, openings: [] },  // 2.01 south partition
    { id: 'P12', a: [6.55, 15.50], b: [6.70, 15.65], h: 2.27, block: true, openings: [] },  // fire-cased JACKEL 100×100 post, in the P11 wall line
    { id: 'P13', a: [5.80, 12.20], b: [6.65, 12.80], h: 2.27, block: true, openings: [] },  // komín rising from the fireplace below
  ],
  slopes: [
    { x0: 3.50, x1: 5.59, z0: 0.45, z1: 7.00,  y0: 0.17, y1: 2.27 },  // west 45° slope, north run
    { x0: 3.50, x1: 5.59, z0: 12.80, z1: 18.80, y0: 0.17, y1: 2.27 }, // west 45° slope, south run
    { x0: 9.51, x1: 10.8, z0: 0.45, z1: 7.00,  y0: 2.27, y1: 0.98 },  // east 45° slope, north run — down to the eave
    { x0: 9.51, x1: 10.8, z0: 12.80, z1: 18.80, y0: 2.27, y1: 0.98 },// east 45° slope, south run — down to the eave
  ],
  ceilings: [
    { x0: 5.59, z0: 0.45, x1: 9.51, z1: 6.75 },   // flat SDK over 2.03
    { x0: 5.59, z0: 12.88, x1: 7.65, z1: 18.80 }, // flat SDK west of the hala partition
    { x0: 7.80, z0: 12.88, x1: 9.51, z1: 15.50 }, // flat SDK over 2.01
    { x0: 7.80, z0: 15.65, x1: 9.51, z1: 18.80 }, // flat SDK over 2.02 SE part
  ],
};
HOUSE_LOFT.buildOpening=function(wall,opening,index,options){return wall.id==='P1'?HOUSE_INTERIOR.gableOpening(0):HOUSE_INTERIOR.buildOpening(wall,opening,index,options);};
if (typeof module !== "undefined") module.exports = { HOUSE_INTERIOR, HOUSE_LOFT };
