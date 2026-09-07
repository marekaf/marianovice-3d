const OfficeFurniture = (() => {
  function build(id, { standing = false, shelfLed = true } = {}) {
    if (!['1.05', '1.08'].includes(id)) throw new Error(`Unsupported office ${id}`);
    const main = id === '1.05', parts = [], footprints = [], lights = [], notes = [
      'Concept furniture, not a measured fit-out or certified ergonomic specification.',
      'Desk heights and eye levels are proposals to test with the users.',
    ];
    const materials = {
      oak: { color: '#c6a982', roughness: 0.72 }, oakEdge: { color: '#af906b', roughness: 0.76 },
      cashmere: { color: '#b8b2a7', roughness: 0.82 },
      charcoal: { color: '#303634', roughness: 0.48, metalness: 0.48 }, metal: { color: '#858b88', roughness: 0.34, metalness: 0.8 },
      black: { color: '#151d1f', roughness: 0.65 }, screen: { color: '#26434d', roughness: 0.23, emissive: '#203b44', emissiveIntensity: 0.3 },
      linen: { color: '#b6aaa0', roughness: 0.98 }, cushion: { color: '#cbc0ae', roughness: 0.98 },
      chair: { color: '#65736f', roughness: 0.94 }, clay: { color: '#ab7866', roughness: 0.87 },
      leather: { color: '#665247', roughness: 0.55 }, walnut: { color: '#73543d', roughness: 0.72 },
      tray: { color: '#d8d6cb', roughness: 0.76 }, blue: { color: '#4e7b92', roughness: 0.52 },
      red: { color: '#b75e4c', roughness: 0.52 }, yellow: { color: '#cdb06e', roughness: 0.55 },
      green: { color: '#6e8772', roughness: 0.59 }, glass: { color: '#d5e4e3', roughness: 0.08, transmission: 0.8 },
      paper: { color: '#ece7dc', roughness: 0.94 }, light: { color: '#f0d8b0', roughness: 0.5, emissive: '#efcd8d', emissiveIntensity: 0.3 },
      catFur: { color: '#202124', roughness: 1 }, catWhite: { color: '#f1eee8', roughness: 1 },
      catEye: { color: '#77777a', roughness: 1 }, catPink: { color: '#bf8e88', roughness: 0.95 },
      catCollar: { color: '#435451', roughness: 0.9 },
      shelfDiffuser: { color: '#f4f0e8', roughness: 0.5, emissive: '#fff0dc', emissiveIntensity: shelfLed ? 3 : 0 },
    };
    const box = (name, x, z, y, w, d, h, material = 'oak', bevel = 0.004) => parts.push({
      name, type: 'box', position: [x + w / 2, z + d / 2, y + h / 2], size: [w, d, h], material, bevel, category: 'furniture',
    });
    const beam = (name, start, end, width, depth, material = 'charcoal') => parts.push({ name, type: 'beam', start, end, width, depth, material, bevel: 0.003, category: 'furniture' });
    const cylinder = (name, position, radius, height, material = 'charcoal', axis = 'z') => parts.push({ name, type: 'cylinder', position, radiusTop: radius, radiusBottom: radius, height, material, axis, segments: 20, category: 'furniture' });
    const sphere = (name, position, size, material) => parts.push({ name, type: 'sphere', position, size, material, category: 'furniture' });
    const footprint = (name, x, z, w, d) => footprints.push({ name, x0: x, z0: z, x1: x + w, z1: z + d });
    const deskTop = main ? (standing ? 1.12 : 0.74) : (standing ? 0.98 : 0.66);
    const deskX = 0.55, deskZ = main ? 12.48 : 7.47, direction = main ? -1 : 1;
    const desk = { x: deskX + 0.9, z: deskZ + 0.4, seatedTop: main ? 0.74 : 0.66,
      standingTop: main ? 1.12 : 0.98, top: deskTop, eyeSeated: main ? 1.2 : 1.06,
      eyeStanding: main ? 1.68 : 1.46, facing: [0, direction] };

    function deskFrame(name, x, z, w, d, top, adjustable) {
      footprint(name, x, z, w, d);
      box(`${name}_top`, x, z, top - 0.03, w, d, 0.03, 'oak', 0.009);
      if (!adjustable) {
        for (const [i, px] of [x + 0.08, x + w - 0.14].entries()) {
          for (const [j, pz] of [z + 0.08, z + d - 0.14].entries()) {
            box(`${name}_leg_${i}_${j}`, px, pz, 0, 0.06, 0.06, top - 0.03, 'oak');
          }
        }
        for (const [i, pz] of [z + 0.10, z + d - 0.12].entries()) box(`${name}_apron_${i}`, x + 0.1, pz, top - 0.11, w - 0.2, 0.02, 0.08, 'oak');
        return;
      }
      for (const [i, px] of [x + 0.18, x + w - 0.18].entries()) {
        box(`${name}_foot_${i}`, px - 0.055, z + 0.08, 0.016, 0.11, d - 0.16, 0.04, 'charcoal', 0.015);
        for (const [j, pz] of [z + 0.12, z + d - 0.12].entries()) cylinder(`${name}_glide_${i}_${j}`, [px, pz, 0.012], 0.035, 0.024, 'black');
        box(`${name}_column_${i}`, px - 0.04, z + d / 2 - 0.04, 0.056, 0.08, 0.08, adjustable ? 0.42 : top - 0.11, 'charcoal');
        if (adjustable) {
          box(`${name}_telescope_${i}`, px - 0.031, z + d / 2 - 0.031, 0.43, 0.062, 0.062, top - 0.48, 'metal');
          box(`${name}_upper_column_${i}`, px - 0.025, z + d / 2 - 0.025, top - 0.21, 0.05, 0.05, 0.16, 'charcoal');
        }
        box(`${name}_top_bracket_${i}`, px - 0.06, z + 0.09, top - 0.06, 0.12, d - 0.18, 0.03, 'charcoal');
      }
      box(`${name}_crossbeam`, x + 0.18, z + d / 2 - 0.027, top - 0.095, w - 0.36, 0.054, 0.04, 'charcoal');
    }
    deskFrame('work_desk', deskX, deskZ, 1.8, 0.8, deskTop, true);
    const shelfWidth = main ? 3.60 : 1.80, shelfHeight = 0.30, shelfDepth = 0.22, shelfBoard = 0.018;
    const shelfBays = main ? 8 : 4;
    const shelfX = (main ? 2.45 : desk.x) - shelfWidth / 2, shelfZ = main ? 12.46 : 8.29 - shelfDepth, shelfBottom = 1.80;
    box('wall_cubby_bottom', shelfX, shelfZ, shelfBottom, shelfWidth, shelfDepth, shelfBoard);
    box('wall_cubby_top', shelfX, shelfZ, shelfBottom + shelfHeight - shelfBoard, shelfWidth, shelfDepth, shelfBoard);
    const cubbyClearWidth = (shelfWidth - shelfBoard * (shelfBays + 1)) / shelfBays;
    for (let i = 0; i <= shelfBays; i++) {
      box(`wall_cubby_divider_${i}`, shelfX + i * (cubbyClearWidth + shelfBoard), shelfZ,
        shelfBottom + shelfBoard, shelfBoard, shelfDepth, shelfHeight - 2 * shelfBoard);
    }
    if (main) {
      const stripX = shelfX + 0.05, stripZ = shelfZ + shelfDepth - 0.055, stripWidth = shelfWidth - 0.1;
      box('shelf_led_profile_back', stripX, stripZ, shelfBottom - 0.002, stripWidth, 0.018, 0.002, 'metal', 0);
      for (const [i, z] of [stripZ, stripZ + 0.016].entries()) box(`shelf_led_profile_edge_${i}`, stripX, z, shelfBottom - 0.009, stripWidth, 0.002, 0.007, 'metal', 0);
      box('shelf_led_diffuser', stripX + 0.002, stripZ + 0.003, shelfBottom - 0.007, stripWidth - 0.004, 0.012, 0.003, 'shelfDiffuser', 0.001);
      for (let i = 0; i < 8; i++) lights.push({ name: `shelf_led_light_${i}`, position: [stripX + (i + 0.5) * stripWidth / 8, stripZ + 0.009, shelfBottom - 0.014], color: '#fff0dc', power: shelfLed ? 24 : 0, category: 'furniture' });
    }
    notes.push(`${shelfBays}-compartment wall shelf: custom ${Math.round(shelfWidth * 100)}×30×22 cm, 18 mm board. Bottom at 1.80 m above the floor to clear the raised monitor.${main ? ' Underside LED profile spans both desks; light colour and output are indicative.' : ''}`);
    const userEdge = direction < 0 ? deskZ + 0.8 : deskZ;
    const monitorZ = direction < 0 ? deskZ + 0.16 : deskZ + 0.64;
    const keyboardZ = direction < 0 ? deskZ + 0.51 : deskZ + 0.19;
    box('monitor_base', desk.x - 0.16, monitorZ - 0.09, deskTop, 0.32, 0.18, 0.015, 'charcoal', 0.014);
    beam('monitor_stem', [desk.x, monitorZ, deskTop + 0.015], [desk.x, monitorZ, deskTop + 0.24], 0.035, 0.045);
    const monitorW = main ? 1.19 : 0.65, monitorH = main ? 0.34 : 0.37;
    box('monitor_frame', desk.x - monitorW / 2, monitorZ - 0.025, deskTop + 0.14, monitorW, 0.05, monitorH, 'black', 0.012);
    const screenZ = monitorZ - direction * 0.026;
    box('monitor_display', desk.x - monitorW / 2 + 0.009, screenZ - 0.001, deskTop + 0.149, monitorW - 0.018, 0.002, monitorH - 0.02, 'screen', 0.004);
    box('keyboard', desk.x - 0.24, keyboardZ - 0.075, deskTop, 0.43, 0.15, 0.018, 'charcoal', 0.008);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 13; col++) box(`key_${row}_${col}`, desk.x - 0.227 + col * 0.031, keyboardZ - 0.062 + row * 0.031, deskTop + 0.018, 0.023, 0.023, 0.003, 'tray', 0.002);
    const keyboardCenterX = desk.x - 0.025, seatedRight = -direction;
    box('mouse_mat', keyboardCenterX + seatedRight * 0.39 - 0.125, keyboardZ - 0.10, deskTop, 0.25, 0.22, 0.003, 'chair');
    sphere('mouse', [keyboardCenterX + seatedRight * 0.365, keyboardZ, deskTop + 0.023], [0.065, 0.11, 0.04], 'tray');
    box('laptop_base', deskX + 0.05, deskZ + 0.28, deskTop, 0.30, 0.22, 0.014, 'metal');
    box('laptop_lid', deskX + 0.05, direction < 0 ? deskZ + 0.28 : deskZ + 0.49, deskTop + 0.014, 0.30, 0.012, 0.18, 'charcoal');
    const trayZ = direction < 0 ? deskZ + 0.12 : deskZ + 0.59;
    box('cable_tray_base', deskX + 0.4, trayZ, deskTop - 0.12, 1.0, 0.11, 0.012, 'charcoal');
    for (const [i, px] of [deskX + 0.43, deskX + 1.34].entries()) box(`cable_tray_hanger_${i}`, px, trayZ + 0.035, deskTop - 0.11, 0.02, 0.04, 0.08, 'charcoal');
    box('desk_controller', deskX + 1.48, userEdge - (direction < 0 ? 0.035 : 0), deskTop - 0.055, 0.14, 0.035, 0.025, 'charcoal');
    if (main) notes.push('Monitor is a generic 49-inch-class ultrawide placeholder, not a selected product.');

    function chair(x, z) {
      const firstPart = parts.length;
      footprint('desk_chair', x - 0.35, z - 0.36, 0.7, 0.72);
      const seat = main ? 0.46 : 0.40;
      cylinder('chair_lift', [x, z, seat / 2], 0.028, seat - 0.12, 'metal');
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5, px = x + Math.cos(a) * 0.29, pz = z + Math.sin(a) * 0.29;
        beam(`chair_spoke_${i}`, [x, z, 0.15], [px, pz, 0.075], 0.027, 0.028);
        sphere(`chair_caster_${i}`, [px, pz, 0.04], [0.065, 0.065, 0.08], 'black');
      }
      box('chair_seat', x - 0.255, z - 0.25, seat - 0.07, 0.51, 0.50, 0.07, 'chair', 0.03);
      const backZ = z - direction * 0.22;
      beam('chair_back_spine', [x, z, seat - 0.08], [x, backZ, seat + 0.40], 0.035, 0.035);
      box('chair_back', x - 0.235, backZ - 0.04, seat + 0.02, 0.47, 0.08, 0.49, 'chair', 0.035);
      sphere('chair_lumbar', [x, backZ + direction * 0.045, seat + 0.18], [0.35, 0.055, 0.15], 'chair');
      for (const [i, px] of [x - 0.285, x + 0.285].entries()) {
        beam(`chair_arm_mount_${i}`, [x + (i ? 0.22 : -0.22), z, seat - 0.04], [px, z, seat + 0.17], 0.024, 0.024);
        box(`chair_arm_${i}`, px - 0.035, z - 0.15, seat + 0.16, 0.07, 0.29, 0.035, 'black', 0.014);
      }
      for (let i = firstPart; i < parts.length; i++) parts[i].category = 'chair';
    }
    if (!standing) chair(desk.x, userEdge - direction * 0.43);
    else notes.push('Desk chair omitted in standing view so the working position remains visible.');

    function cabinet(name, x, z, w, d, bottom, h, glazed = false) {
      footprint(name, x, z, w, d);
      box(`${name}_base`, x, z, bottom, w, d, 0.025);
      box(`${name}_top`, x, z, bottom + h - 0.025, w, d, 0.025);
      for (const [i, px] of [x, x + w - 0.025].entries()) box(`${name}_side_${i}`, px, z, bottom, 0.025, d, h);
      box(`${name}_back`, x, z + d - 0.012, bottom, w, 0.012, h);
      for (let i = 1; i < 3; i++) box(`${name}_shelf_${i}`, x + 0.025, z + 0.018, bottom + i * h / 3, w - 0.05, d - 0.03, 0.02);
      const n = Math.round(w / 0.55);
      for (let i = 0; i < n; i++) {
        const px = x + i * w / n;
        box(`${name}_front_${i}`, px + 0.003, z - 0.002, bottom + 0.025, w / n - 0.006, 0.015, h - 0.05, glazed ? 'glass' : 'oak');
        box(`${name}_pull_${i}`, px + w / n - 0.045, z - 0.015, bottom + h * 0.47, 0.012, 0.022, 0.10, 'charcoal');
      }
    }
    function brick(name, x, z, bottom, w, d, material) {
      box(name, x, z, bottom, w, d, 0.024, material, 0.002);
      for (let i = 0; i < Math.max(1, Math.floor(w / 0.025)); i++) for (let j = 0; j < Math.max(1, Math.floor(d / 0.025)); j++) cylinder(`${name}_stud_${i}_${j}`, [x + 0.0125 + i * 0.025, z + 0.0125 + j * 0.025, bottom + 0.026], 0.007, 0.005, material);
    }
    if (main) {
      const legoX = 2.45;
      deskFrame('lego_desk', legoX, 12.48, 1.8, 0.8, 0.74, false);
      for (let i = 0; i < 5; i++) {
        const px = legoX + 0.09 + i * 0.29, pz = 12.58;
        box(`sorting_tray_${i}_bottom`, px, pz, 0.74, 0.24, 0.24, 0.008, 'tray');
        for (const [j, ex] of [px, px + 0.232].entries()) box(`sorting_tray_${i}_side_${j}`, ex, pz, 0.748, 0.008, 0.24, 0.045, 'tray');
        for (const [j, ez] of [pz, pz + 0.232].entries()) box(`sorting_tray_${i}_end_${j}`, px, ez, 0.748, 0.24, 0.008, 0.045, 'tray');
        brick(`sorted_brick_${i}`, px + 0.035, pz + 0.045, 0.748, 0.075, 0.05, ['red', 'blue', 'yellow', 'green', 'tray'][i]);
      }
      box('lego_build_mat', legoX + 0.52, 12.91, 0.74, 0.64, 0.31, 0.008, 'green');
      for (let i = 0; i < 5; i++) brick(`lego_model_${i}`, legoX + 0.59 + i * 0.095, 13.01, 0.748, 0.075, 0.075, ['tray', 'blue', 'yellow', 'clay', 'red'][i]);
      notes.push('Window side: height-adjustable work desk with one compartmented wall shelf. Door side: fixed LEGO table at 74 cm.');
      const displayX = 0.55, armchairX = 3.50;
      cabinet('south_storage', displayX, 15.13, 2.2, 0.4, 0, 0.80);
      cabinet('south_display', displayX, 15.16, 2.2, 0.37, 0.80, 1.05, true);
      for (let i = 0; i < 4; i++) {
        const px = displayX + 0.12 + i * 0.51;
        box(`display_plinth_${i}`, px, 15.21, 0.825, 0.32, 0.24, 0.015, 'black');
        brick(`display_model_${i}`, px + 0.035, 15.25, 0.84, 0.20, 0.125, i % 2 ? 'blue' : 'tray');
        brick(`display_model_upper_${i}`, px + 0.07, 15.275, 0.868, 0.125, 0.075, i % 2 ? 'tray' : 'red');
      }
      const armchairFirstPart = parts.length;
      const armchairCenterX = armchairX + 0.4, armchairCenterZ = 14.94;
      footprint('concept_armchair', armchairCenterX - 0.43, armchairCenterZ - 0.4, 0.87, 0.8);
      cylinder('armchair_swivel', [armchairX + 0.4, 14.94, 0.18], 0.045, 0.24, 'metal');
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5, px = armchairX + 0.4 + Math.cos(angle) * 0.34, pz = 14.94 + Math.sin(angle) * 0.34;
        beam(`armchair_base_spoke_${i}`, [armchairX + 0.4, 14.94, 0.11], [px, pz, 0.025], 0.045, 0.028, 'metal');
        cylinder(`armchair_glide_${i}`, [px, pz, 0.012], 0.025, 0.024, 'black');
      }
      box('armchair_base', armchairX + 0.05, 14.54, 0.28, 0.7, 0.78, 0.10, 'walnut', 0.035);
      box('armchair_seat', armchairX + 0.09, 14.56, 0.37, 0.62, 0.63, 0.12, 'leather', 0.045);
      box('armchair_back_shell', armchairX + 0.05, 15.23, 0.35, 0.7, 0.13, 0.72, 'walnut', 0.045);
      box('armchair_back', armchairX + 0.08, 15.14, 0.46, 0.64, 0.16, 0.47, 'leather', 0.065);
      box('armchair_headrest', armchairX + 0.11, 15.14, 0.91, 0.58, 0.17, 0.21, 'leather', 0.065);
      for (const [i, px] of [armchairX, armchairX + 0.69].entries()) {
        box(`armchair_side_${i}`, px + 0.018, 14.66, 0.32, 0.075, 0.58, 0.24, 'walnut', 0.025);
        box(`armchair_arm_${i}`, px, 14.62, 0.54, 0.11, 0.62, 0.09, 'leather', 0.035);
      }
      const faceWindow = ([x, z, y]) => [armchairCenterX + z - armchairCenterZ, armchairCenterZ - x + armchairCenterX, y];
      for (const part of parts.slice(armchairFirstPart)) {
        if (part.position) part.position = faceWindow(part.position);
        if (part.start) { part.start = faceWindow(part.start); part.end = faceWindow(part.end); }
        if (part.size) part.size = [part.size[1], part.size[0], part.size[2]];
      }
      notes.push('LEGO models and sorting contents are adjustable placeholders. Leather swivel armchair is an upright 0.80×0.87 m concept, not an exact product; reclined fit is not established.');
    } else {
      footprint('sofa', 0.65, 4.33, 2.1, 0.85);
      for (const [i, px] of [0.77, 2.63].entries()) for (const [j, pz] of [4.43, 5.06].entries()) box(`sofa_leg_${i}_${j}`, px - 0.025, pz - 0.025, 0, 0.05, 0.05, 0.16, 'oak');
      box('sofa_base', 0.65, 4.33, 0.14, 2.1, 0.85, 0.22, 'linen', 0.045);
      box('sofa_back', 0.65, 4.33, 0.34, 2.1, 0.19, 0.49, 'linen', 0.055);
      for (let i = 0; i < 2; i++) {
        box(`sofa_seat_${i}`, 0.79 + i * 0.91, 4.52, 0.35, 0.88, 0.59, 0.11, 'cushion', 0.035);
        box(`sofa_back_cushion_${i}`, 0.80 + i * 0.90, 4.46, 0.48, 0.86, 0.14, 0.30, 'cushion', 0.045);
      }
      for (const [i, px] of [0.65, 2.62].entries()) box(`sofa_arm_${i}`, px, 4.37, 0.33, 0.13, 0.76, 0.27, 'linen', 0.045);
      sphere('cat_body', [1.31, 4.78, 0.565], [0.45, 0.31, 0.21], 'catWhite');
      sphere('cat_haunch', [1.46, 4.78, 0.565], [0.23, 0.28, 0.20], 'catWhite');
      const furPatch = (name, center, size, theta0, theta1, phi0, phi1) => {
        const vertices = [], faces = [], steps = 16;
        for (let row = 0; row <= steps; row++) for (let col = 0; col <= steps; col++) {
          const theta = theta0 + (theta1 - theta0) * row / steps;
          const phi = phi0 + (phi1 - phi0) * col / steps;
          vertices.push([center[0] + (size[0] / 2 + 0.001) * Math.sin(theta) * Math.cos(phi),
            center[1] + (size[1] / 2 + 0.001) * Math.sin(theta) * Math.sin(phi),
            center[2] + (size[2] / 2 + 0.001) * Math.cos(theta)]);
          if (row < steps && col < steps) {
            const a = row * (steps + 1) + col;
            faces.push([a, a + steps + 1, a + steps + 2, a + 1]);
          }
        }
        parts.push({ name, type: 'mesh', vertices, faces, material: 'catFur', category: 'furniture' });
      };
      furPatch('cat_back_patch', [1.31, 4.78, 0.565], [0.45, 0.31, 0.21], 0.18, 1.62, 3.25, 5.85);
      furPatch('cat_hip_patch', [1.46, 4.78, 0.565], [0.23, 0.28, 0.20], 0.65, 1.85, -0.8, 1.25);
      for (let i = 0; i < 18; i++) {
        const angle = -0.6 + i * 0.18, radius = 0.075 - i * 0.0018;
        sphere(`cat_tail_${i}`, [1.32 + Math.cos(angle) * 0.225, 4.78 + Math.sin(angle) * 0.158, 0.505],
          [radius, radius, radius], 'catFur');
      }
      sphere('cat_chest', [1.20, 4.855, 0.55], [0.20, 0.18, 0.14], 'catWhite');
      sphere('cat_paw_left', [1.16, 4.93, 0.49], [0.11, 0.075, 0.055], 'catWhite');
      sphere('cat_paw_right', [1.24, 4.94, 0.49], [0.10, 0.07, 0.05], 'catWhite');
      sphere('cat_head', [1.13, 4.855, 0.56], [0.19, 0.18, 0.16], 'catFur');
      cylinder('cat_collar', [1.205, 4.855, 0.55], 0.07, 0.012, 'catCollar', 'x');
      for (const [i, x] of [1.065, 1.19].entries()) {
        parts.push({ name: `cat_ear_${i}`, type: 'mesh', vertices: [
          [x - 0.035, 4.83, 0.605], [x + 0.035, 4.83, 0.605], [x, 4.825, 0.69], [x, 4.785, 0.605],
        ], faces: [[0, 1, 2], [1, 3, 2], [3, 0, 2], [0, 3, 1]], material: 'catFur', category: 'furniture' });
        beam(`cat_closed_eye_${i}`, [x - 0.018, 4.925, 0.575], [x + 0.018, 4.928, 0.57], 0.005, 0.005, 'catEye');
      }
      sphere('cat_muzzle', [1.13, 4.935, 0.535], [0.082, 0.035, 0.055], 'catWhite');
      sphere('cat_face_blaze', [1.155, 4.937, 0.554], [0.024, 0.018, 0.060], 'catWhite');
      sphere('cat_nose', [1.13, 4.954, 0.55], [0.018, 0.012, 0.012], 'catFur');
      footprint('east_storage', 3.55, 7.2, 0.4, 1.0);
      box('east_storage_base', 3.55, 7.2, 0, 0.4, 1.0, 0.025);
      box('east_storage_top', 3.55, 7.2, 0.775, 0.4, 1.0, 0.025);
      for (const [i, pz] of [7.2, 8.175].entries()) box(`east_storage_side_${i}`, 3.55, pz, 0, 0.4, 0.025, 0.8);
      box('east_storage_back', 3.938, 7.2, 0, 0.012, 1.0, 0.8);
      box('east_storage_shelf', 3.57, 7.225, 0.4, 0.36, 0.95, 0.02);
      for (let i = 0; i < 2; i++) {
        box(`east_storage_front_${i}`, 3.55, 7.203 + i * 0.5, 0.025, 0.016, 0.494, 0.75);
        box(`east_storage_pull_${i}`, 3.535, 7.39 + i * 0.5, 0.40, 0.025, 0.10, 0.012, 'charcoal');
      }
      for (let i = 0; i < 5; i++) box(`storage_book_${i}`, 3.62, 7.38 + i * 0.035, 0.80, 0.21, 0.027, 0.22 + i % 2 * 0.035, ['paper', 'clay', 'chair'][i % 3]);
      for (const part of parts.filter(part => part.name.startsWith('east_storage_') || part.name.startsWith('storage_book_'))) part.position[0] -= 0.015;
      const storageFootprint = footprints.find(item => item.name === 'east_storage');
      storageFootprint.x0 -= 0.015;
      storageFootprint.x1 -= 0.015;
    }
    desk.z = userEdge - direction * 0.43;
    for (const part of parts) {
      if (part.material === 'oak' && /^(wall_cubby_|south_storage_|south_display_|east_storage_)/.test(part.name)) part.material = 'cashmere';
    }
    notes.push('Visible storage boards use U702 ST9 cashmere-grey as an approximate screen colour. Desk finishes remain proposals.');
    return { name: `${id} office proposal`, parts, materials, lights, floorHeight: 0, footprints, desk, notes };
  }
  return { build };
})();
if (typeof module !== 'undefined') module.exports = { OfficeFurniture };
