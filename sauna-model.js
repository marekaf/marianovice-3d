/* Coordinates are [east, south, height above the shared finished floor], in metres. */
const SaunaModel = (() => {
  function plantingClearances(garden) {
    const rects = garden.elements.filter(e => ['sauna', 'saunaShelter', 'saunaPath'].includes(e.id))
      .flatMap(e => e.parts.filter(p => p.kind === 'rect').map(p => ({ x: p.x, y: p.y, w: p.w, d: p.d })));
    const sauna = garden.elements.find(e => e.id === 'sauna').parts.find(p => p.kind === 'rect');
    const landing = garden.elements.find(e => e.id === 'saunaPath').parts.find(p => p.role === 'saunaLanding');
    rects.push({ x: sauna.x + 0.18, y: sauna.y - 0.67, w: 1.58, d: 0.44 });
    rects.push({ x: sauna.x + sauna.w - 1.22, y: landing.y + landing.d, w: 1.16, d: 0.56 });
    return rects;
  }
  function build(garden, terrain) {
    const rect = id => garden.elements.find(e => e.id === id).parts.find(p => p.kind === 'rect');
    const sauna = rect('sauna'), shelter = rect('saunaShelter');
    const tub = garden.elements.find(e => e.id === 'softub').parts.find(p => p.kind === 'circle');
    const { x, y, w, d } = sauna;
    const landing = garden.elements.find(e => e.id === 'saunaPath').parts.find(p => p.role === 'saunaLanding');
    const floorHeight = Math.max(...[sauna, shelter].flatMap(r =>
      [r.x, r.x + r.w].flatMap(px => [r.y, r.y + r.d].map(py =>
        Math.max(0, terrain.a * px + terrain.b * py + terrain.c))))) + 0.12;
    const materials = {
      trim: { color: '#303638', roughness: 0.4, metalness: 0.65 },
      steel: { color: '#8d9393', roughness: 0.28, metalness: 0.85 },
      shadow: { color: '#28231f', roughness: 0.92 },
      foundation: { color: '#696b65', roughness: 0.88 },
      glass: { color: '#f2f7f5', roughness: 0.025, transmission: 1 },
      water: { color: '#86b4b9', roughness: 0.15, transmission: 0.75 },
      tubOuter: { color: '#857568', roughness: 0.72 },
      tubInner: { color: '#c1c9c5', roughness: 0.32 },
      stone: { color: '#454845', roughness: 0.95 },
      light: { color: '#f6d5a1', roughness: 0.55, emissive: '#ffd49b', emissiveIntensity: 1.5 },
      log: { color: '#b59869', roughness: 0.95, grain: 'y' },
      bark: { color: '#584737', roughness: 0.98, grain: 'y' },
    };
    for (const axis of ['x', 'y', 'z']) {
      materials['timber_' + axis] = { color: '#af8156', roughness: 0.7, grain: axis };
      materials['interior_' + axis] = { color: '#d4b58a', roughness: 0.65, grain: axis };
      for (let i = 0; i < 4; i++) {
        materials[`cedar_${axis}_${i}`] = {
          color: ['#a77a50', '#b38559', '#b78b60', '#9f734b'][i], roughness: 0.73, grain: axis,
        };
      }
    }
    const parts = [], lights = [];
    const box = (name, x0, y0, z0, width, depth, height, material, bevel = 0.004) => {
      parts.push({ name, type: 'box', position: [x0 + width / 2, y0 + depth / 2, z0 + height / 2],
        size: [width, depth, height], material, bevel });
    };
    const cylinder = (name, position, radius, height, material, axis = 'z') => {
      parts.push({ name, type: 'cylinder', position, radiusTop: radius, radiusBottom: radius,
        height, axis, segments: 24, material });
    };
    const lathe = (name, position, profile, material) => {
      parts.push({ name, type: 'lathe', position, profile, segments: 64, material });
    };
    const slab = (name, x0, y0, width, depth, north, south, thickness, material) => {
      parts.push({ name, type: 'mesh', material,
        vertices: [[x0,y0,north], [x0+width,y0,north], [x0+width,y0+depth,south], [x0,y0+depth,south],
          [x0,y0,north+thickness], [x0+width,y0,north+thickness],
          [x0+width,y0+depth,south+thickness], [x0,y0+depth,south+thickness]],
        faces: [[0,3,2,1], [4,5,6,7], [0,1,5,4], [1,2,6,5], [2,3,7,6], [3,0,4,7]] });
    };
    const boardMat = (i, axis = 'z') => `cedar_${axis}_${(i * 7 + Math.floor(i / 3)) % 4}`;

    box('sauna_foundation', x + 0.04, y + 0.04, -0.7, w - 0.08, d - 0.08, 0.64, 'foundation', 0.01);
    box('sauna_floor', x, y, -0.06, w, d, 0.06, 'interior_x');
    box('shelter_plinth', shelter.x + 0.06, shelter.y + 0.06, -0.7,
      shelter.w - 0.12, shelter.d - 0.12, 0.59, 'foundation', 0.01);
    const deckCount = Math.ceil(shelter.w / 0.14);
    for (let i = 0; i < deckCount; i++) {
      box(`shelter_deck_${i}`, shelter.x + i * shelter.w / deckCount, shelter.y, -0.1,
        shelter.w / deckCount - 0.005, shelter.d, 0.1, boardMat(i, 'y'));
    }
    box('shelter_front_fascia', shelter.x, shelter.y + shelter.d - 0.04, -0.19,
      shelter.w, 0.04, 0.18, 'timber_x');
    box('landing_foundation', landing.x + 0.06, landing.y + 0.02, -0.7,
      landing.w - 0.12, landing.d - 0.05, 0.59, 'foundation', 0.01);
    for (let i = 0; i < 6; i++) {
      box(`landing_board_${i}`, landing.x, landing.y + i * landing.d / 6, -0.1,
        landing.w, landing.d / 6 - 0.006, 0.1, boardMat(i, 'x'));
    }
    box('landing_fascia', landing.x, landing.y + landing.d - 0.025, -0.19,
      landing.w, 0.03, 0.18, 'timber_x');

    const openings = [
      { name: 'window', from: 0.45, to: w - 1.5, bottom: 0.65, top: 2.16 },
      { name: 'door', from: w - 1.2, to: w - 0.25, bottom: 0, top: 2.16 },
    ];
    box('wall_north', x, y, 0, w, 0.16, 2.6, 'interior_x');
    box('wall_west', x, y + 0.16, 0, 0.16, d - 0.32, 2.6, 'interior_y');
    box('wall_east', x + w - 0.16, y + 0.16, 0, 0.16, d - 0.32, 2.6, 'interior_y');
    const cuts = [0, ...openings.flatMap(o => [o.from, o.to]), w];
    for (let i = 0; i < cuts.length - 1; i++) {
      const left = cuts[i], right = cuts[i + 1];
      const opening = openings.find(o => left >= o.from && right <= o.to);
      if (!opening) box(`wall_front_${i}`, x + left, y + d - 0.16, 0, right - left, 0.16, 2.6, 'interior_x');
      else {
        if (opening.bottom) box(`wall_sill_${i}`, x + left, y + d - 0.16, 0, right - left, 0.16, opening.bottom, 'interior_x');
        box(`wall_lintel_${i}`, x + left, y + d - 0.16, opening.top, right - left, 0.16, 2.6 - opening.top, 'interior_x');
      }
    }
    for (const side of ['north', 'south', 'east', 'west']) {
      const length = side === 'north' || side === 'south' ? w : d;
      const count = Math.ceil(length / 0.12), pitch = length / count;
      for (let i = 0; i < count; i++) {
        const from = i * pitch + 0.004, to = (i + 1) * pitch - 0.004;
        let bands = [[0.04, 2.6]];
        if (side === 'south') {
          for (const o of openings) {
            if (to > o.from - 0.035 && from < o.to + 0.035) {
              bands = bands.flatMap(([lo, hi]) => [[lo, Math.min(hi, o.bottom - 0.035)], [Math.max(lo, o.top + 0.035), hi]])
                .filter(([lo, hi]) => hi > lo);
            }
          }
        }
        for (const [j, [lo, hi]] of bands.entries()) {
          if (side === 'north' || side === 'south') {
            box(`cladding_${side}_${i}_${j}`, x + from, side === 'north' ? y - 0.028 : y + d,
              lo, to - from, 0.028, hi - lo, boardMat(i));
          } else {
            box(`cladding_${side}_${i}_${j}`, side === 'west' ? x - 0.028 : x + w, y + from,
              lo, 0.028, to - from, hi - lo, boardMat(i + 2));
          }
        }
      }
    }
    for (const [i, [cx, cy]] of [[x,y], [x+w,y], [x,y+d], [x+w,y+d]].entries()) {
      box(`corner_${i}`, cx - 0.035, cy - 0.035, 0.02, 0.07, 0.07, 2.6, 'timber_z');
    }
    for (const o of openings) {
      const a = x + o.from, b = x + o.to, front = y + d;
      for (const [i, xx] of [a, b - 0.05].entries()) {
        box(`${o.name}_jamb_${i}`, xx, front - 0.15, o.bottom, 0.05, 0.19, o.top - o.bottom, 'trim');
      }
      for (const [i, zz] of [o.bottom, o.top - 0.05].entries()) {
        box(`${o.name}_rail_${i}`, a, front - 0.15, zz, b - a, 0.19, 0.05, 'trim');
      }
      box(`${o.name}_glass`, a + 0.055, front - 0.025, o.bottom + 0.055,
        b - a - 0.11, 0.008, o.top - o.bottom - 0.11, 'glass', 0);
      if (o.name === 'window') {
        box('window_drip_sill', a - 0.045, front - 0.02, o.bottom - 0.025,
          b - a + 0.09, 0.12, 0.025, 'trim');
      } else {
        for (const z of [0.38, 1.78]) box(`door_hinge_${z}`, a + 0.055, front + 0.012, z, 0.07, 0.035, 0.11, 'steel');
        for (const z of [0.91, 1.35]) cylinder(`door_handle_mount_${z}`, [b - 0.14, front + 0.045, z], 0.014, 0.12, 'steel', 'y');
        cylinder('door_handle', [b - 0.14, front + 0.1, 1.13], 0.024, 0.52, 'interior_z');
      }
    }

    box('sauna_ceiling', x + 0.16, y + 0.16, 2.5, w - 0.32, d - 0.32, 0.1, 'interior_y');
    slab('sauna_roof', x - 0.16, y - 0.16, w + 0.32, d + 0.32, 2.77, 2.61, 0.07, 'trim');
    for (let i = 0; i <= Math.floor((w + 0.2) / 0.43); i++) {
      slab(`roof_seam_${i}`, x - 0.1 + i * 0.43, y - 0.16, 0.018, d + 0.32, 2.84, 2.68, 0.024, 'trim');
    }
    box('roof_north_fascia', x - 0.16, y - 0.18, 2.6, w + 0.32, 0.04, 0.24, 'trim');
    box('roof_south_fascia', x - 0.16, y + d + 0.14, 2.5, w + 0.32, 0.04, 0.18, 'trim');
    for (const [i, xx] of [x - 0.16, x + w + 0.12].entries()) {
      slab(`roof_side_fascia_${i}`, xx, y - 0.16, 0.04, d + 0.32, 2.6, 2.44, 0.24, 'trim');
    }
    box('gutter_bottom', x - 0.17, y + d + 0.18, 2.48, w + 0.34, 0.12, 0.018, 'trim');
    box('gutter_front', x - 0.17, y + d + 0.28, 2.48, w + 0.34, 0.02, 0.1, 'trim');
    for (const xx of [x - 0.17, x + w + 0.15]) box(`gutter_end_${xx}`, xx, y + d + 0.18, 2.48, 0.02, 0.12, 0.1, 'trim');
    cylinder('downpipe', [x + w + 0.12, y + d + 0.235, 1.27], 0.036, 2.43, 'trim');
    for (const z of [0.55, 1.9]) box(`pipe_bracket_${z}`, x + w + 0.055, y + d + 0.19, z, 0.1, 0.09, 0.035, 'steel');

    for (let row = 0; row < 17; row++) {
      box(`interior_rear_board_${row}`, x + 0.17, y + 0.16, 0.05 + row * 0.14,
        w - 0.34, 0.018, 0.133, 'interior_x');
    }
    for (const [tier, depth, height] of [[0, 1.06, 0.43], [1, 0.6, 0.86]]) {
      const back = y + 0.2, count = Math.floor(depth / 0.095);
      for (let i = 0; i < count; i++) box(`bench_${tier}_slat_${i}`, x + 0.23, back + i * depth / count,
        height - 0.04, w - 0.46, depth / count - 0.009, 0.04, 'interior_x', 0.008);
      for (const [i, xx] of [x + 0.35, x + w / 2, x + w - 0.4].entries()) {
        box(`bench_${tier}_support_${i}`, xx, back, height - 0.13, 0.065, depth, 0.09, 'interior_y');
        box(`bench_${tier}_leg_${i}`, xx, back + depth - 0.12, 0, 0.065, 0.07, height - 0.04, 'interior_z');
      }
    }
    for (let i = 0; i < 3; i++) box(`bench_backrest_${i}`, x + 0.23, y + 0.23, 1.02 + i * 0.14,
      w - 0.46, 0.035, 0.085, 'interior_x', 0.008);
    box('bench_light', x + 0.3, y + 0.78, 0.795, w - 0.6, 0.025, 0.025, 'light');
    lights.push({ name: 'bench_glow', position: [x + w / 2, y + 0.95, 0.66], color: '#ffc47c', power: 28 });
    lights.push({ name: 'sauna_ceiling_light', position: [x + w / 2, y + d / 2, 2.32], color: '#ffd6a0', power: 45 });
    box('ceiling_light_housing', x + w / 2 - 0.25, y + d / 2 - 0.09, 2.43, 0.5, 0.18, 0.07, 'timber_x');
    box('ceiling_light_diffuser', x + w / 2 - 0.22, y + d / 2 - 0.065, 2.419, 0.44, 0.13, 0.012, 'light');
    const hx = x + 0.35, hy = y + d - 0.72;
    box('heater_hearth', hx - 0.11, hy - 0.11, 0.005, 0.63, 0.63, 0.025, 'stone');
    box('heater_body', hx, hy, 0.13, 0.4, 0.4, 0.57, 'trim', 0.025);
    for (const [i, [px, py]] of [[hx+0.04,hy+0.04], [hx+0.31,hy+0.04], [hx+0.04,hy+0.31], [hx+0.31,hy+0.31]].entries()) {
      box(`heater_foot_${i}`, px, py, 0.03, 0.05, 0.05, 0.13, 'trim');
    }
    for (let i = 0; i < 9; i++) {
      box(`heater_fin_${i}`, hx + 0.025 + i * 0.04, hy - 0.012, 0.21, 0.009, 0.016, 0.4, 'steel', 0.002);
    }
    for (let i = 0; i < 12; i++) {
      parts.push({ name: `heater_stone_${i}`, type: 'sphere', material: 'stone',
        position: [hx + 0.065 + (i % 3) * 0.13, hy + 0.065 + Math.floor(i / 3) * 0.085, 0.73 + (i % 2) * 0.025],
        size: [0.13, 0.115, 0.105] });
    }
    for (const [i, px] of [hx - 0.14, hx + 0.53].entries()) {
      box(`heater_guard_post_${i}`, px, hy - 0.19, 0, 0.045, 0.045, 0.82, 'interior_z');
    }
    for (const z of [0.45, 0.76]) box(`heater_guard_rail_${z}`, hx - 0.14, hy - 0.19, z, 0.715, 0.045, 0.045, 'interior_x');
    for (const [i, z] of [0.2, 2.1].entries()) {
      box(`vent_recess_${i}`, x + w + 0.03, y + 0.5, z, 0.012, 0.28, 0.16, 'shadow');
      for (let j = 0; j < 4; j++) box(`vent_${i}_${j}`, x + w + 0.043, y + 0.49, z + j * 0.042,
        0.018, 0.3, 0.015, 'trim');
    }

    const sx = shelter.x, sy = shelter.y, sw = shelter.w, sd = shelter.d;
    for (const [i, [px, py]] of [[sx+0.13,sy+0.13], [sx+sw-0.13,sy+0.13],
      [sx+0.13,sy+sd-0.13], [sx+sw-0.13,sy+sd-0.13]].entries()) {
      box(`shelter_post_shoe_${i}`, px - 0.075, py - 0.075, 0, 0.15, 0.15, 0.15, 'trim');
      box(`shelter_post_${i}`, px - 0.06, py - 0.06, 0.08, 0.12, 0.12, 2.29, 'timber_z');
      cylinder(`shelter_post_bolt_${i}`, [px, py + 0.078, 0.08], 0.015, 0.008, 'steel', 'y');
    }
    for (const [i, yy] of [sy + 0.06, sy + sd - 0.2].entries()) {
      box(`shelter_beam_${i}`, sx + 0.06, yy, 2.2, sw - 0.12, 0.14, 0.18, 'timber_x');
    }
    for (let i = 0; i < 8; i++) {
      slab(`shelter_rafter_${i}`, sx + 0.05 + i * (sw - 0.18) / 7, sy - 0.1, 0.08, sd + 0.2, 2.38, 2.28, 0.142, 'timber_y');
    }
    slab('shelter_roof', sx - 0.13, sy - 0.13, sw + 0.16, sd + 0.26, 2.52, 2.42, 0.055, 'trim');
    box('shelter_front_roof_trim', sx - 0.13, sy + sd + 0.11, 2.38, sw + 0.16, 0.04, 0.1, 'trim');
    box('shelter_wall_flashing', x - 0.06, sy - 0.13, 2.43, 0.05, sd + 0.26, 0.19, 'trim');
    lights.push({ name: 'shelter_light', position: [sx + sw - 0.35, sy + sd / 2, 2.17], color: '#ffd6a0', power: 24 });
    box('shelter_sconce', x - 0.085, sy + sd / 2 - 0.065, 1.92, 0.055, 0.13, 0.22, 'trim');
    box('shelter_sconce_lens', x - 0.09, sy + sd / 2 - 0.05, 1.95, 0.01, 0.1, 0.16, 'light');

    const r = tub.r;
    cylinder('tub_base', [tub.cx, tub.cy, 0.025], r - 0.09, 0.05, 'trim');
    lathe('tub_shell', [tub.cx, tub.cy, 0], [[0,0.025], [r-0.08,0.025], [r-0.02,0.08],
      [r,0.18], [r,0.68], [r-0.025,0.77], [r-0.08,0.8], [r-0.15,0.79],
      [r-0.2,0.72], [r-0.23,0.17], [0,0.17]], 'tubOuter');
    lathe('tub_liner', [tub.cx, tub.cy, 0], [[0,0.18], [r-0.24,0.18], [r-0.205,0.3],
      [r-0.18,0.67], [r-0.155,0.73], [r-0.15,0.76]], 'tubInner');
    lathe('tub_rim_piping', [tub.cx,tub.cy,0], [[r-0.02,0.704], [r-0.005,0.71],
      [r-0.004,0.722], [r-0.015,0.73], [r-0.025,0.721], [r-0.02,0.704]], 'tubInner');
    cylinder('tub_water', [tub.cx,tub.cy,0.62], r - 0.19, 0.009, 'water');
    for (const [i, a] of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].entries()) {
      parts.push({ name: `tub_jet_${i}`, type: 'sphere', material: 'steel',
        position: [tub.cx + Math.cos(a) * (r - 0.21), tub.cy + Math.sin(a) * (r - 0.21), 0.43],
        size: [0.045, 0.045, 0.045] });
    }
    box('tub_pump', tub.cx + r + 0.03, tub.cy - 0.2, 0.02, 0.31, 0.4, 0.42, 'tubOuter', 0.06);
    box('tub_control', tub.cx + r + 0.07, tub.cy - 0.12, 0.442, 0.2, 0.16, 0.01, 'trim');
    for (const [i, height] of [0.14, 0.29].entries()) {
      const yy = tub.cy + r + 0.04 + (1 - i) * 0.22;
      box(`tub_step_${i}`, tub.cx - 0.43, yy, 0, 0.86, 0.23, height - 0.04, 'trim');
      for (let j = 0; j < 2; j++) box(`tub_step_board_${i}_${j}`, tub.cx - 0.45, yy + j * 0.115,
        height - 0.04, 0.9, 0.108, 0.04, 'timber_x', 0.008);
    }

    const rackX = x + 0.22, rackY = y - 0.64, rackW = 1.5, rackD = 0.38;
    box('log_rack_foundation', rackX + 0.025, rackY + 0.025, -0.7, rackW - 0.05, rackD - 0.05, 0.76, 'foundation');
    box('log_rack_base', rackX, rackY, 0.06, rackW, rackD, 0.04, 'trim');
    for (const [i, xx] of [rackX, rackX + rackW - 0.035].entries()) {
      box(`log_rack_upright_${i}`, xx, rackY, 0, 0.035, rackD, 0.85, 'trim');
    }
    slab('log_rack_cap', rackX - 0.04, rackY - 0.03, rackW + 0.08, rackD + 0.06, 0.9, 0.85, 0.035, 'trim');
    for (let row = 0; row < 5; row++) for (let col = 0; col < 10; col++) {
      const px = rackX + 0.095 + col * 0.137 + (row % 2) * 0.022;
      const radius = 0.057 + ((row * 7 + col * 3) % 5) * 0.002;
      const zz = 0.17 + row * 0.124;
      cylinder(`log_bark_${row}_${col}`, [px, rackY + rackD / 2, zz], radius, rackD - 0.05, 'bark', 'y');
      cylinder(`log_end_${row}_${col}`, [px, rackY + rackD - 0.023, zz], radius * 0.83, 0.008, 'log', 'y');
    }
    const stepX = x + w - 1.2, stepWidth = 1.12;
    for (const [i, height] of [0.14, 0.28].entries()) {
      const stepY = landing.y + landing.d + (1 - i) * 0.28;
      box(`entry_step_${i}`, stepX, stepY, -0.7, stepWidth, 0.29, height + 0.28, 'foundation', 0.01);
      for (let j = 0; j < 2; j++) box(`entry_tread_${i}_${j}`, stepX - 0.02, stepY + j * 0.14,
        -0.42 + height, stepWidth + 0.04, 0.135, 0.035, 'timber_x', 0.007);
    }
    return { name: 'Sauna, shelter and hot tub', materials, parts, lights, openings, floorHeight, plantingClearances: plantingClearances(garden) };
  }
  return { build, plantingClearances };
})();
if (typeof module !== 'undefined') module.exports = { SaunaModel };
