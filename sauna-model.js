/* Coordinates are [east, south, height above the shared finished floor], in metres. */
const SaunaModel = (() => {
  function plantingClearances(garden) {
    return garden.elements.filter(e => ['sauna', 'saunaShelter', 'saunaPath'].includes(e.id))
      .flatMap(e => e.parts.filter(p => p.kind === 'rect').map(({ x, y, w, d }) => ({ x, y, w, d })));
  }
  function build(garden, floorHeight) {
    const rect = id => garden.elements.find(e => e.id === id).parts.find(p => p.kind === 'rect');
    const sauna = rect('sauna'), shelter = rect('saunaShelter');
    const tub = garden.elements.find(e => e.id === 'softub').parts.find(p => p.kind === 'circle');
    const { x, y, w, d } = sauna, sx = shelter.x, totalWidth = x + w - sx;
    const materials = {
      trim: { color: '#303638', roughness: 0.45, metalness: 0.55 },
      foundation: { color: '#696b65', roughness: 0.88 },
      glass: { color: '#f2f7f5', roughness: 0.025, transmission: 1 },
      water: { color: '#86b4b9', roughness: 0.15, transmission: 0.75 },
      tubOuter: { color: '#857568', roughness: 0.72 },
      tubInner: { color: '#c1c9c5', roughness: 0.32 },
      stone: { color: '#454845', roughness: 0.95 },
      seat: { color: '#72503b', roughness: 0.88 },
      light: { color: '#f6d5a1', roughness: 0.55, emissive: '#ffd49b', emissiveIntensity: 1.5 },
    };
    for (const axis of ['x', 'y', 'z']) {
      materials['timber_' + axis] = { color: '#c4a078', roughness: 0.7, grain: axis };
      materials['interior_' + axis] = { color: '#d4b58a', roughness: 0.65, grain: axis };
      for (let i = 0; i < 3; i++) materials[`cedar_${axis}_${i}`] = {
        color: ['#c7a77f', '#c9aa83', '#c5a57e'][i], roughness: 0.73,
      };
    }
    const parts = [], lights = [], privacyScreens = [];
    let category = 'floor';
    const box = (name, xx, yy, zz, width, depth, height, material, bevel = 0.003) => {
      parts.push({ name, type: 'box', position: [xx + width / 2, yy + depth / 2, zz + height / 2],
        size: [width, depth, height], material, bevel, category });
    };
    const cylinder = (name, position, radius, height, material) => parts.push({ name, type: 'cylinder',
      position, radiusTop: radius, radiusBottom: radius, height, axis: 'z', segments: 48, material, category });
    const lathe = (name, profile, material) => parts.push({ name, type: 'lathe', position: [tub.cx, tub.cy, 0],
      profile, segments: 64, material, category });
    const slopeBox = (name, xx, yy, width, depth, north, south, height, material) => {
      parts.push({ name, type: 'mesh', category, material,
        vertices: [[xx,yy,north],[xx+width,yy,north],[xx+width,yy+depth,south],[xx,yy+depth,south],
          [xx,yy,north+height],[xx+width,yy,north+height],[xx+width,yy+depth,south+height],[xx,yy+depth,south+height]],
        faces: [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]] });
    };
    box('shared_foundation', sx + 0.04, y + 0.04, -0.7, totalWidth - 0.08, d - 0.08, 0.6, 'foundation');
    box('sauna_floor', x, y, -0.1, w, d, 0.1, 'interior_x');
    category = 'outdoor';
    for (let i = 0; i < 18; i++) box(`shelter_deck_${i}`, sx + i * shelter.w / 18, y, -0.1,
      shelter.w / 18 - 0.004, d, 0.1, 'timber_y');
    const landing = garden.elements.find(e => e.id === 'saunaPath').parts.find(p => p.role === 'saunaLanding');
    if (landing) {
      box('landing_foundation', landing.x + 0.02, landing.y + 0.02, -0.7, landing.w - 0.04, landing.d - 0.04, 0.6, 'foundation');
      for (let i = 0; i < Math.ceil(landing.d / 0.14); i++) {
        const pitch = landing.d / Math.ceil(landing.d / 0.14);
        box(`landing_board_${i}`, landing.x, landing.y + i * pitch, -0.1, landing.w, pitch - 0.005, 0.1, 'timber_x');
      }
    }
    const wall = 0.16, hallWidth = 0.85, partition = 0.08, partitionX = x + wall + hallWidth;
    const hotX = partitionX + partition, front = y + d, doorFrom = y + 1.5, doorTo = y + 2.4;
    category = 'N';
    box('wall_north', x + 0.025, y + 0.025, 0, w - 0.05, wall - 0.025, 2.4, 'interior_x');
    category = 'E';
    box('wall_east', x + w - wall, y + wall, 0, wall - 0.025, d - wall - 0.08, 2.4, 'interior_y');
    category = 'W';
    box('wall_west_rear', x + 0.025, y + wall, 0, wall - 0.025, doorFrom - y - wall, 2.4, 'interior_y');
    box('wall_west_front', x + 0.025, doorTo, 0, wall - 0.025, front - doorTo - 0.08, 2.4, 'interior_y');
    box('wall_west_lintel', x + 0.025, doorFrom, 2.1, wall - 0.025, doorTo - doorFrom, 0.3, 'interior_y');
    for (let row = 0; row < 24; row++) {
      const z = row * 0.1, h = 0.096;
      category = 'N';
      box(`cladding_north_${row}`, x, y, z, w, 0.025, h, `cedar_x_${row % 3}`);
      category = 'E';
      box(`cladding_east_${row}`, x + w - 0.025, y + 0.025, z, 0.025, d - 0.025, h, `cedar_y_${row % 3}`);
      category = 'W';
      for (const [i, a, b] of row >= 21 ? [[0, y, front]] : [[0, y, doorFrom], [1, doorTo, front]])
        box(`cladding_west_${row}_${i}`, x, a, z, 0.025, b - a, h, `cedar_y_${row % 3}`);
    }
    category = 'furniture';
    for (const [name, start, end] of [['rear', y + wall, doorFrom], ['front', doorTo, front - 0.04]]) {
      box(`hall_partition_${name}`, partitionX, start, 0, partition, end - start, 2.4, 'interior_y');
    }
    box('hall_partition_lintel', partitionX, doorFrom, 2.1, partition, doorTo - doorFrom, 0.3, 'interior_y');
    for (const [name, xx, owner] of [['entrance', x + 0.07, 'W'], ['sauna_door', partitionX + partition / 2, 'furniture']]) {
      category = owner;
      for (const [i, yy] of [doorFrom, doorTo - 0.04].entries()) box(`${name}_jamb_${i}`, xx - 0.025, yy, 0, 0.05, 0.04, 2.1, 'trim');
      box(`${name}_head`, xx - 0.025, doorFrom, 2.06, 0.05, doorTo - doorFrom, 0.04, 'trim');
      box(`${name}_glass`, xx, doorFrom + 0.04, 0.015, 0.008, doorTo - doorFrom - 0.08, 2.04, 'glass', 0);
      box(`${name}_handle`, xx + 0.03, doorFrom + 0.12, 0.9, 0.035, 0.035, 0.4, 'interior_z');
      for (const [i, z] of [0.35, 1.75].entries()) box(`${name}_hinge_${i}`, xx - 0.018, doorTo - 0.065, z, 0.04, 0.035, 0.09, 'trim');
    }
    category = 'S';
    const windowLeft = hotX + 0.08, windowRight = x + w - 0.18, windowBottom = 0.32, windowTop = 2.18;
    for (const [name, xx, zz, width, height] of [['sill', x, 0, w, windowBottom], ['head', x, windowTop, w, 2.4-windowTop],
      ['west', x, windowBottom, windowLeft-x, windowTop-windowBottom], ['east', windowRight, windowBottom, 0.18, windowTop-windowBottom]])
      box(`wall_front_${name}`, xx, front - 0.08, zz, width, 0.055, height, 'interior_x');
    for (let row = 0; row < 24; row++) {
      const z = row * 0.1, end = z + 0.096;
      const runs = end <= windowBottom || z >= windowTop ? [[x, x+w]] : [[x,windowLeft],[windowRight,x+w]];
      for (const [i, [a,b]] of runs.entries()) box(`cladding_front_${row}_${i}`, a, front-0.025,z,b-a,0.025,0.096,`cedar_x_${row%3}`);
    }
    for (const [name, xx, width] of [['sauna', windowLeft, windowRight-windowLeft]]) {
      for (const [i, px] of [xx, xx + width - 0.04].entries()) box(`${name}_window_jamb_${i}`, px, front - 0.08, windowBottom, 0.04, 0.08, windowTop-windowBottom, 'trim');
      for (const [i, z] of [windowBottom, windowTop-0.04].entries()) box(`${name}_window_rail_${i}`, xx, front - 0.08, z, width, 0.08, 0.04, 'trim');
      box(`${name}_window_glass`, xx + 0.04, front - 0.035, windowBottom+0.04, width - 0.08, 0.012, windowTop-windowBottom-0.08, 'glass', 0);
    }
    category = 'roof';
    box('sauna_ceiling', x + wall, y + wall, 2.4, w - wall * 2, d - wall - 0.08, 0.06, 'interior_y');
    slopeBox('shared_roof', sx, y, totalWidth, d, 2.46 + d * 0.02, 2.46, 0.1, 'trim');
    slopeBox('roof_packing', x + wall, y + wall, w-wall*2, d-wall-0.08, 2.46 + (d-wall)*0.02, 2.46 + 0.08*0.02, 0.01, 'timber_y');
    for (const vertex of parts[parts.length - 1].vertices.slice(0, 4)) vertex[2] = 2.46;
    box('shared_roof_fascia_north', sx, y, 2.35 + d * 0.02, totalWidth, 0.04, 0.24, 'trim');
    box('shared_roof_fascia_south', sx, front-0.04, 2.35, totalWidth, 0.04, 0.24, 'trim');
    for (const [i, xx] of [sx, x+w-0.04].entries()) slopeBox(`shared_roof_fascia_side_${i}`, xx,y+0.04,0.04,d-0.08,
      2.35+(d-0.04)*0.02,2.35+0.04*0.02,0.24,'trim');
    for (let i = 0; i < 6; i++) slopeBox(`shelter_rafter_${i}`, sx+0.06+i*(shelter.w-0.18)/5,y+0.04,0.06,d-0.08,
      2.35+(d-0.04)*0.02,2.35+0.04*0.02,0.11,'timber_y');
    box('shelter_front_beam', sx,front-0.08,2.25,shelter.w,0.08,0.1,'timber_x');
    box('shelter_rear_beam', sx,y+0.04,2.30,shelter.w,0.08,0.1,'timber_x');
    category = 'outdoor';
    box('shelter_front_post', sx, front - 0.08, 0, 0.08, 0.08, 2.46, 'timber_z');
    for (const side of ['north', 'west']) {
      const name = `shelter_privacy_${side}`, start = [sx, y];
      const end = side === 'north' ? [x, y] : [sx, front];
      privacyScreens.push({ name, start, end, side, bottom: 0, top: 2.4 });
      for (let i = 0; i < 24; i++) for (const [face, offset] of [['outer', 0], ['inner', 0.025]]) {
        const xx = sx + (side === 'west' ? offset : 0), yy = y + (side === 'north' ? offset : 0);
        const width = side === 'north' ? shelter.w : 0.015, depth = side === 'north' ? 0.015 : d;
        const z = i * 0.1, h = 0.096;
        parts.push({ name: `${name}_slat_${face}_${i}`, type: 'mesh', material: `cedar_${side === 'north' ? 'x' : 'y'}_${i % 3}`, category,
          vertices: [[xx,yy,z],[xx+width,yy,z],[xx+width,yy+depth,z],[xx,yy+depth,z],
            [xx,yy,z+h],[xx+width,yy,z+h],[xx+width,yy+depth,z+h],[xx,yy+depth,z+h]],
          faces: [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]] });
      }
      box(`${name}_backing`, side === 'west' ? sx+0.015 : sx, side === 'north' ? y+0.015 : y,
        0, side === 'west' ? 0.01 : shelter.w, side === 'north' ? 0.01 : d, 2.4, 'cedar_x_0');
    }
    category = 'furniture';
    const benchX = x + w - wall - 0.6, benchY = y + 0.22;
    const benchSurfaces = [];
    for (const [tier, xx, height] of [["upper", benchX, 0.86], ["lower", benchX - 0.4, 0.43]]) {
      benchSurfaces.push({ name: tier, x: xx, y: benchY, w: 0.6, d: 2, height });
      for (let i = 0; i < 6; i++) box(`bench_${tier}_slat_${i}`, xx + i * 0.1, benchY, height - 0.04, 0.096, 2, 0.04, "interior_y");
      for (const [i, yy] of [benchY + 0.05, benchY + 1.85].entries()) {
        box(`bench_${tier}_support_${i}`, xx, yy, height - 0.12, 0.6, 0.06, 0.08, "interior_x");
        const supports = tier === "upper" ? [[0, xx + 0.03, 0.43]] : [[0, xx + 0.03, 0], [1, xx + 0.51, 0]];
        for (const [j, px, base] of supports) box(`bench_${tier}_leg_${i}_${j}`, px, yy, base, 0.06, 0.06, height - 0.12 - base, "interior_z");
      }
    }
    box("bench_wall_cleat", benchX + 0.54, benchY, 0.74, 0.06, 2, 0.08, "interior_y");
    for (let i = 0; i < 3; i++) box(`bench_backrest_${i}`, x + w - wall - 0.035, benchY, 1.02 + i * 0.14, 0.03, 2, 0.09, 'interior_y');
    box('bench_light', benchX + 0.02, benchY + 0.1, 0.795, 0.025, 1.8, 0.025, 'light');
    const hx = hotX + 0.09, hy = y + 0.29;
    box('heater_hearth', hx - 0.035, hy - 0.035, 0, 0.43, 0.43, 0.025, 'stone');
    box('heater_body', hx, hy, 0.1, 0.36, 0.36, 0.62, 'trim');
    for (const [i, dx, dy] of [[0,0.03,0.03],[1,0.28,0.03],[2,0.03,0.28],[3,0.28,0.28]])
      box(`heater_foot_${i}`, hx + dx, hy + dy, 0.025, 0.05, 0.05, 0.075, 'trim');
    for (let i = 0; i < 9; i++) parts.push({ name: `heater_stone_${i}`, type: 'sphere', material: 'stone', category,
      position: [hx + 0.06 + i % 3 * 0.12, hy + 0.06 + Math.floor(i / 3) * 0.12, 0.73], size: [0.11, 0.11, 0.08] });
    const hallBench = { x: x + wall, y: y + 0.2, w: hallWidth, d: 0.45, height: 0.45 };
    for (let i = 0; i < 5; i++) box(`hall_bench_slat_${i}`, hallBench.x, hallBench.y + i * 0.09, 0.41, hallWidth, 0.086, 0.04, "interior_x");
    for (const [i, xx] of [hallBench.x + 0.03, hallBench.x + hallWidth - 0.09].entries()) {
      box(`hall_bench_support_${i}`, xx, hallBench.y, 0.33, 0.06, 0.45, 0.08, "interior_y");
      for (const [j, yy] of [hallBench.y + 0.03, hallBench.y + 0.36].entries()) box(`hall_bench_leg_${i}_${j}`, xx, yy, 0, 0.06, 0.06, 0.33, "interior_z");
    }
    for (let i = 0; i < 3; i++) box(`hall_bench_backrest_${i}`, hallBench.x, hallBench.y, 0.57 + i * 0.11, hallWidth, 0.035, 0.075, "interior_x");
    lights.push({ name: 'sauna_glow', position: [benchX - 0.03, y + 1.1, 1.3], color: '#ffc47c', power: 35, category });
    lights.push({ name: 'hall_glow', position: [x + wall + hallWidth / 2, y + 0.6, 2.25], color: '#ffd6a0', power: 15, category });
    category = 'outdoor';
    const r = tub.r;
    cylinder('tub_base', [tub.cx, tub.cy, 0.025], r - 0.07, 0.05, 'trim');
    lathe('tub_shell', [[0,0.025],[r-0.06,0.025],[r,0.1],[r,0.55],[r-0.015,0.6],[r-0.06,0.61],
      [0.75,0.6],[0.75,0.53],[0.72,0.14],[0,0.14]], 'tubOuter');
    lathe('tub_liner', [[0,0.145],[0.715,0.145],[0.74,0.52],[0.75,0.58]], 'tubInner');
    cylinder('tub_water', [tub.cx,tub.cy,0.49], 0.735, 0.008, 'water');
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      parts.push({ name: `tub_jet_${i}`, type: 'sphere', material: 'trim', category,
        position: [tub.cx + Math.cos(angle) * 0.73, tub.cy + Math.sin(angle) * 0.73, 0.35], size: [0.045, 0.045, 0.045] });
    }
    box('tub_pump', sx + 0.30, y + 2.05, 0.02, 0.36, 0.4, 0.42, 'tubOuter', 0.04);
    box('tub_control', sx + 0.35, y + 2.12, 0.44, 0.26, 0.17, 0.012, 'trim');
    return { name: 'Sauna and Softub pavilion', materials, parts, lights, floorHeight, privacyScreens, benchSurfaces, hallBench,
      openings: [{ name: 'entrance', side: 'west', x, from: doorFrom, to: doorTo, bottom: 0, top: 2.1 },
        { name: 'sauna_door', side: 'west', x: partitionX, from: doorFrom, to: doorTo, bottom: 0, top: 2.1 }],
      rooms: { hall: { x: x + wall, y: y + wall, w: hallWidth, d: d - wall - 0.08 },
        sauna: { x: hotX, y: y + wall, w: w - wall - (hotX - x), d: d - wall - 0.08 } },
      doorSwings: [{ name: 'entrance', hinge: [x + 0.07, doorTo - 0.04], radius: 0.82, bounds: [x + 0.07 - 0.82, doorFrom + 0.04, 0.82, 0.82] },
        { name: 'sauna_door', hinge: [partitionX + partition / 2, doorTo - 0.04], radius: 0.82, bounds: [partitionX + partition / 2 - 0.82, doorFrom + 0.04, 0.82, 0.82] }],
      plantingClearances: plantingClearances(garden) };
  }
  function roofFootprints(garden) {
    const roof = build(garden, 0).parts.find(p => p.name === 'shared_roof');
    return [roof.vertices.slice(0, 4).map(([x, y]) => [x, y])];
  }
  return { build, plantingClearances, roofFootprints };
})();
if (typeof module !== 'undefined') module.exports = { SaunaModel };
