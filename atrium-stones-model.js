// Natural flat stepping stones from the layout's atriumStones circles. Each circle becomes one
// irregular slab; the outline is derived from the stone's position, so it is stable between builds.
const AtriumStonesModel = (() => {
  const THICKNESS = .05, PROUD = .03, CORNERS = 9;

  function outline(circle, index) {
    let seed = Math.imul(Math.round(circle.cx * 1000) ^ Math.round(circle.cy * 1000) << 11, 2654435761) + index | 0;
    const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 8) / 16777216; };
    const turn = random() * Math.PI * 2, long = random() * Math.PI, squash = .72 + random() * .2;
    // Positive plan area keeps the prism faces outward for the shared mesh builder.
    return Array.from({ length: CORNERS }, (_, i) => {
      const angle = turn + (i + (random() - .5) * .6) / CORNERS * Math.PI * 2;
      const radius = circle.r * (.8 + random() * .2) * (squash + (1 - squash) * Math.abs(Math.cos(angle - long)));
      return [circle.cx + Math.cos(angle) * radius, circle.cy + Math.sin(angle) * radius];
    });
  }

  function build(garden, groundHeight) {
    const circles = (garden.elements.find(e => e.id === 'atriumStones')?.parts ?? []).filter(p => p.kind === 'circle');
    const materials = Object.fromEntries(['#b9b4a8', '#aeaa9f', '#c2bdb1'].map((color, i) => [`stone_${i}`, { color, roughness: .95 }]));
    const parts = [], stones = [];
    for (const [index, circle] of circles.entries()) {
      const points = outline(circle, index), n = points.length;
      const ground = Math.max(...points.map(([x, z]) => groundHeight(x, z)), groundHeight(circle.cx, circle.cy));
      const top = ground + PROUD, bottom = Math.min(...points.map(([x, z]) => groundHeight(x, z))) - THICKNESS;
      const vertices = [...points.map(p => [...p, bottom]), ...points.map(p => [...p, top])], faces = [];
      for (let i = 1; i < n - 1; i++) faces.push([0, i + 1, i], [n, n + i, n + i + 1]);
      for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, (i + 1) % n + n, i + n]);
      parts.push({ name: `atrium_stone_${index}`, type: 'mesh', vertices, faces, material: `stone_${index % 3}`, category: 'surface' });
      stones.push({ cx: circle.cx, cy: circle.cy, r: circle.r, top, points });
    }
    return { name: 'atrium_stepping_stones', floorHeight: 0, materials, parts, lights: [], stones };
  }

  return { build };
})();
if (typeof module !== 'undefined') module.exports = { AtriumStonesModel };
