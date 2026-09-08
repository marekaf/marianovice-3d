const OfficeRooms = (() => {
  function build(house, id, { doorOpen = false } = {}) {
    if (!['1.05', '1.08'].includes(id)) throw new Error(`Unknown office ${id}`);
    const room = house.rooms.find(r => r.id === id);
    if (!room || !Number.isFinite(house.clearH)) throw new Error('Missing office room geometry');
    const bounds = { x0: room.x0, z0: room.z0, x1: room.x1, z1: room.z1 };
    const walls = new Map([...house.extWalls, ...house.intWalls].map(w => [w.id, w]));
    const northOffice = id === '1.08';
    const pantryX = northOffice ? walls.get('W19').a[0] : 0;
    const pantryZ = northOffice ? walls.get('W20').b[1] : 0;
    const nicheX = northOffice ? walls.get('W23').a[0] : 0;
    const nicheZ = northOffice ? walls.get('W23b').a[1] : 0;
    const outline = northOffice ? [
      [room.x0, room.z0], [pantryX, room.z0], [pantryX, pantryZ],
      [room.x1, pantryZ], [room.x1, nicheZ], [nicheX, nicheZ],
      [nicheX, room.z1], [room.x0, room.z1],
    ] : [[room.x0, room.z0], [room.x1, room.z0], [room.x1, room.z1], [room.x0, room.z1]];
    const materials = {
      wallPaint: { color: '#62736D', roughness: 0.9 },
      ceilingPaint: { color: '#DED3C8', roughness: 0.95 },
      floorWood: { color: '#ffffff', roughness: 0.82 },
      floorDark: { color: '#a18e73', roughness: 0.9 },
      trim: { color: '#e6dfd1', roughness: 0.65 },
      windowFrame: { color: '#45494a', roughness: 0.4, metalness: 0.15 },
      glass: { color: '#e4eeee', roughness: 0.025, transmission: 1 },
    };
    const parts = [], openings = [];
    function box(name, x0, z0, y0, x1, z1, y1, material, category, bevel = 0.001) {
      if (x1 - x0 < 1e-7 || z1 - z0 < 1e-7 || y1 - y0 < 1e-7) return;
      parts.push({ name, type: 'box', position: [(x0 + x1) / 2, (z0 + z1) / 2, (y0 + y1) / 2],
        size: [x1 - x0, z1 - z0, y1 - y0], material, category, bevel });
    }
    const regions = northOffice ? [
      [room.x0, room.z0, pantryX, room.z1],
      [pantryX, pantryZ, nicheX, room.z1],
      [nicheX, pantryZ, room.x1, nicheZ],
    ] : [[room.x0, room.z0, room.x1, room.z1]];
    const width = 0.225, length = 1.524, offsets = [0.38];
    for(let p=1;p<Math.ceil((room.x1-room.x0)/width);p++)
      offsets.push((offsets[p-1]+.34+((p*137)%521)/1000)%length);
    const floorLayout = { width, length, offsets };
    for (const [i, [x0, z0, x1, z1]] of regions.entries()) {
      box(`floor_base_${i}`, x0, z0, -0.055, x1, z1, -0.0025, 'floorDark', 'floor', 0);
      box(`ceiling_${i}`, x0, z0, house.clearH, x1, z1, house.clearH + 0.08, 'ceilingPaint', 'roof', 0);
      const first = Math.floor((x0 - room.x0) / width);
      const last = Math.ceil((x1 - room.x0) / width);
      for (let p = first; p < last; p++) {
        const left = Math.max(x0, room.x0 + p * width);
        const right = Math.min(x1, room.x0 + (p + 1) * width);
        const origin = room.z0 + offsets[p];
        let k = Math.floor((z0 - origin) / length);
        while (origin + k * length < z1 - 1e-6) {
          const start = Math.max(z0, origin + k * length);
          const end = Math.min(z1, origin + (k + 1) * length);
          const inset = .00015;
          box(`plank_${i}_${p}_${k + 1}`, left + (left === x0 ? 0 : inset), start + (start === z0 ? 0 : inset), -0.0025,
            right - (right === x1 ? 0 : inset), end - (end === z1 ? 0 : inset), 0, 'floorWood', 'floor', 0);
          k++;
        }
      }
    }
    const selection = northOffice ? [
      ['W3', 'west', room.z0, room.z1], ['W5', 'south', room.x0, walls.get('W23').b[0]],
      ['W16', 'north', room.x0, pantryX], ['W19', 'east', room.z0, pantryZ],
      ['W20', 'north'], ['W21', 'east', pantryZ, walls.get('W21').b[1]],
      ['W22', 'east'], ['W23', 'east'], ['W23b', 'south'],
    ] : [
      ['W4', 'west', room.z0, room.z1], ['W6', 'north', room.x0, room.x1 + 0.25],
      ['W26', 'east'], ['W27', 'south', room.x0, room.x1 + 0.25],
    ];
    for (const [wallId, category, clipStart, clipEnd] of selection) {
      const wall = walls.get(wallId);
      if (!wall) throw new Error(`Missing wall ${wallId}`);
      const renderCategory = wallId === 'W23' || wallId === 'W23b' ? 'niche' : category;
      const alongX = wall.b[0] - wall.a[0] > wall.b[1] - wall.a[1];
      const axis = alongX ? 0 : 1, cross = 1 - axis;
      const lo = clipStart ?? wall.a[axis], hi = clipEnd ?? wall.b[axis];
      const depth0 = wall.a[cross], depth1 = wall.b[cross];
      let serial = 0;
      const segment = (a, b, y0, y1, material = 'wallPaint', d0 = depth0, d1 = depth1) => {
        box(`${wallId}_${serial++}`, alongX ? a : d0, alongX ? d0 : a, y0,
          alongX ? b : d1, alongX ? d1 : b, y1, material, renderCategory);
      };
      const holes = wall.openings.map((o, index) => ({ ...o, index, start: wall.a[axis] + o.at, end: wall.a[axis] + o.at + o.w }))
        .filter(o => o.end > lo && o.start < hi).sort((a, b) => a.start - b.start);
      let cursor = lo;
      for (const o of holes) {
        const a = Math.max(lo, o.start), b = Math.min(hi, o.end), sill = o.sill || 0;
        const revealExtra = o.reveal ? (o.reveal.width - o.w) / 2 : 0;
        const cutA = Math.max(lo, a - revealExtra), cutB = Math.min(hi, b + revealExtra);
        segment(cursor, cutA, 0, house.clearH);
        segment(cutA, cutB, 0, sill);
        segment(cutA, cutB, sill + o.h, house.clearH);
        if (o.reveal) {
          for (const [d0, d1] of [[depth0, o.reveal.depth0], [o.reveal.depth1, depth1]]) {
            segment(cutA, a, sill, sill + o.h, 'wallPaint', d0, d1);
            segment(b, cutB, sill, sill + o.h, 'wallPaint', d0, d1);
          }
        }
        const isWindow = wallId === 'W3' || wallId === 'W4';
        const openingModel = house.buildOpening?.(wall, wall.openings[o.index], o.index, { doorOpen });
        if (openingModel) {
          Object.assign(materials, openingModel.materials);
          parts.push(...openingModel.parts.map(p => ({ ...p, category: isWindow ? category : 'doors' })));
          openings.push({ ...openingModel.opening, kind: isWindow ? 'window' : 'door', wallId, category,
            x: alongX ? (a + b) / 2 : (depth0 + depth1) / 2,
            z: alongX ? (depth0 + depth1) / 2 : (a + b) / 2,
            width: openingModel.opening?.width ?? b - a, height: o.h, sill,
            axis: alongX ? 'x' : 'z', start: cutA, end: cutB });
          cursor = cutB;
          continue;
        }
        const frame = isWindow ? 0.045 : 0.025, middle = (depth0 + depth1) / 2;
        const d0 = isWindow ? middle - 0.035 : depth0 - 0.01;
        const d1 = isWindow ? middle + 0.035 : depth1 + 0.01;
        const mat = isWindow ? 'windowFrame' : 'trim';
        segment(a, a + frame, sill, sill + o.h, mat, d0, d1);
        segment(b - frame, b, sill, sill + o.h, mat, d0, d1);
        segment(a + frame, b - frame, sill + o.h - frame, sill + o.h, mat, d0, d1);
        if (isWindow) {
          segment(a + frame, b - frame, sill, sill + frame, mat, d0, d1);
          segment(a + frame, b - frame, sill + frame, sill + o.h - frame, 'glass', middle - 0.006, middle + 0.006);
        }
        openings.push({ kind: isWindow ? 'window' : 'door', wallId, category,
          x: alongX ? (a + b) / 2 : middle, z: alongX ? middle : (a + b) / 2,
          width: b - a, height: o.h, sill, axis: alongX ? 'x' : 'z', hinge: null,
          start: a, end: b, clearWidth: b - a - 2 * frame });
        cursor = cutB;
      }
      segment(cursor, hi, 0, house.clearH);
      const baseSegments = [];
      cursor = lo;
      for (const o of holes.filter(o => !o.sill)) {
        const extra = o.reveal ? (o.reveal.width - o.w) / 2 : 0;
        baseSegments.push([cursor, Math.max(lo, o.start - extra)]);
        cursor = Math.min(hi, o.end + extra);
      }
      baseSegments.push([cursor, hi]);
      const inner = category === 'north' || category === 'west' ? depth1 : depth0;
      const sign = category === 'north' || category === 'west' ? 1 : -1;
      for (const [a, b] of baseSegments) segment(a, b, 0, 0.075, 'trim',
        Math.min(inner, inner + sign * 0.012), Math.max(inner, inner + sign * 0.012));
    }
    return { name: `office-${id}`, floorHeight: 0, floorLayout, clearHeight: house.clearH, bounds, outline,
      door: openings.find(o => o.kind === 'door'), window: openings.find(o => o.kind === 'window'), openings,
      wallCategories: ['north', 'south', 'east', 'west'], categoryVisibility: { roof: false }, materials, parts, lights: [] };
  }
  return { build };
})();
if (typeof module !== 'undefined') module.exports = { OfficeRooms };
