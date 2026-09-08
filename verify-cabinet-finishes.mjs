import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { FurnitureModel } = createRequire(import.meta.url)('./furniture-model.js');
const fixture = { kind: 'cab', x0: 1, x1: 2.2, z0: 3, z1: 3.6, h: .9, plinth: .1,
  front: 'N', modules: [.6, .6], tags: ['d', 'd'], cmat: 'green', fmat: 'cashmere', handle: 'push' };
const bounds = parts => [0, 1, 2].map(axis => [
  Math.min(...parts.map(p => p.position[axis] - p.size[axis] / 2)),
  Math.max(...parts.map(p => p.position[axis] + p.size[axis] / 2)),
]);
for (const front of ['N', 'S', 'E', 'W']) {
  const input = { ...fixture, front, ...(front === 'E' || front === 'W' ? { modules: [.3, .3] } : {}) };
  const original = FurnitureModel.build([input]);
  assert.deepEqual(original, FurnitureModel.build([{ ...input, imat: 'green' }]));
  assert.deepEqual(original, FurnitureModel.build([{ ...input, imat: 'unknown' }]));
  const finished = FurnitureModel.build([{ ...input, imat: 'whiteBoard' }]);
  assert.deepEqual(bounds(finished.parts), bounds(original.parts));
  assert.equal(finished.parts.filter(p => /_inner_[NSEW]$/.test(p.name)).length, 3);
  assert.equal(finished.parts.filter(p => p.name.includes('_inner_front_')).length, 2);
  for (const part of finished.parts) {
    assert(part.position.every(Number.isFinite));
    assert(part.size.every(n => Number.isFinite(n) && n > 0));
    if (/_inner_|_shelf_|_divider_/.test(part.name)) assert.equal(part.material, 'whiteBoard');
    else assert.deepEqual(part, original.parts.find(p => p.name === part.name));
  }
}
const cutout = { x0: 1.1, x1: 1.5, z0: 3.1, z1: 3.5 };
const sink = FurnitureModel.build([{ ...fixture, imat: 'whiteBoard', tags: ['s', 'd'],
  wmat: 'cashmereTop', worktop: { x0: 1, x1: 2.2, z0: 3, z1: 3.6, th: .038, cutouts: [cutout] } }]);
for (const part of sink.parts.filter(p => /_inner_top|_top|_worktop/.test(p.name))) {
  const [[x0, x1], [z0, z1]] = bounds([part]);
  assert(x1 <= cutout.x0 + 1e-9 || x0 >= cutout.x1 - 1e-9 || z1 <= cutout.z0 + 1e-9 || z0 >= cutout.z1 - 1e-9);
}
assert(sink.parts.filter(p => p.name.includes('_worktop')).every(p => p.material === 'cashmereTop'));
assert.equal(sink.materials.cashmere.color, '#b8b2a7');
assert.equal(sink.materials.cashmereTop.roughness, .45);
assert.equal(sink.materials.whiteBoard.roughness, .75);
assert.equal(sink.materials.greenMatt.color, sink.materials.green.color);
assert(sink.materials.greenMatt.roughness > sink.materials.green.roughness);
console.log('Cabinet finish checks passed: opt-in interiors, unchanged defaults/bounds, four faces and sink cutout.');
