import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GradingNotation } = require('./grading-notation.js');
const rect = [[0, 0], [8, 0], [8, 4], [0, 4]];
const lines = svg => [...svg.matchAll(/<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)].map(match => match.slice(1).map(Number));
const render = (points, height, extra = {}) => GradingNotation.bankHachures({
  garden: { gradingBanks: [{ id: 'north', points, ...extra }] },
  site: { height }, px: x => x * 20, pz: z => z * 20, scale: 20
});

for (const height of [(x, z) => z, (x, z) => -z, x => x]) {
  const svg = render(rect, height);
  assert.match(svg, /data-bank-hachure="north"/);
  assert.match(svg, /clip-path="url\(#/);
  assert.ok(!svg.includes('NaN'));
  const marks = lines(svg);
  assert.ok(marks.length > 5);
  for (const [x1, z1, x2, z2] of marks) {
    assert.ok(Math.hypot(x2 - x1, z2 - z1) > 0);
    assert.ok(height(x1 / 20, z1 / 20) > height(x2 / 20, z2 / 20), 'strokes start on the higher bank edge');
    for (const [x, z] of [[x1, z1], [x2, z2]]) assert.ok(x >= 0 && x <= 160 && z >= 0 && z <= 80, 'strokes remain inside bank');
  }
  const lengths = marks.map(([x1, z1, x2, z2]) => Math.hypot(x2 - x1, z2 - z1));
  assert.ok(lengths[0] > lengths[1] * 1.5 && lengths[2] > lengths[1] * 1.5, 'long and short strokes alternate');
}

const slanted = [[0, 0], [8, 2], [7, 6], [-1, 4]];
const slantedSvg = render(slanted, (x, z) => z - x / 4, { spotCrest: [3, 5], spotFoot: [4, 1] });
for (const [x1, z1, x2, z2] of lines(slantedSvg)) {
  for (const [x, z] of [[x1 / 20, z1 / 20], [x2 / 20, z2 / 20]]) {
    for (let i = 0; i < slanted.length; i++) {
      const a = slanted[i], b = slanted[(i + 1) % slanted.length];
      assert.ok((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) >= -0.001, 'slanted polygon clips each stroke');
    }
  }
  assert.ok(z1 - x1 / 4 > z2 - x2 / 4);
}
assert.equal(render(rect, () => 2), '', 'flat ground has no slope hatching');
assert.equal(render([[0, 0], [0, 0], [0, 0]], () => 2), '');
assert.equal(GradingNotation.bankHachures({ garden: {}, site: { height: () => 0 }, px: x => x, pz: z => z, scale: 1 }), '');
const overlapping = GradingNotation.bankHachures({
  garden: { gradingBanks: [
    { id: 'north', points: rect, spotCrest: [4, 4], spotFoot: [4, 0] },
    { id: 'east', points: [[5, 0], [9, 0], [9, 8], [5, 8]], spotCrest: [5, 4], spotFoot: [9, 4] }
  ] },
  site: { height: (x, z) => z - x }, px: x => x * 20, pz: z => z * 20, scale: 20
});
const eastStrokes = lines(overlapping.split('data-bank-hachure="east"')[1]);
assert.ok(eastStrokes.length > 5);
for (const [x1, z1, x2, z2] of eastStrokes) {
  for (let i = 0; i <= 20; i++) {
    const x = (x1 + (x2 - x1) * i / 20) / 20, z = (z1 + (z2 - z1) * i / 20) / 20;
    assert.ok(!(x > 0 && x < 8 && z > 0 && z < 4), 'later bank strokes never enter the earlier bank polygon');
    assert.ok(x >= 5 && x <= 9 && z >= 0 && z <= 8);
  }
}
const { GARDEN } = require('./layout.js');
const realBanks = GradingNotation.bankHachures({ garden: GARDEN, site: { height: (x, z) => z - x }, px: x => x * 20, pz: z => z * 20, scale: 20 });
const [northSvg, eastSvg] = realBanks.split('data-bank-hachure="east"');
const northLines = lines(northSvg), eastLines = lines(eastSvg);
assert.ok(northLines.length > 5 && eastLines.length > 5);
for (const [ax, ay, bx, by] of northLines) for (const [cx, cy, dx, dy] of eastLines) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const cross = rx * sy - ry * sx;
  if (Math.abs(cross) < 1e-8) continue;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / cross;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / cross;
  assert.ok(!(t > 1e-5 && t < 1 - 1e-5 && u > 1e-5 && u < 1 - 1e-5), 'north/east hachures never cross in the actual bank footprints');
}
console.log('Grading notation: downhill orientation, alternating lengths, polygon clipping and overlap precedence passed.');
