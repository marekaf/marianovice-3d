const PergolaModel = (() => {
  function build(garden) {
    const element = garden.elements.find(e => e.id === 'pergola');
    const footprint = element.parts.find(p => p.kind === 'rect');
    const paving = element.parts.find(p => p.role === 'paving');
    const table = element.parts.find(p => p.role === 'table');
    const { x, y, w, d } = footprint;
    const floorHeight = element.meta.grading.level + 0.1;
    const groundPatch = { x, y, w, d, ...element.meta.grading };
    const materials = {
      steel: { color: '#33383a', roughness: 0.42, metalness: 0.7 },
      hardware: { color: '#aaa8a0', roughness: 0.28, metalness: 0.85 },
      foundation: { color: '#85857d', roughness: 0.92 },
      joints: { color: '#77776e', roughness: 0.95 },
      ceramic: { color: '#e4ded0', roughness: 0.22 },
      glass: { color: '#f2f7f5', roughness: 0.025, transmission: 1 },
      lamp: { color: '#f6dfb6', roughness: 0.6, emissive: '#ffd19a', emissiveIntensity: 1.3 },
    };
    for (const axis of ['x', 'y', 'z']) {
      materials['frame_' + axis] = { color: '#98734f', roughness: 0.72, grain: axis };
      materials['furniture_' + axis] = { color: '#ae865d', roughness: 0.62, grain: axis };
    }
    for (let i = 0; i < 4; i++) materials['paving_' + i] = {
      color: ['#bdb9af', '#c4c0b7', '#b6b4aa', '#c1bdb2'][i], roughness: 0.82,
    };
    const parts = [], lights = [];
    const box = (name, x0, y0, z0, width, depth, height, material, category = 'structure', bevel = 0.004) => {
      parts.push({ name, type: 'box', position: [x0 + width / 2, y0 + depth / 2, z0 + height / 2],
        size: [width, depth, height], material, category, bevel });
    };
    const beam = (name, start, end, width, depth, material, category = 'structure') => {
      parts.push({ name, type: 'beam', start, end, width, depth, material, category, bevel: 0.004 });
    };
    const cylinder = (name, position, radius, height, material, axis = 'z', category = 'structure') => {
      parts.push({ name, type: 'cylinder', position, radiusTop: radius, radiusBottom: radius,
        height, axis, material, category, segments: 24 });
    };
    const lathe = (name, position, profile, material) => {
      parts.push({ name, type: 'lathe', position, profile, material, category: 'furniture', segments: 40 });
    };

    box('pergola_subbase', paving.x, paving.y, -0.45, paving.w, paving.d, 0.39, 'foundation', 'structure', 0.01);
    box('pergola_bedding', paving.x, paving.y, -0.065, paving.w, paving.d, 0.025, 'joints', 'structure', 0);
    for (let row = 0; row < Math.ceil(paving.d / 0.4); row++) {
      const depth = Math.min(0.4, paving.d - row * 0.4);
      if (depth < 0.01) continue;
      const offset = row % 2 ? -0.3 : 0;
      for (let col = 0; col < Math.ceil((paving.w - offset) / 0.6); col++) {
        const left = Math.max(0, offset + col * 0.6), right = Math.min(paving.w, offset + (col + 1) * 0.6);
        if (right - left < 0.01) continue;
        box(`paver_${row}_${col}`, paving.x + left + 0.003, paving.y + row * 0.4 + 0.003, -0.04,
          right - left - 0.006, depth - 0.006, 0.04, 'paving_' + ((col * 7 + row * 3) % 4), 'structure', 0.003);
      }
    }
    const postInset = 0.16, postWidth = 0.16, beamBottom = 2.30, beamTop = 2.56;
    const corners = [[x+postInset,y+postInset], [x+w-postInset,y+postInset],
      [x+postInset,y+d-postInset], [x+w-postInset,y+d-postInset]];
    for (const [i, [px, py]] of corners.entries()) {
      box(`post_footing_${i}`, px - 0.17, py - 0.17, -0.55, 0.34, 0.34, 0.49, 'foundation', 'structure', 0.01);
      box(`post_plate_${i}`, px - 0.12, py - 0.12, -0.06, 0.24, 0.24, 0.025, 'steel');
      for (const [j, dx] of [-0.086, 0.074].entries()) {
        box(`post_shoe_${i}_${j}`, px + dx, py - 0.08, -0.045, 0.012, 0.16, 0.23, 'steel', 'structure', 0.002);
      }
      box(`post_${i}`, px - postWidth / 2, py - postWidth / 2, -0.035,
        postWidth, postWidth, beamBottom + 0.035, 'frame_z');
      for (const z of [0.07, 0.14]) cylinder(`post_bolt_${i}_${z}`, [px, py, z], 0.012, 0.186, 'hardware', 'x');
      for (const [j, [dx, dy]] of [[-0.088,-0.088], [0.088,-0.088], [-0.088,0.088], [0.088,0.088]].entries()) {
        cylinder(`anchor_${i}_${j}`, [px + dx, py + dy, -0.028], 0.012, 0.03, 'hardware');
      }
      const inwardX = i % 2 === 0 ? 1 : -1, inwardY = i < 2 ? 1 : -1;
      beam(`brace_x_${i}`, [px, py, 1.72], [px + inwardX * 0.64, py, 2.35], 0.085, 0.11, 'frame_z');
      beam(`brace_y_${i}`, [px, py, 1.72], [px, py + inwardY * 0.64, 2.35], 0.085, 0.11, 'frame_z');
      cylinder(`brace_pin_${i}`, [px, py, 1.79], 0.013, 0.18, 'hardware', 'x');
    }
    for (const [i, py] of [y + postInset, y + d - postInset].entries()) {
      box(`beam_x_${i}`, x + 0.02, py - 0.09, beamBottom, w - 0.04, 0.18, beamTop - beamBottom, 'frame_x');
    }
    for (const [i, px] of [x + postInset, x + w - postInset].entries()) {
      box(`beam_y_${i}`, px - 0.08, y + postInset + 0.09, beamBottom,
        0.16, d - 2 * postInset - 0.18, beamTop - beamBottom, 'frame_y');
    }
    const rafterCount = 9;
    for (let i = 0; i < rafterCount; i++) {
      box(`rafter_${i}`, x + 0.1 + i * (w - 0.28) / (rafterCount - 1), y - 0.08, beamTop,
        0.08, d + 0.16, 0.16, 'frame_y', 'roof');
    }
    const slatCount = 21;
    for (let i = 0; i < slatCount; i++) {
      box(`roof_slat_${i}`, x - 0.08, y - 0.055 + i * (d + 0.05) / (slatCount - 1), beamTop + 0.16,
        w + 0.16, 0.065, 0.045, 'frame_x', 'roof');
    }

    const tableTop = 0.76, boardCount = 7;
    for (let i = 0; i < boardCount; i++) {
      box(`table_board_${i}`, table.x, table.y + i * table.d / boardCount, tableTop - 0.045,
        table.w, table.d / boardCount - 0.006, 0.045, 'furniture_x', 'furniture', 0.008);
    }
    for (const [i, py] of [table.y + 0.1, table.y + table.d - 0.13].entries()) {
      box(`table_apron_${i}`, table.x + 0.2, py, 0.615, table.w - 0.4, 0.03, 0.1, 'furniture_x', 'furniture');
    }
    for (const [i, px] of [table.x + 0.23, table.x + table.w - 0.31].entries()) {
      box(`table_trestle_${i}`, px, table.y + 0.06, 0.61, 0.08, table.d - 0.12, 0.105, 'furniture_y', 'furniture');
      for (const [j, py] of [table.y + 0.13, table.y + table.d - 0.2].entries()) {
        box(`table_leg_${i}_${j}`, px, py, 0, 0.08, 0.07, 0.615, 'furniture_z', 'furniture');
      }
      box(`table_stretcher_y_${i}`, px, table.y + 0.13, 0.16, 0.08, table.d - 0.26, 0.07, 'furniture_y', 'furniture');
    }
    box('table_stretcher_x', table.x + 0.23, table.y + table.d / 2 - 0.035, 0.17,
      table.w - 0.46, 0.07, 0.07, 'furniture_x', 'furniture');
    for (const [side, centerY, outward] of [['north', table.y - 0.51, -1], ['south', table.y + table.d + 0.51, 1]]) {
      const length = table.w - 0.16, bx = table.x + 0.08, by = centerY - 0.22;
      for (let i = 0; i < 4; i++) box(`bench_${side}_seat_${i}`, bx, by + i * 0.11, 0.415,
        length, 0.103, 0.045, 'furniture_x', 'furniture', 0.008);
      for (const [i, py] of [by + 0.04, by + 0.33].entries()) {
        box(`bench_${side}_apron_${i}`, bx + 0.12, py, 0.33, length - 0.24, 0.05, 0.085, 'furniture_x', 'furniture');
      }
      const backY = centerY + outward * 0.2;
      for (const [i, px] of [bx + 0.15, bx + length - 0.21].entries()) {
        for (const [j, py] of [by + 0.04, by + 0.33].entries()) {
          box(`bench_${side}_leg_${i}_${j}`, px, py, 0, 0.06, 0.06, 0.415, 'furniture_z', 'furniture');
        }
        box(`bench_${side}_crossrail_${i}`, px, by + 0.04, 0.31, 0.06, 0.35, 0.08, 'furniture_y', 'furniture');
        beam(`bench_${side}_back_support_${i}`, [px + 0.03, backY, 0.34],
          [px + 0.03, backY + outward * 0.08, 0.96], 0.045, 0.055, 'furniture_z', 'furniture');
      }
      for (let i = 0; i < 3; i++) {
        const z = 0.59 + i * 0.13, py = backY + outward * (z - 0.34) * 0.08 / 0.62;
        box(`bench_${side}_back_${i}`, bx, py - 0.018, z, length, 0.036, 0.085, 'furniture_x', 'furniture', 0.006);
      }
    }

    function chair(name, cx, cy, facing) {
      const point = (u, v, z) => [cx + v * facing, cy + u, z];
      const timber = 'furniture_y';
      for (let i = 0; i < 5; i++) {
        box(`${name}_seat_${i}`, cx - 0.23 + i * 0.092, cy - 0.24, 0.42, 0.085, 0.48, 0.04, timber, 'furniture', 0.006);
      }
      for (const [i, u] of [-0.195, 0.195].entries()) {
        for (const [j, v] of [-0.19, 0.19].entries()) {
          const p = point(u, v, 0);
          box(`${name}_leg_${i}_${j}`, p[0] - 0.022, p[1] - 0.022, 0, 0.044, 0.044, 0.42, 'furniture_z', 'furniture');
        }
        beam(`${name}_back_support_${i}`, point(u, -0.19, 0.3), point(u, -0.28, 0.94), 0.04, 0.04, 'furniture_z', 'furniture');
        box(`${name}_seat_rail_${i}`, cx - 0.21, cy + u - 0.02, 0.35, 0.42, 0.04, 0.07, 'furniture_x', 'furniture');
      }
      for (let i = 0; i < 3; i++) {
        const z = 0.6 + i * 0.13, p = point(0, -0.19 - (z - 0.3) * 0.09 / 0.64, z);
        box(`${name}_back_${i}`, p[0] - 0.018, cy - 0.235, z, 0.036, 0.47, 0.085, timber, 'furniture', 0.006);
      }
    }
    chair('chair_west', table.x - 0.53, table.y + table.d / 2, 1);
    chair('chair_east', table.x + table.w + 0.53, table.y + table.d / 2, -1);

    for (const [side, py] of [['north', table.y + 0.21], ['south', table.y + table.d - 0.21]]) {
      for (let i = 0; i < 4; i++) {
        const px = table.x + 0.35 + i * (table.w - 0.7) / 3;
        lathe(`plate_${side}_${i}`, [px, py, tableTop], [[0,0.003], [0.072,0.003], [0.09,0.009],
          [0.12,0.024], [0.125,0.027], [0.12,0.032], [0.085,0.017], [0,0.013]], 'ceramic');
        const gy = py + (side === 'north' ? 0.16 : -0.16);
        lathe(`glass_${side}_${i}`, [px + 0.18, gy, tableTop], [[0,0], [0.031,0], [0.034,0.095],
          [0.031,0.095], [0.028,0.006], [0,0.006]], 'glass');
      }
    }
    lathe('serving_bowl', [table.x + table.w / 2, table.y + table.d / 2, tableTop],
      [[0,0], [0.09,0], [0.17,0.08], [0.164,0.088], [0.083,0.013], [0,0.013]], 'ceramic');

    const fixtureX = table.x + table.w / 2, fixtureY = table.y + table.d / 2;
    box('pendant_anchor', fixtureX - 0.6, fixtureY - 0.05, 2.69, 1.2, 0.1, 0.04, 'steel', 'roof');
    for (const [i, px] of [fixtureX - 0.45, fixtureX + 0.45].entries()) {
      cylinder(`pendant_cord_${i}`, [px, fixtureY, 2.34], 0.004, 0.7, 'steel', 'z', 'roof');
    }
    box('pendant_body', fixtureX - 0.62, fixtureY - 0.09, 1.95, 1.24, 0.18, 0.06, 'steel', 'roof', 0.012);
    box('pendant_diffuser', fixtureX - 0.59, fixtureY - 0.065, 1.938, 1.18, 0.13, 0.012, 'lamp', 'roof');
    for (let i = 0; i < 3; i++) lights.push({ name: `pergola_pendant_${i}`, category: 'roof',
      position: [fixtureX - 0.4 + i * 0.4, fixtureY, 1.91], color: '#ffd4a0', power: 9 });
    for (const [i, py] of [y + postInset + 0.08, y + d - postInset - 0.1].entries()) {
      box(`beam_light_${i}`, x + 0.9, py, beamBottom - 0.015, w - 1.8, 0.02, 0.015, 'lamp');
      lights.push({ name: `pergola_beam_light_${i}`, position: [x + w / 2, py, 2.24], color: '#ffd4a0', power: 8 });
    }
    const plantingClearances = [
      { x: paving.x - 0.08, y: paving.y - 0.08, w: paving.w + 0.16, d: paving.d + 0.16 },
      { x: x + 1.72, y: y + d - 0.2, w: 1.2, d: 1.35 },
      { x: x + w - 0.2, y: y + 2.7, w: 1.1, d: 1.1 },
    ];
    return { name: 'Pergola dining', materials, parts, lights, floorHeight, groundPatch, plantingClearances };
  }
  return { build };
})();
if (typeof module !== 'undefined') module.exports = { PergolaModel };
