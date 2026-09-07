export function buildRavakFreedomWall({ floorHeight = 0 } = {}) {
  const segments = 192, center = [.36, .83], vertices = [], faces = [];
  const roundedRect = (x0, y0, x1, y1, frontRadius, backRadius) => {
    const points = [];
    for (const [cx, cy, radius, start] of [[x1-backRadius,y1-backRadius,backRadius,0],
      [x0+frontRadius,y1-frontRadius,frontRadius,90], [x0+frontRadius,y0+frontRadius,frontRadius,180],
      [x1-backRadius,y0+backRadius,backRadius,270]]) {
      for (let i = 0; i <= 48; i++) {
        const angle = (start + i * 90 / 48) * Math.PI / 180;
        points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
      }
    }
    return points;
  };
  const radialContour = outline => Array.from({ length: segments }, (_, i) => {
    const angle = i * Math.PI * 2 / segments, dx = Math.cos(angle), dy = Math.sin(angle);
    let distance = Infinity;
    for (let j = 0; j < outline.length; j++) {
      const a = outline[j], b = outline[(j + 1) % outline.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], denominator = dx * ey - dy * ex;
      if (Math.abs(denominator) < 1e-12) continue;
      const ax = a[0] - center[0], ay = a[1] - center[1];
      const t = (ax * ey - ay * ex) / denominator, u = (ax * dy - ay * dx) / denominator;
      if (t >= 0 && u >= -1e-9 && u <= 1 + 1e-9) distance = Math.min(distance, t);
    }
    return [center[0] + distance * dx, center[1] + distance * dy];
  });
  const outer = radialContour(roundedRect(0, 0, .8, 1.66, .36, .006));
  const foot = radialContour(roundedRect(.09, .23, .8, 1.43, .25, .006));
  const mouth = radialContour(roundedRect(.02, .02, .70, 1.64, .34, .34));
  const bottom = radialContour(roundedRect(.11, .245, .61, 1.415, .25, .25));
  const ring = (a, b, mix, height) => {
    for (let i = 0; i < segments; i++) vertices.push([
      a[i][0] + (b[i][0] - a[i][0]) * mix, a[i][1] + (b[i][1] - a[i][1]) * mix, height]);
  };
  ring(foot, foot, 0, 0);
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    ring(foot, outer, 1 - (1 - t) ** 2, .003 + t * .555);
  }
  ring(outer, mouth, .025, .563);
  ring(outer, mouth, .08, .565);
  ring(outer, mouth, .92, .565);
  ring(outer, mouth, 1, .562);
  for (let i = 1; i <= 28; i++) {
    const t = i / 28;
    ring(mouth, bottom, 1 - (1 - t) ** .62, .562 - .442 * t);
  }
  const rings = vertices.length / segments;
  for (let j = 0; j < rings - 1; j++) for (let i = 0; i < segments; i++) {
    const a = j * segments + i, b = j * segments + (i + 1) % segments;
    faces.push([a, b, b + segments, a + segments]);
  }
  const floorCenter = vertices.length;
  vertices.push([...center, .12], [...center, 0]);
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faces.push([floorCenter, (rings - 1) * segments + i, (rings - 1) * segments + next]);
    faces.push([floorCenter + 1, next, i]);
  }
  const parts = [{ name: 'freedom_wall_acrylic', type: 'mesh', vertices, faces, smooth: true,
    material: 'acrylic', category: 'furniture' },
  { name: 'center_drain', type: 'cylinder', position: [.36,.83,.123], radiusTop: .032, radiusBottom: .032,
    height: .006, axis: 'z', segments: 48, material: 'chrome', category: 'furniture' },
  { name: 'drain_cap', type: 'cylinder', position: [.36,.83,.127], radiusTop: .028, radiusBottom: .028,
    height: .003, axis: 'z', segments: 48, material: 'acrylic', category: 'furniture' }];
  const overflowT = (.562 - .490) / .442;
  const overflowX = .70 + (.61 - .70) * (1 - (1 - overflowT) ** .62);
  parts.push({ name: 'overflow_slot', type: 'box', position: [overflowX-.001,.83,.49], size: [.004,.096,.012],
    bevel: .003, material: 'overflow', category: 'furniture' });
  return { name: 'Ravak Freedom Wall 166', floorHeight, materials: {
    acrylic: { color: '#f9faf8', roughness: .20 }, chrome: { color: '#b7bfbd', metalness: .92, roughness: .17 },
    overflow: { color: '#505654', metalness: .65, roughness: .28 },
  }, parts, lights: [], dimensions: { width: .8, length: 1.66, height: .565, innerDepth: .445, rearLedge: .10 },
  sources: ['https://www.ravak.cz/download/attachments/freedom-w.jpg', 'https://www.ravak.com/download/attachments/mn_freedom-w.pdf'] };
}
