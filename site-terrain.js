const SiteTerrain = (() => {
  const baseHeight = (plane, x, z) => Math.max(0, plane.a * x + plane.b * z + plane.c);
  const smoothstep = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const rectDistance = (r, x, z) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));

  function height(spec, x, z) {
    const base = baseHeight(spec.plane, x, z);
    let h = base;
    for (const r of spec.cutRects) {
      const blend = r.blend ?? spec.cutBlend;
      const d = rectDistance(r, x, z);
      if (d >= blend) continue;
      const t = smoothstep(d / blend);
      h = Math.min(h, r.level + (base - r.level) * t);
    }
    for (const p of spec.fillPads) {
      if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) h = Math.max(h, p.level);
      else if (x > p.x1 && x < p.x1 + p.eastBlend && z >= p.z0 && z <= p.z1)
        h = Math.max(h, p.level + (base - p.level) * smoothstep((x - p.x1) / p.eastBlend));
    }
    for (const p of spec.levelPads) {
      const blend = p.blend ?? 2.0;
      const d = rectDistance(p, x, z);
      if (d >= blend) continue;
      const t = smoothstep(d / blend);   // inside footprint (d=0): level; edge: banks to grade
      h = p.level + (base - p.level) * t;
    }
    for (const p of spec.postCuts) {
      const d = rectDistance(p, x, z);
      if (d < p.blend) h = Math.min(h, p.level + (h - p.level) * smoothstep(d / p.blend));
    }
    const pond = spec.pond;
    const prr = Math.sqrt(((x - pond.cx) / pond.rx) ** 2 + ((z - pond.cz) / pond.rz) ** 2);
    if (prr < 1.3) {
      if (prr <= 1) h = Math.min(h, pond.edge - pond.depth * 0.5 * (1 + Math.cos(prr * Math.PI)));
      else h = Math.min(h, pond.edge + (base - pond.edge) * smoothstep((prr - 1) / 0.3));
    }
    return h;
  }

  function create(garden, terrainPlane, groundPatches) {
    const plane = { a: terrainPlane.a, b: terrainPlane.b, c: terrainPlane.c };
    const patchRect = ({ x, y, w, d, level, blend }) => ({ x0: x, z0: y, x1: x + w, z1: y + d, level, blend });
    // Graded cut into the west slope, clamped just under the level west deck;
    // smoothstep bank rising to natural grade; min() leaves downhill areas untouched.
    const cutBlend = 1.8;
    const cutRects = [
      { x0: 8.3, z0: 6.7, x1: 10.48, z1: 26.5, level: 2.46, blend: 2.2 },  // west sidewalk, ending at the deck/SW corner. Do NOT push z1 further south: holding the grade flat past the deck makes the SW garden bank up ~1 m right at the south fence, and the fence then rides over that bump. Ending here lets the garden rise gently inland instead.
      { x0: 10.48, z0: 15.93, x1: 14.93, z1: 19.18, level: 2.46 }, // atrium
      { x0: 10.48, z0: 6.68, x1: 21.28, z1: 7.18, level: 2.345, blend: 0.6 },   // drip strip — north wall
      { x0: 21.28, z0: 7.18, x1: 21.78, z1: 11.58, level: 2.345, blend: 0.6 },  // drip strip — east wall north of the notch
      // The south-side cut to the paved grade (396.50) is applied AFTER the level pads
      // because the carport level pad's blend would otherwise re-raise the SE corner up over the gravel.
    ];
    // Level pads — force the footprint flat to `level` (cut where the grade is higher, fill where it is
    // lower), smoothstep bank to grade at the edges. The real NW→SE fall drops the SE hardscape below its
    // slab level (cut alone can't lift it) and lifts the NW garden pads above theirs (cut alone pits them).
    const levelPads = [
      patchRect(groundPatches.garage),
      { x0: 3.5, z0: 2.17, x1: 10.5, z1: 5.17, level: 2.45, blend: 1.2 },      // sauna + hot-tub platform, on grade
      ...[groundPatches.pergola, groundPatches.greenhouse, groundPatches.raisedBeds].map(patchRect),
    ];
    // Pond basin — smooth bowl carved to the pond's downhill edge level.
    const ellipse = garden.elements.find(e => e.id === 'pond').parts.find(p => p.kind === 'ellipse');
    const edge = Math.min(...Array.from({ length: 16 }, (_, i) => {
      const a = i / 16 * Math.PI * 2;
      return baseHeight(plane, ellipse.cx + Math.cos(a) * ellipse.rx, ellipse.cy + Math.sin(a) * ellipse.ry);
    }));
    const pond = { cx: ellipse.cx, cz: ellipse.cy, rx: ellipse.rx, rz: ellipse.ry, edge, depth: 0.55 };
    // Fill pads — excess site soil placed FLAT under a structure. Flat over the whole footprint,
    // sloping down only on the +x (garden) side; nothing on the other sides so it never bleeds into
    // the carport. Applied AFTER the cuts so an adjacent cut's blend can't clip the flat pad (no gaps).
    const fillPads = [
      { x0: 20.58, z0: 11.58, x1: 23.58, z1: 19.4, level: 2.44, eastBlend: 2.6 },  // soil under the E terrace, slope into the garden
    ];
    const postCuts = [
      // Driveway graded down to the carport slab level so it falls to the gate in one clean grade. The
      // ground rises just south of the carport, so without this the drive humps up between the parked cars
      // and the gate. Cut only (min), banking back to grade at the garden edges.
      { x0: 21.28, z0: 26.43, x1: 43.5, z1: 32.5, blend: 1.8, level: 1.925 },
      // South side down to the paved grade (396.50 = internal ~1.9). Applied here, AFTER the level pads, so the
      // carport pad's blend can't re-raise the SE corner over the gravel. First rect is the 1 m band + its lawn
      // run-out; second ties the SE corner across to the drive. Cut only (min against the post-pad height).
      // Narrow blend so the cut does NOT bleed west into the W terrace (x<10.48) — a wide blend there dug a
      // dip at the SW corner and the natural SW garden then read as a bump next to it. z1 keeps a 1 m flat
      // run-out south of the gravel so grass still can't climb the band.
      { x0: 10.48, z0: 25.5, x1: 21.28, z1: 28.5, blend: 1.2, level: 1.9 },
      { x0: 16.5, z0: 26.43, x1: 22.2, z1: 29.5, blend: 1.5, level: 1.9 },
    ];
    const spec = { plane, cutBlend, cutRects, fillPads, levelPads, postCuts, pond };
    const house = garden.elements.find(e => e.id === 'house').parts.find(p => p.kind === 'polygon').points;
    let houseX = 0, houseZ = 0;
    for (const point of house) { houseX += point[0]; houseZ += point[1]; }
    spec.houseBaseY = height(spec, houseX / house.length, houseZ / house.length);
    spec.deckTop = spec.houseBaseY + 0.05;
    return { spec, height: (x, z) => height(spec, x, z), baseHeight: (x, z) => baseHeight(plane, x, z) };
  }

  return { create, height };
})();
if (typeof module !== 'undefined') module.exports = { SiteTerrain };
