/* Local coordinates are [across, along, height], with the nose toward negative along. */
const VehicleModel = (() => {
  function build(v) {
    const { w, l } = v;
    const style = v.style || (v.doorLen > 1.2 ? 'coupe' : l > 4.8 ? 'estate' : 'hatchback');
    const h = v.moto ? 1.45 : style === 'coupe' ? 1.39 : style === 'estate' ? 1.52 : 1.47;
    const parts = [];
    const materials = {
      paint: { color: v.col || '#556b79', roughness: 0.23, metalness: 0.65 },
      rubber: { color: '#202122', roughness: 0.94 },
      trim: { color: '#303335', roughness: 0.48 },
      alloy: { color: '#b9bfc3', roughness: 0.24, metalness: 0.88 },
      brake: { color: '#737879', roughness: 0.58, metalness: 0.8 },
      glass: { color: '#a3b7ba', roughness: 0.08, transmission: 0.93 },
      mirror: { color: '#dae3e5', roughness: 0.04, metalness: 1 },
      upholstery: { color: '#393b3b', roughness: 0.95 },
      headlamp: { color: '#e1e7dd', roughness: 0.18, metalness: 0.35 },
      tail: { color: '#821b19', roughness: 0.24 },
      plate: { color: '#deded5', roughness: 0.5 },
    };
    const box = (name, position, size, material, bevel = 0.015) => parts.push({ name, type: 'box', position, size, material, bevel, category: 'vehicle' });
    const beam = (name, start, end, width, depth, material) => parts.push({ name, type: 'beam', start, end, width, depth, material, bevel: 0.005, category: 'vehicle' });
    const cylinder = (name, position, radius, height, material, axis = 'x') => parts.push({ name, type: 'cylinder', position, radiusTop: radius, radiusBottom: radius, height, axis, segments: 32, material, category: 'vehicle' });
    const mesh = (name, vertices, faces, material, smooth = false) => parts.push({ name, type: 'mesh', vertices, faces, material, smooth, category: 'vehicle' });
    const panel = (name, vertices, material) => {
      const a = vertices[1].map((x, i) => x - vertices[0][i]);
      const b = vertices[2].map((x, i) => x - vertices[0][i]);
      const normal = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const length = Math.hypot(...normal);
      const inner = vertices.map(p => p.map((x, i) => x - normal[i] / length * 0.002));
      mesh(name, [...vertices, ...inner], [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], material);
    };
    const surface = (name, rows, material, reverse = false) => {
      const faces = [], columns = rows[0].length;
      for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < columns - 1; c++) {
        const a = r * columns + c;
        const face = [a, a + 1, a + columns + 1, a + columns];
        faces.push(reverse ? face.reverse() : face);
      }
      mesh(name, rows.flat(), faces, material, true);
    };
    const wheel = (id, x, y, r, thickness) => {
      cylinder(`tire_${id}`, [x, y, r], r, thickness, 'rubber');
      for (const side of [-1, 1]) {
        const face = x + side * (thickness / 2 + 0.002);
        cylinder(`rim_${id}_${side}`, [face, y, r], r * 0.71, 0.009, 'trim');
        cylinder(`disc_${id}_${side}`, [face + side * 0.006, y, r], r * 0.53, 0.01, 'brake');
        cylinder(`hub_${id}_${side}`, [face + side * 0.02, y, r], r * 0.19, 0.024, 'alloy');
        for (let n = 0; n < 10; n++) {
          const a = n * Math.PI / 5;
          beam(`spoke_${id}_${side}_${n}`, [face + side * 0.018, y + Math.sin(a) * r * 0.18, r + Math.cos(a) * r * 0.18],
            [face + side * 0.014, y + Math.sin(a + 0.12) * r * 0.69, r + Math.cos(a + 0.12) * r * 0.69], 0.028, 0.018, 'alloy');
        }
      }
    };
    if (v.moto) {
      const front = -l / 2 + 0.35, rear = l / 2 - 0.35;
      wheel('front', 0, front, 0.35, 0.105);
      wheel('rear', 0, rear, 0.35, 0.145);
      for (const side of [-1, 1]) {
        beam(`fork_${side}`, [side * 0.095, front, 0.35], [side * 0.095, front + 0.23, 1.16], 0.045, 0.045, 'alloy');
        beam(`swingarm_${side}`, [side * 0.09, rear, 0.35], [side * 0.09, 0.1, 0.48], 0.065, 0.08, 'alloy');
        beam(`frame_${side}`, [side * 0.14, -0.38, 1.03], [side * 0.14, 0.35, 0.51], 0.035, 0.035, 'trim');
      }
      box('engine', [0, -0.02, 0.53], [0.38, 0.48, 0.4], 'trim', 0.07);
      box('fuel_tank', [0, -0.24, 0.94], [0.4, 0.55, 0.38], 'paint', 0.09);
      box('seat', [0, 0.39, 0.98], [0.31, 0.7, 0.11], 'upholstery', 0.04);
      box('front_fender', [0, front + 0.02, 0.79], [0.18, 0.52, 0.07], 'paint');
      box('rear_fender', [0, rear, 0.73], [0.19, 0.55, 0.07], 'trim');
      box('headlight', [0, front + 0.13, 1.13], [0.2, 0.09, 0.25], 'headlamp');
      panel('windscreen', [[-0.17, front + 0.13, 1.13], [0.17, front + 0.13, 1.13], [0.14, front + 0.22, h], [-0.14, front + 0.22, h]], 'glass');
      beam('handlebar', [-w / 2, front + 0.29, 1.19], [w / 2, front + 0.29, 1.19], 0.025, 0.025, 'alloy');
      for (const side of [-1, 1]) {
        box(`grip_${side}`, [side * (w / 2 - 0.065), front + 0.29, 1.19], [0.13, 0.045, 0.045], 'rubber');
        beam(`mirror_stalk_${side}`, [side * 0.3, front + 0.29, 1.19], [side * 0.36, front + 0.3, 1.4], 0.016, 0.016, 'trim');
        box(`mirror_${side}`, [side * 0.36, front + 0.31, 1.4], [0.13, 0.035, 0.08], 'mirror');
      }
      cylinder('exhaust', [0.22, 0.52, 0.67], 0.072, 0.59, 'alloy', 'y');
      beam('side_stand', [-0.15, 0.09, 0.48], [-0.31, 0.3, 0.03], 0.022, 0.022, 'trim');
      box('tail_lamp', [0, l / 2 - 0.05, 0.82], [0.12, 0.07, 0.05], 'tail');
    } else {
      const half = w / 2, frontAxle = -l * 0.315, rearAxle = l * 0.30;
      const radius = style === 'estate' ? 0.35 : 0.325;
      const belt = h * 0.63, roofFront = -l * 0.105, roofRear = l * (style === 'coupe' ? 0.22 : 0.32);
      const screenBase = -l * 0.255, rearBase = l * 0.425, roofWidth = w * 0.405;
      const bodyTop = y => y < screenBase ? belt - 0.08 * (screenBase - y) / (screenBase + l / 2)
        : y > rearBase ? belt - 0.05 * (y - rearBase) / (l / 2 - rearBase) : belt;
      const bodyWidth = y => half - 0.1 * Math.max(0, (Math.abs(y) - l * 0.33) / (l * 0.17)) ** 2;
      box('underbody', [0, 0, 0.4], [w - 0.49, l * 0.89, 0.21], 'trim');
      box('cabin_floor', [0, 0.24, 0.57], [w - 0.28, l * 0.51, 0.12], 'upholstery');
      for (const side of [-1, 1]) {
        wheel(`${side}_front`, side * (half - 0.115), frontAxle, radius, 0.22);
        wheel(`${side}_rear`, side * (half - 0.115), rearAxle, radius, 0.22);
        const lower = [[-l / 2 + 0.016, 0.44], [-l * 0.46, 0.44]];
        for (const axle of [frontAxle, rearAxle]) {
          const arch = radius + 0.05;
          const edgeAngle = Math.asin((0.44 - radius) / arch);
          for (let n = 0; n <= 16; n++) {
            const angle = Math.PI - edgeAngle - n * (Math.PI - edgeAngle * 2) / 16;
            lower.push([axle + Math.cos(angle) * arch, radius + Math.sin(angle) * arch]);
          }
        }
        lower.push([l * 0.46, 0.44], [l / 2 - 0.016, 0.44]);
        surface(`body_side_${side}`, lower.map(([y, bottom]) => Array.from({ length: 7 }, (_, n) => {
          const t = n / 6;
          return [side * (bodyWidth(y) - 0.055 + Math.sin(t * Math.PI) * 0.055), y, bottom + (bodyTop(y) - bottom) * t];
        })), 'paint', side > 0);
        beam(`sill_${side}`, [side * (half - 0.035), frontAxle + radius + 0.07, 0.405], [side * (half - 0.035), rearAxle - radius - 0.07, 0.405], 0.07, 0.11, style === 'estate' ? 'trim' : 'paint');
        const p = (y, z, top = false) => [side * (top ? roofWidth : half - 0.045), y, z];
        const split = style === 'coupe' ? l * 0.13 : l * 0.015;
        panel(`side_glass_front_${side}`, [p(screenBase, belt), p(split, belt), p(split, h - 0.055, true), p(roofFront, h - 0.055, true)], 'glass');
        panel(`side_glass_rear_${side}`, [p(split + 0.055, belt), p(rearBase, belt), p(roofRear, h - 0.055, true), p(split + 0.055, h - 0.055, true)], 'glass');
        beam(`a_pillar_${side}`, p(screenBase, belt), p(roofFront, h - 0.025, true), 0.055, 0.065, 'paint');
        beam(`b_pillar_${side}`, p(split + 0.023, belt), p(split + 0.023, h - 0.045, true), 0.058, 0.07, 'trim');
        beam(`rear_pillar_${side}`, p(rearBase, belt), p(roofRear, h - 0.025, true), 0.085, 0.1, 'paint');
        beam(`window_sill_${side}`, p(screenBase, belt), p(rearBase, belt), 0.022, 0.022, 'alloy');
        const doors = style === 'coupe' ? [split] : [split, l * 0.27];
        doors.forEach((end, i) => {
          box(`door_handle_${side}_${i}`, [side * (half + 0.008), end - 0.13, belt - 0.11], [0.03, 0.15, 0.032], 'alloy', 0.008);
          beam(`door_seam_${side}_${i}`, [side * (half + 0.002), end + 0.025, 0.48], [side * (half - 0.045), end + 0.025, belt], 0.006, 0.006, 'trim');
        });
        box(`mirror_mount_${side}`, [side * half, screenBase + 0.1, belt + 0.06], [0.16, 0.075, 0.06], 'trim');
        box(`mirror_housing_${side}`, [side * (half + 0.08), screenBase + 0.15, belt + 0.09], [0.15, 0.21, 0.12], 'paint', 0.035);
        box(`mirror_glass_${side}`, [side * (half + 0.08), screenBase + 0.258, belt + 0.09], [0.12, 0.007, 0.079], 'mirror', 0.01);
        if (style === 'estate') beam(`roof_rail_${side}`, [side * roofWidth * 0.89, roofFront + 0.1, h + 0.035], [side * roofWidth * 0.89, roofRear - 0.08, h + 0.035], 0.035, 0.035, 'alloy');
      }
      const roofRows = Array.from({ length: 9 }, (_, r) => Array.from({ length: 17 }, (_, c) => {
        const along = r / 8, across = c / 8 - 1;
        return [across * roofWidth, roofFront + (roofRear - roofFront) * along, h - 0.025 + (1 - across * across) * 0.045 + Math.sin(along * Math.PI) * 0.025];
      }));
      surface('roof', roofRows, 'paint');
      surface('headliner', roofRows.map(row => row.map(([x, y, z]) => [x, y, z - 0.035])), 'upholstery', true);
      for (const y of [roofFront, roofRear]) for (let i = 0; i < 16; i++) {
        const a = i / 8 - 1, b = (i + 1) / 8 - 1;
        panel(`roof_header_${y}_${i}`, [[a * roofWidth, y, h - 0.055], [b * roofWidth, y, h - 0.055],
          [b * roofWidth, y, h - 0.025 + (1 - b * b) * 0.045], [a * roofWidth, y, h - 0.025 + (1 - a * a) * 0.045]], 'paint');
      }
      for (const side of [-1, 1]) beam(`roof_edge_${side}`, [side * roofWidth, roofFront, h - 0.04], [side * roofWidth, roofRear, h - 0.04], 0.035, 0.04, 'paint');
      panel('windscreen', [[-half + 0.045, screenBase, belt], [half - 0.045, screenBase, belt], [roofWidth, roofFront, h - 0.055], [-roofWidth, roofFront, h - 0.055]], 'glass');
      panel('rear_window', [[half - 0.045, rearBase, belt], [-half + 0.045, rearBase, belt], [-roofWidth, roofRear, h - 0.055], [roofWidth, roofRear, h - 0.055]], 'glass');
      for (const [name, from, to] of [['hood', -l / 2 + 0.016, screenBase], ['tailgate_top', rearBase, l / 2 - 0.016]]) {
        surface(name, Array.from({ length: 9 }, (_, r) => Array.from({ length: 17 }, (_, c) => {
          const across = c / 8 - 1, y = from + (to - from) * r / 8;
          return [across * (bodyWidth(y) - 0.055), y, bodyTop(y) + (1 - across * across) * 0.035 * Math.sin(r / 8 * Math.PI)];
        })), 'paint');
      }
      for (const end of [-1, 1]) {
        box(`bumper_${end}`, [0, end * (l / 2 - 0.17), 0.56], [w - 0.12, 0.31, 0.28], 'paint', 0.07);
        box(`end_panel_${end}`, [0, end * (l / 2 - 0.072), bodyTop(end * l / 2) - 0.09], [w - 0.25, 0.11, 0.18], 'paint', 0.04);
        box(`license_plate_${end}`, [0, end * (l / 2 - 0.002), 0.53], [0.45, 0.004, 0.105], 'plate', 0);
        for (const side of [-1, 1]) {
          const z = belt - 0.115;
          const xs = [side * w * 0.22, side * w * 0.43];
          panel(`lamp_${end}_${side}`, [[xs[0], end * (l / 2 - 0.009), z - 0.035], [xs[1], end * (l / 2 - 0.009), z - 0.008], [xs[1], end * (l / 2 - 0.009), z + 0.06], [xs[0], end * (l / 2 - 0.009), z + 0.047]], end < 0 ? 'headlamp' : 'tail');
          beam(`lamp_signature_${end}_${side}`, [xs[0], end * (l / 2 - 0.007), z + 0.024], [xs[1], end * (l / 2 - 0.007), z + 0.04], 0.008, 0.008, end < 0 ? 'headlamp' : 'tail');
        }
      }
      box('front_grille', [0, -l / 2 + 0.009, belt - 0.17], [w * 0.41, 0.016, 0.16], 'trim', 0.025);
      for (let i = 0; i < 5; i++) box(`grille_bar_${i}`, [0, -l / 2 + 0.002, belt - 0.23 + i * 0.031], [w * 0.38, 0.004, 0.007], 'alloy', 0);
      for (const side of [-1, 1]) beam(`wiper_${side}`, [side * 0.17, screenBase - 0.002, belt + 0.014], [side * 0.62, screenBase + 0.10, belt + 0.13], 0.012, 0.013, 'trim');
      box('dashboard', [0, screenBase + 0.2, belt - 0.04], [w - 0.24, 0.34, 0.12], 'upholstery', 0.035);
      box('console', [0, -0.1, 0.69], [0.24, 0.72, 0.2], 'trim');
      cylinder('steering_wheel', [-w * 0.24, screenBase + 0.43, belt + 0.02], 0.155, 0.025, 'trim', 'y');
      for (const [row, y] of [['front', -l * 0.025], ['rear', l * (style === 'coupe' ? 0.16 : 0.235)]]) {
        for (const [side, x] of [['left', -w * 0.25], ['right', w * 0.25]]) {
          box(`seat_${row}_${side}_base`, [x, y, 0.65], [0.47, 0.48, 0.14], 'upholstery', 0.055);
          box(`seat_${row}_${side}_back`, [x, y + 0.24, 0.9], [0.46, 0.12, 0.5], 'upholstery', 0.05);
          box(`seat_${row}_${side}_headrest`, [x, y + 0.24, 1.2], [0.25, 0.115, 0.16], 'upholstery', 0.035);
        }
      }
    }
    return { name: 'Parked vehicle', materials, parts, lights: [], floorHeight: 0, dimensions: { width: w, length: l, height: h }, style: v.moto ? 'motorcycle' : style };
  }
  return { build };
})();
if (typeof module !== 'undefined') module.exports = VehicleModel;
