export function buildStairFlight(s, { floorHeight = 0 } = {}) {
  const alongX = s.toward === 'E' || s.toward === 'W';
  const length = alongX ? s.x1 - s.x0 : s.z1 - s.z0;
  const width = alongX ? s.z1 - s.z0 : s.x1 - s.x0;
  const going = length / s.steps, height = s.steps * s.rise, waist = s.waist ?? .18;
  const foot = Math.min(length, waist * going / s.rise);
  const profile = [[0, 0], [foot, 0]];
  if (foot < length) profile.push([length, height - waist]);
  profile.push([length, height]);
  for (let i = s.steps - 1; i >= 0; i--) {
    profile.push([i * going, (i + 1) * s.rise]);
    if (i > 0) profile.push([i * going, i * s.rise]);
  }
  const point = (u, v, z) => s.toward === 'E' ? [s.x0 + u, s.z0 + v, z]
    : s.toward === 'W' ? [s.x1 - u, s.z1 - v, z]
    : s.toward === 'S' ? [s.x1 - v, s.z0 + u, z]
    : [s.x0 + v, s.z1 - u, z];
  const vertices = [0, width].flatMap(v => profile.map(([u, z]) => point(u, v, z)));
  const faces = [], n = profile.length;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    faces.push([i, i + n, next + n, next]);
  }
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const remaining = profile.map((_, i) => i);
  while (remaining.length > 3) {
    const ear = remaining.findIndex((b, i) => {
      const a = remaining[(i + remaining.length - 1) % remaining.length], c = remaining[(i + 1) % remaining.length];
      if (cross(profile[a], profile[b], profile[c]) <= 1e-12) return false;
      return !remaining.some(p => p !== a && p !== b && p !== c
        && cross(profile[a], profile[b], profile[p]) >= -1e-12
        && cross(profile[b], profile[c], profile[p]) >= -1e-12
        && cross(profile[c], profile[a], profile[p]) >= -1e-12);
    });
    if (ear < 0) throw new Error('Stair profile cannot be triangulated');
    const a = remaining[(ear + remaining.length - 1) % remaining.length], b = remaining[ear], c = remaining[(ear + 1) % remaining.length];
    faces.push([a, b, c], [a + n, c + n, b + n]);
    remaining.splice(ear, 1);
  }
  faces.push([...remaining], [...remaining].reverse().map(i => i + n));
  return { name: 'Stair flight', floorHeight,
    materials: { stair: { color: '#b59a6f', roughness: .7 } },
    parts: [{ name: 'stair_flight', type: 'mesh', vertices, faces, material: 'stair', category: 'structure', smooth: false }],
    lights: [], dimensions: { length, width, height, going, rise: s.rise, waist,
      pitchDegrees: Math.atan2(s.rise, going) * 180 / Math.PI } };
}
