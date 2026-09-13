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
      materials['timber_' + axis] = { color: '#895638', roughness: 0.7, grain: axis };
      materials['interior_' + axis] = { color: '#d4b58a', roughness: 0.65, grain: axis };
      for (let i = 0; i < 3; i++) materials[`cedar_${axis}_${i}`] = {
        color: ['#865438', '#925e3e', '#9a6544'][i], roughness: 0.73, grain: axis,
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
    const wall = 0.16, hallWidth = 0.85, partition = 0.1, partitionX = x + wall + hallWidth;
    const hotX = partitionX + partition, front = y + d, doorFrom = y + 1.36, doorTo = y + 2.26;
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
    box('hall_partition_rear', partitionX, y + wall, 0, partition, doorFrom - y - wall, 2.4, 'interior_y');
    box('hall_partition_front', partitionX, doorTo, 0, partition, front - doorTo - 0.08, 2.4, 'interior_y');
    box('hall_partition_lintel', partitionX, doorFrom, 2.1, partition, doorTo - doorFrom, 0.3, 'interior_y');
    for (const [name, xx, owner] of [['entrance', x + 0.07, 'W'], ['sauna_door', partitionX + 0.04, 'furniture']]) {
      category = owner;
      for (const [i, yy] of [doorFrom, doorTo - 0.04].entries()) box(`${name}_jamb_${i}`, xx - 0.025, yy, 0, 0.05, 0.04, 2.1, 'trim');
      box(`${name}_head`, xx - 0.025, doorFrom, 2.06, 0.05, doorTo - doorFrom, 0.04, 'trim');
      box(`${name}_glass`, xx, doorFrom + 0.04, 0.015, 0.008, doorTo - doorFrom - 0.08, 2.04, 'glass', 0);
      box(`${name}_handle`, xx + 0.03, doorFrom + 0.12, 0.9, 0.035, 0.035, 0.4, 'interior_z');
      for (const [i, z] of [0.35, 1.75].entries()) box(`${name}_hinge_${i}`, xx - 0.018, doorTo - 0.065, z, 0.04, 0.035, 0.09, 'trim');
    }
    category = 'S';
    for (const [name, xx, width] of [['hall', x + 0.04, wall + hallWidth - 0.04], ['sauna', partitionX + 0.02, w - wall - hallWidth - 0.06]]) {
      for (const [i, px] of [xx, xx + width - 0.045].entries()) box(`${name}_window_jamb_${i}`, px, front - 0.08, 0, 0.045, 0.08, 2.4, 'trim');
      for (const [i, z] of [0, 2.35].entries()) box(`${name}_window_rail_${i}`, xx, front - 0.08, z, width, 0.08, 0.05, 'trim');
      box(`${name}_window_glass`, xx + 0.045, front - 0.035, 0.05, width - 0.09, 0.012, 2.3, 'glass', 0);
    }
    category = 'roof';
    box('sauna_ceiling', x + wall, y + wall, 2.4, w - wall * 2, d - wall - 0.08, 0.06, 'interior_y');
    box('shared_roof', sx, y, 2.46, totalWidth, d, 0.1, 'trim');
    for (const [name, xx, yy, width, depth] of [['north', sx, y, totalWidth, 0.04], ['south', sx, front - 0.04, totalWidth, 0.04],
      ['west', sx, y + 0.04, 0.04, d - 0.08], ['east', x + w - 0.04, y + 0.04, 0.04, d - 0.08]])
      box(`shared_roof_fascia_${name}`, xx, yy, 2.35, width, depth, 0.24, 'trim');
    for (let i = 0; i < 6; i++) box(`shelter_rafter_${i}`, sx + 0.06 + i * (shelter.w - 0.18) / 5, y + 0.04, 2.35, 0.06, d - 0.08, 0.11, 'timber_y');
    category = 'outdoor';
    box('shelter_front_post', sx, front - 0.08, 0, 0.08, 0.08, 2.46, 'timber_z');
    for (const side of ['north', 'west']) {
      const name = `shelter_privacy_${side}`, start = [sx, y];
      const end = side === 'north' ? [x, y] : [sx, front];
      privacyScreens.push({ name, start, end, side, bottom: 0, top: 2.4 });
      for (let i = 0; i < 24; i++) {
        const xx = sx, yy = y, width = side === 'north' ? shelter.w : 0.04, depth = side === 'north' ? 0.04 : d;
        const z = i * 0.1;
        parts.push({ name: `${name}_slat_${i}`, type: 'mesh', material: `cedar_${side === 'north' ? 'x' : 'y'}_${i % 3}`, category,
          vertices: [[xx,yy,z],[xx+width,yy,z],[xx+width,yy+depth,z],[xx,yy+depth,z],
            [xx,yy,z+0.1],[xx+width,yy,z+0.1],[xx+width,yy+depth,z+0.1],[xx,yy+depth,z+0.1]],
          faces: [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]] });
      }
    }
    category = 'furniture';
    const benchX = x + w - wall - 0.6, benchY = y + 0.22;
    for (let i = 0; i < 6; i++) box(`bench_upper_slat_${i}`, benchX + i * 0.1, benchY, 0.82, 0.091, 2, 0.04, 'interior_y');
    for (const [i, yy] of [benchY + 0.05, benchY + 1.85].entries()) {
      box(`bench_support_${i}`, benchX, yy, 0.74, 0.6, 0.06, 0.08, 'interior_x');
      for (const [j, xx] of [benchX + 0.03, benchX + 0.51].entries()) box(`bench_leg_${i}_${j}`, xx, yy, 0, 0.06, 0.06, 0.74, 'interior_z');
    }
    box('bench_step', benchX - 0.22, y + 1.03, 0.37, 0.3, 0.55, 0.06, 'interior_y');
    for (const [i, xx, yy] of [[0,benchX-0.2,y+1.05],[1,benchX+0.01,y+1.05],[2,benchX-0.2,y+1.51],[3,benchX+0.01,y+1.51]])
      box(`bench_step_leg_${i}`, xx, yy, 0, 0.05, 0.05, 0.37, 'interior_z');
    for (let i = 0; i < 3; i++) box(`bench_backrest_${i}`, x + w - wall - 0.035, benchY, 1.02 + i * 0.14, 0.03, 2, 0.09, 'interior_y');
    box('bench_light', benchX + 0.02, benchY + 0.1, 0.795, 0.025, 1.8, 0.025, 'light');
    const hx = hotX + 0.09, hy = y + 0.29;
    box('heater_hearth', hx - 0.035, hy - 0.035, 0, 0.43, 0.43, 0.025, 'stone');
    box('heater_body', hx, hy, 0.1, 0.36, 0.36, 0.62, 'trim');
    for (const [i, dx, dy] of [[0,0.03,0.03],[1,0.28,0.03],[2,0.03,0.28],[3,0.28,0.28]])
      box(`heater_foot_${i}`, hx + dx, hy + dy, 0.025, 0.05, 0.05, 0.075, 'trim');
    for (let i = 0; i < 9; i++) parts.push({ name: `heater_stone_${i}`, type: 'sphere', material: 'stone', category,
      position: [hx + 0.06 + i % 3 * 0.12, hy + 0.06 + Math.floor(i / 3) * 0.12, 0.73], size: [0.11, 0.11, 0.08] });
    const chairX = x + wall + (hallWidth - 0.48) / 2, chairY = y + 0.28;
    box('hall_chair_seat', chairX, chairY, 0.42, 0.48, 0.48, 0.04, 'seat');
    box('hall_chair_back', chairX, chairY, 0.46, 0.48, 0.045, 0.4, 'interior_x');
    for (const [i, dx, dy] of [[0,0.035,0.035],[1,0.4,0.035],[2,0.035,0.4],[3,0.4,0.4]])
      box(`hall_chair_leg_${i}`, chairX + dx, chairY + dy, 0, 0.045, 0.045, 0.42, 'interior_z');
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
    box('tub_pump', sx + 0.72, y + 1.94, 0.02, 0.36, 0.4, 0.42, 'tubOuter', 0.04);
    box('tub_control', sx + 0.77, y + 2.01, 0.44, 0.26, 0.17, 0.012, 'trim');
    return { name: 'Sauna and Softub pavilion', materials, parts, lights, floorHeight, privacyScreens,
      openings: [{ name: 'entrance', side: 'west', x, from: doorFrom, to: doorTo, bottom: 0, top: 2.1 },
        { name: 'sauna_door', side: 'west', x: partitionX, from: doorFrom, to: doorTo, bottom: 0, top: 2.1 }],
      rooms: { hall: { x: x + wall, y: y + wall, w: hallWidth, d: d - wall - 0.08 },
        sauna: { x: hotX, y: y + wall, w: w - wall - (hotX - x), d: d - wall - 0.08 } },
      doorSwings: [{ name: 'entrance', hinge: [x + 0.07, doorTo - 0.04], radius: 0.82, bounds: [x + 0.07 - 0.82, doorFrom + 0.04, 0.82, 0.82] },
        { name: 'sauna_door', hinge: [partitionX + 0.04, doorTo - 0.04], radius: 0.82, bounds: [partitionX + 0.04 - 0.82, doorFrom + 0.04, 0.82, 0.82] }],
      plantingClearances: plantingClearances(garden) };
  }
  function roofFootprints(garden) {
    const roof = build(garden, 0).parts.find(p => p.name === 'shared_roof');
    const [x, y] = roof.position, [w, d] = roof.size;
    return [[[x-w/2,y-d/2],[x+w/2,y-d/2],[x+w/2,y+d/2],[x-w/2,y+d/2]]];
  }
  return { build, plantingClearances, roofFootprints };
})();
if (typeof module !== 'undefined') module.exports = { SaunaModel };
