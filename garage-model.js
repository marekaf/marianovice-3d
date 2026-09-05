const GarageModel = (() => {
  function groundPatch(garden, floorHeight) {
    const footprints = ['garage', 'carport'].map(id => garden.elements.find(e => e.id === id).parts.find(p => p.kind === 'rect'));
    const x = Math.min(...footprints.map(p => p.x)), y = Math.min(...footprints.map(p => p.y));
    return { x, y, w: Math.max(...footprints.map(p => p.x + p.w)) - x,
      d: Math.max(...footprints.map(p => p.y + p.d)) - y, level: floorHeight - 0.04, blend: 2 };
  }
  function build(garden, floorHeight = 0, plinthTo = floorHeight - 0.12) {
    const element = garden.elements.find(e => e.id === 'garage');
    const rect = element.parts.find(p => p.kind === 'rect');
    const { x, y, w, d } = rect;
    const { wallT, openings, workbench } = element.meta;
    const wallTop = 2.3, roofHigh = 3.5, pitch = 1.2 / w;
    const roofAt = px => roofHigh - (px - x) * pitch;
    const materials = {
      render: { color: '#888984', roughness: 0.91 },
      paint: { color: '#e6e3dc', roughness: 0.86 },
      floor: { color: '#b1b3af', roughness: 0.48 },
      foundation: { color: '#787b78', roughness: 0.9 },
      skirting: { color: '#a4aaa7', roughness: 0.55 },
      steel: { color: '#626a6d', roughness: 0.4, metalness: 0.75 },
      hardware: { color: '#b6bab9', roughness: 0.25, metalness: 0.9 },
      charcoal: { color: '#333a3d', roughness: 0.48, metalness: 0.45 },
      rubber: { color: '#222827', roughness: 0.93 },
      toolRed: { color: '#a33d32', roughness: 0.5 },
      toolBlue: { color: '#405c73', roughness: 0.52 },
      toolOchre: { color: '#bf8a43', roughness: 0.55 },
      lamp: { color: '#f1f0e7', roughness: 0.35, emissive: '#fff5df', emissiveIntensity: 1.6 },
    };
    for (const axis of ['x', 'y', 'z']) {
      materials['timber_' + axis] = { color: '#a7835a', roughness: 0.68, grain: axis };
      materials['ceiling_' + axis] = { color: '#a78b65', roughness: 0.78, grain: axis };
    }
    const parts = [], lights = [];
    const box = (name, x0, y0, z0, width, depth, height, material, category, bevel = 0.003) => {
      parts.push({ name, type: 'box', position: [x0 + width / 2, y0 + depth / 2, z0 + height / 2],
        size: [width, depth, height], material, category, bevel });
    };
    const beam = (name, start, end, width, depth, material, category) => {
      parts.push({ name, type: 'beam', start, end, width, depth, material, category, bevel: 0.002 });
    };
    const cylinder = (name, position, radius, height, material, category, axis = 'z', segments = 20) => {
      parts.push({ name, type: 'cylinder', position, radiusTop: radius, radiusBottom: radius,
        height, axis, segments, material, category });
    };
    const prism = (name, px, py, width, depth, bottomWest, bottomEast, topWest, topEast, material, category) => {
      parts.push({ name, type: 'mesh', material, category,
        vertices: [[px,py,bottomWest], [px+width,py,bottomEast], [px+width,py+depth,bottomEast], [px,py+depth,bottomWest],
          [px,py,topWest], [px+width,py,topEast], [px+width,py+depth,topEast], [px,py+depth,topWest]],
        faces: [[0,3,2,1], [4,5,6,7], [0,1,5,4], [1,2,6,5], [2,3,7,6], [3,0,4,7]] });
    };
    const slabDepth = Math.max(0.12, floorHeight - plinthTo);
    box('garage_foundation', x, y, -slabDepth, w, d, slabDepth - 0.035, 'foundation', 'floor', 0);
    box('garage_floor', x, y, -0.035, w, d, 0.035, 'floor', 'floor', 0.002);

    for (const side of ['N', 'S', 'W', 'E']) {
      const alongX = side === 'N' || side === 'S';
      const from = alongX ? x : y + wallT, to = alongX ? x + w : y + d - wallT;
      const spans = [];
      let cursor = from;
      for (const opening of openings.filter(o => o.wall === side).sort((a, b) => a.from - b.from)) {
        if (opening.from > cursor) spans.push([cursor, opening.from, 0]);
        spans.push([opening.from, opening.from + opening.w, opening.h]);
        cursor = opening.from + opening.w;
      }
      if (cursor < to) spans.push([cursor, to, 0]);
      for (const [i, [a, b, bottom]] of spans.entries()) {
        const px = alongX ? a : side === 'W' ? x : x + w - wallT;
        const py = alongX ? side === 'N' ? y : y + d - wallT : a;
        const width = alongX ? b - a : wallT, depth = alongX ? wallT : b - a;
        const finish = 0.015;
        let coreX = px, coreY = py, coreW = width, coreD = depth;
        let linerX = px, linerY = py, linerW = width, linerD = depth;
        if (side === 'N') { coreD -= finish; linerY += depth - finish; linerD = finish; }
        if (side === 'S') { coreY += finish; coreD -= finish; linerD = finish; }
        if (side === 'W') { coreW -= finish; linerX += width - finish; linerW = finish; }
        if (side === 'E') { coreX += finish; coreW -= finish; linerW = finish; }
        prism(`wall_${side}_${i}`, coreX, coreY, coreW, coreD, bottom, bottom,
          roofAt(coreX), roofAt(coreX + coreW), 'render', side);
        prism(`wall_lining_${side}_${i}`, linerX, linerY, linerW, linerD, bottom, bottom,
          roofAt(linerX), roofAt(linerX + linerW), 'paint', side);
        if (bottom === 0) {
          const sx = side === 'W' ? px + width : side === 'E' ? px - 0.009 : px;
          const sy = side === 'N' ? py + depth : side === 'S' ? py - 0.009 : py;
          box(`wall_skirting_${side}_${i}`, sx, sy, 0, alongX ? width : 0.009,
            alongX ? 0.009 : depth, 0.12, 'skirting', side, 0.001);
        }
      }
    }

    const innerX = x + wallT, innerY = y + wallT, innerW = w - 2 * wallT, innerD = d - 2 * wallT;
    prism('ceiling_backing', innerX, innerY, innerW, innerD,
      roofAt(innerX) - 0.034, roofAt(innerX + innerW) - 0.034,
      roofAt(innerX) - 0.01, roofAt(innerX + innerW) - 0.01, 'charcoal', 'roof');
    const ceilingCount = Math.ceil(innerW / 0.14);
    for (let i = 0; i < ceilingCount; i++) {
      const px = innerX + i * innerW / ceilingCount, width = innerW / ceilingCount - 0.005;
      prism(`ceiling_board_${i}`, px, innerY, width, innerD,
        roofAt(px) - 0.06, roofAt(px + width) - 0.06, roofAt(px) - 0.035, roofAt(px + width) - 0.035,
        'ceiling_y', 'roof');
    }
    for (const [i, py] of [innerY + 0.3, innerY + innerD / 2, innerY + innerD - 0.3].entries()) {
      beam(`ceiling_batten_${i}`, [innerX, py, roofAt(innerX) - 0.078],
        [innerX + innerW, py, roofAt(innerX + innerW) - 0.078], 0.035, 0.05, 'ceiling_z', 'roof');
    }
    const lampX = x + w / 2, lampY = y + d * 0.51;
    for (const [i, [dx, dy]] of [[0,0], [0.68,0], [-0.68,0], [0.34,0.59], [-0.34,-0.59]].entries()) {
      const points = Array.from({ length: 6 }, (_, j) => {
        const a = j * Math.PI / 3, px = lampX + dx + Math.cos(a) * 0.38;
        return [px, lampY + dy + Math.sin(a) * 0.38, roofAt(px) - 0.135];
      });
      for (let j = 0; j < 6; j++) beam(`ceiling_hex_${i}_${j}`, points[j], points[(j + 1) % 6],
        0.025, 0.025, 'lamp', 'roof');
      for (const [j, point] of [points[0], points[3]].entries()) cylinder(`ceiling_light_mount_${i}_${j}`,
        [point[0], point[1], point[2] + 0.039], 0.012, 0.078, 'steel', 'roof');
    }
    lights.push({ name: 'garage_ceiling_fill', position: [lampX, lampY, roofAt(lampX) - 0.36],
      color: '#fff4e3', power: 65, category: 'light' });

    const gate = openings.find(o => o.kind === 'gate');
    const gateY = y + d - 0.11, trackY = gateY - 0.05, trackTop = gate.h + 0.18;
    for (const [i, px] of [gate.from - 0.045, gate.from + gate.w + 0.045].entries()) {
      box(`gate_jamb_${i}`, px - 0.025, y + d - wallT, 0, 0.05, wallT + 0.015, gate.h, 'charcoal', 'S');
      for (const [j, dx] of [-0.022, 0.015].entries()) {
        box(`gate_vertical_track_${i}_${j}`, px + dx, trackY - 0.025, 0.08, 0.007, 0.05, gate.h - 0.1, 'steel', 'S', 0.001);
        box(`gate_horizontal_track_${i}_${j}`, px + dx, trackY - gate.h - 0.28, trackTop - 0.025,
          0.007, gate.h + 0.08, 0.05, 'steel', 'S', 0.001);
      }
      const curveY = trackY - 0.2, curveZ = trackTop - 0.2;
      for (let j = 0; j < 8; j++) {
        const a = j * Math.PI / 16, b = (j + 1) * Math.PI / 16;
        beam(`gate_track_curve_${i}_${j}`, [px, curveY + 0.2 * Math.cos(a), curveZ + 0.2 * Math.sin(a)],
          [px, curveY + 0.2 * Math.cos(b), curveZ + 0.2 * Math.sin(b)], 0.04, 0.018, 'steel', 'S');
      }
      for (const [j, py] of [trackY - 0.55, trackY - gate.h - 0.18].entries()) {
        box(`gate_track_hanger_${i}_${j}`, px - 0.015, py - 0.018, trackTop,
          0.03, 0.036, roofAt(px) - 0.07 - trackTop, 'steel', 'S', 0.001);
      }
    }
    box('gate_head_seal', gate.from, gateY - 0.03, gate.h - 0.012, gate.w, 0.09, 0.025, 'rubber', 'S', 0.002);
    const sections = 5, sectionH = gate.h / sections;
    for (const state of ['gateClosed', 'gateOpen']) {
      for (let i = 0; i < sections; i++) {
        const closed = state === 'gateClosed';
        const py = closed ? gateY - 0.025 : trackY - 0.2 - (i + 1) * sectionH;
        const pz = closed ? i * sectionH + 0.003 : trackTop - 0.028;
        box(`${state}_panel_${i}`, gate.from + 0.012, py, pz, gate.w - 0.024,
          closed ? 0.05 : sectionH - 0.006, closed ? sectionH - 0.006 : 0.05, 'charcoal', state, 0.008);
        for (const [j, px] of [gate.from + 0.18, gate.from + gate.w / 2, gate.from + gate.w - 0.18].entries()) {
          box(`${state}_stile_${i}_${j}`, px - 0.022, closed ? py - 0.014 : py + 0.025,
            closed ? pz + 0.025 : pz - 0.014, 0.044, closed ? 0.014 : sectionH - 0.05,
            closed ? sectionH - 0.05 : 0.014, 'steel', state, 0.001);
          if (i > 0) cylinder(`${state}_hinge_${i}_${j}`, [px, closed ? py - 0.024 : py + sectionH,
            closed ? pz : pz - 0.024], 0.014, 0.065, 'hardware', state, 'x');
        }
        for (const [j, px] of [gate.from - 0.045, gate.from + gate.w + 0.045].entries()) {
          cylinder(`${state}_roller_${i}_${j}`, [px, closed ? trackY : py + sectionH / 2,
            closed ? pz + sectionH / 2 : trackTop], 0.023, 0.028, 'rubber', state, 'x');
          cylinder(`${state}_axle_${i}_${j}`, [px + (j ? -0.038 : 0.038), closed ? trackY : py + sectionH / 2,
            closed ? pz + sectionH / 2 : trackTop], 0.006, 0.11, 'hardware', state, 'x');
        }
      }
    }
    box('gate_bottom_seal', gate.from + 0.005, gateY - 0.034, 0, gate.w - 0.01, 0.068, 0.025, 'rubber', 'gateClosed');
    const openerX = gate.from + gate.w / 2, openerY = trackY - gate.h - 0.6;
    box('opener_rail', openerX - 0.025, openerY, trackTop + 0.13, 0.05, trackY - openerY, 0.035, 'steel', 'S');
    box('opener_motor', openerX - 0.15, openerY - 0.12, trackTop + 0.08, 0.3, 0.28, 0.16, 'charcoal', 'S', 0.025);
    box('opener_mount', openerX - 0.09, openerY - 0.025, trackTop + 0.24, 0.18, 0.05,
      roofAt(openerX + 0.09) - 0.06 - trackTop - 0.24, 'steel', 'S');
    for (const [state, py] of [['gateClosed', gateY - 0.08], ['gateOpen', trackY - gate.h - 0.15]]) {
      beam(`${state}_opener_arm`, [openerX, py, trackTop + 0.135],
        [openerX, state === 'gateClosed' ? gateY - 0.027 : py, state === 'gateClosed' ? gate.h - 0.18 : trackTop - 0.04],
        0.025, 0.015, 'steel', state);
    }

    const door = openings.find(o => o.kind === 'door');
    for (const [i, py] of [door.from, door.from + door.w - 0.045].entries()) {
      box(`personnel_jamb_${i}`, x - 0.015, py, 0, wallT + 0.03, 0.045, door.h, 'charcoal', 'W');
    }
    box('personnel_head', x - 0.015, door.from, door.h - 0.045, wallT + 0.03, door.w, 0.045, 'charcoal', 'W');
    box('personnel_leaf', x + 0.07, door.from + 0.05, 0.012, 0.055, door.w - 0.1, door.h - 0.062, 'charcoal', 'W', 0.006);
    box('personnel_threshold', x - 0.025, door.from, 0, wallT + 0.05, door.w, 0.012, 'hardware', 'W', 0.002);
    for (const z of [0.25, 1.05, 1.85]) cylinder(`personnel_hinge_${z}`, [x + 0.065, door.from + 0.065, z],
      0.013, 0.085, 'hardware', 'W');
    for (const [i, px] of [x + 0.045, x + 0.16].entries()) {
      cylinder(`personnel_handle_rosette_${i}`, [px, door.from + door.w - 0.17, 1.03], 0.031, 0.012, 'hardware', 'W', 'x');
      cylinder(`personnel_handle_${i}`, [px + (i ? 0.025 : -0.025), door.from + door.w - 0.22, 1.03], 0.01, 0.14, 'hardware', 'W', 'y');
      cylinder(`personnel_handle_neck_${i}`, [px, door.from + door.w - 0.17, 1.03], 0.01, 0.07, 'hardware', 'W', 'x');
    }

    const benchX = innerX + 0.1, benchY = innerY, benchW = innerW - 0.2, benchD = workbench.d, benchH = workbench.h;
    for (let i = 0; i < 6; i++) box(`worktop_board_${i}`, benchX + i * benchW / 6, benchY, benchH - 0.075,
      benchW / 6 - 0.002, benchD + 0.05, 0.075, 'timber_y', 'furniture', 0.005);
    for (const [i, px] of [benchX + 0.1, benchX + benchW / 2 - 0.035, benchX + benchW - 0.17].entries()) {
      for (const [j, py] of [benchY + 0.065, benchY + benchD - 0.12].entries()) {
        box(`bench_leg_${i}_${j}`, px, py, 0.025, 0.07, 0.07, benchH - 0.1, 'steel', 'furniture');
        cylinder(`bench_foot_${i}_${j}`, [px + 0.035, py + 0.035, 0.015], 0.043, 0.03, 'rubber', 'furniture');
      }
    }
    for (const [i, py] of [benchY + 0.07, benchY + benchD - 0.12].entries()) {
      box(`bench_top_rail_${i}`, benchX + 0.1, py, benchH - 0.145, benchW - 0.2, 0.05, 0.07, 'steel', 'furniture');
      box(`bench_shelf_rail_${i}`, benchX + 0.1, py, 0.13, benchW - 0.2, 0.045, 0.05, 'steel', 'furniture');
    }
    box('bench_shelf', benchX + 0.1, benchY + 0.07, 0.18, benchW - 0.2, benchD - 0.14, 0.035, 'timber_x', 'furniture');
    for (const [i, px] of [benchX + 0.22, benchX + benchW - 0.95].entries()) {
      for (const [j, sideX] of [px, px + 0.68].entries()) box(`drawer_side_${i}_${j}`, sideX, benchY + 0.055, 0.37,
        0.02, benchD - 0.11, benchH - 0.445, 'steel', 'furniture');
      box(`drawer_back_${i}`, px, benchY + 0.055, 0.37, 0.7, 0.02, benchH - 0.445, 'steel', 'furniture');
      for (let j = 0; j < 3; j++) {
        const z = 0.37 + j * (benchH - 0.445) / 3;
        box(`drawer_front_${i}_${j}`, px + 0.023, benchY + benchD - 0.06, z + 0.003,
          0.654, 0.018, (benchH - 0.445) / 3 - 0.006, 'toolBlue', 'furniture');
        box(`drawer_bottom_${i}_${j}`, px + 0.023, benchY + 0.078, z + 0.005, 0.654, benchD - 0.14, 0.015, 'steel', 'furniture');
        cylinder(`drawer_pull_${i}_${j}`, [px + 0.35, benchY + benchD - 0.008, z + 0.065], 0.009, 0.24, 'hardware', 'furniture', 'x');
        for (const [k, dx] of [0.23,0.47].entries()) cylinder(`drawer_pull_mount_${i}_${j}_${k}`,
          [px + dx, benchY + benchD - 0.026, z + 0.065], 0.009, 0.036, 'hardware', 'furniture', 'y');
      }
    }

    const boardX = benchX + 0.13, boardY = innerY + 0.025, boardZ = benchH + 0.19, boardW = benchW - 0.26, boardH = 0.96;
    const gridX = Math.ceil(boardW / 0.12), gridZ = 8;
    for (let i = 0; i <= gridX; i++) box(`pegboard_vertical_${i}`, boardX + i * boardW / gridX - 0.012,
      boardY, boardZ, 0.024, 0.018, boardH, 'steel', 'N', 0.001);
    for (let i = 0; i <= gridZ; i++) box(`pegboard_horizontal_${i}`, boardX - 0.012, boardY - 0.001,
      boardZ + i * boardH / gridZ - 0.012, boardW + 0.024, 0.02, 0.024, 'steel', 'N', 0.001);
    const toolY = boardY + 0.055, toolZ = boardZ + 0.55;
    const hammerX = benchX + 0.7;
    cylinder('hammer_handle', [hammerX, toolY, toolZ - 0.105], 0.022, 0.3, 'timber_z', 'N');
    cylinder('hammer_head', [hammerX, toolY, toolZ + 0.07], 0.031, 0.16, 'hardware', 'N', 'x');
    for (let i = 0; i < 4; i++) {
      const px = benchX + 1.22 + i * 0.18, length = 0.29 - i * 0.025;
      box(`wrench_shaft_${i}`, px - 0.012, toolY - 0.008, toolZ - length / 2, 0.024, 0.016, length, 'hardware', 'N');
      for (let j = 0; j < 8; j++) {
        const a = j * Math.PI / 4, b = (j + 1) * Math.PI / 4;
        beam(`wrench_ring_${i}_${j}`, [px + Math.cos(a) * 0.026, toolY, toolZ + length / 2 + Math.sin(a) * 0.026],
          [px + Math.cos(b) * 0.026, toolY, toolZ + length / 2 + Math.sin(b) * 0.026], 0.016, 0.016, 'hardware', 'N');
      }
      for (const [j, dx] of [-0.025,0.011].entries()) box(`wrench_jaw_${i}_${j}`, px + dx, toolY - 0.008,
        toolZ - length / 2 - 0.033, 0.014, 0.016, 0.045, 'hardware', 'N');
    }
    for (let i = 0; i < 5; i++) {
      const px = benchX + 2.35 + i * 0.16;
      cylinder(`screwdriver_grip_${i}`, [px, toolY, toolZ + 0.025], 0.021, 0.11,
        ['toolRed','toolBlue','toolOchre'][i % 3], 'N');
      cylinder(`screwdriver_shaft_${i}`, [px, toolY, toolZ - 0.095], 0.006, 0.13, 'hardware', 'N');
    }
    for (let i = 0; i < 11; i++) {
      const px = benchX + 0.7 + i * 0.24;
      cylinder(`tool_hook_${i}`, [px, boardY + 0.03, toolZ + 0.05], 0.007, 0.065, 'hardware', 'N', 'y');
    }
    box('bench_task_light_housing', benchX + 0.1, benchY + 0.055, boardZ + boardH + 0.02,
      benchW - 0.2, 0.08, 0.045, 'charcoal', 'N');
    box('bench_task_light_lens', benchX + 0.13, benchY + 0.065, boardZ + boardH + 0.012,
      benchW - 0.26, 0.06, 0.009, 'lamp', 'N');
    for (let i = 0; i < 5; i++) lights.push({ name: `garage_bench_light_${i}`,
      position: [benchX + 0.5 + i * (benchW - 1) / 4, benchY + 0.24, boardZ + boardH - 0.06],
      color: '#fff0d8', power: 1.5, category: 'N' });

    const viceX = benchX + benchW - 0.58, viceY = benchY + benchD - 0.15;
    cylinder('vice_base', [viceX,viceY,benchH+0.023], 0.12, 0.046, 'steel', 'furniture');
    box('vice_body', viceX - 0.055, viceY - 0.09, benchH + 0.045, 0.11, 0.25, 0.09, 'toolBlue', 'furniture', 0.012);
    for (const [i, py] of [viceY - 0.08, viceY + 0.1].entries()) {
      box(`vice_jaw_body_${i}`, viceX - 0.09, py, benchH + 0.09, 0.18, 0.045, 0.065, 'steel', 'furniture');
      box(`vice_jaw_insert_${i}`, viceX - 0.085, py + (i ? -0.006 : 0.045), benchH + 0.117,
        0.17, 0.006, 0.03, 'hardware', 'furniture', 0.001);
    }
    cylinder('vice_screw', [viceX, viceY + 0.14, benchH + 0.073], 0.016, 0.25, 'hardware', 'furniture', 'y');
    cylinder('vice_handle', [viceX, viceY + 0.27, benchH + 0.073], 0.009, 0.23, 'hardware', 'furniture', 'x');
    for (const dx of [-0.12,0.12]) cylinder(`vice_handle_stop_${dx}`, [viceX+dx,viceY+0.27,benchH+0.073], 0.016, 0.022, 'steel', 'furniture', 'x');
    const caseX = benchX + 1.13, caseY = benchY + 0.17, caseZ = 0.215;
    box('toolbox_body', caseX, caseY, caseZ, 0.52, 0.31, 0.19, 'toolRed', 'furniture', 0.012);
    box('toolbox_lid', caseX - 0.008, caseY - 0.006, caseZ + 0.19, 0.536, 0.322, 0.038, 'toolRed', 'furniture', 0.01);
    for (const [i, px] of [caseX + 0.11,caseX + 0.38].entries()) {
      box(`toolbox_latch_${i}`, px, caseY + 0.31, caseZ + 0.135, 0.033, 0.012, 0.075, 'hardware', 'furniture');
      box(`toolbox_handle_mount_${i}`, px, caseY + 0.13, caseZ + 0.225, 0.03, 0.04, 0.04, 'charcoal', 'furniture');
    }
    box('toolbox_handle', caseX + 0.11, caseY + 0.13, caseZ + 0.26, 0.3, 0.04, 0.025, 'rubber', 'furniture', 0.008);
    return { name: 'Garage', materials, parts, lights, floorHeight, groundPatch: groundPatch(garden, floorHeight),
      categoryVisibility: { gateOpen: false },
      dims: { rect, wallT, wallTop: floorHeight + wallTop, roofHigh: floorHeight + roofHigh, pitch, floorY: floorHeight } };
  }
  return { build, groundPatch };
})();
if (typeof module !== 'undefined') module.exports = { GarageModel };
