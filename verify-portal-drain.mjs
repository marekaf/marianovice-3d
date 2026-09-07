import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { PortalDrainModel } = require('./portal-drain-model.js');
const model = PortalDrainModel.build(GARDEN, 2.465);
assert.equal(model.status, 'visual proposal');
assert.equal(model.facadeGap, .012);
assert.ok(Math.abs(model.footprint.x - 20.592) < 1e-8);
assert.ok(Math.abs(model.footprint.d - 5.16) < 1e-8);
assert.ok(model.parts.length > 100);
for (const part of model.parts) {
  const [x, z, y] = part.position, [w, d, h] = part.size;
  assert.ok([...part.position, ...part.size].every(Number.isFinite));
  assert.ok(part.size.every(value => value > 0));
  assert.ok(y + h / 2 <= 1e-9, 'No raised lip across the portal');
  assert.ok(x - w / 2 >= model.footprint.x - 1e-9 && x + w / 2 <= model.footprint.x + model.footprint.w + 1e-9);
  assert.ok(z - d / 2 >= model.footprint.y - 1e-9 && z + d / 2 <= model.footprint.y + model.footprint.d + 1e-9);
}
const board = { x: 20.58, y: 14.17, w: 3, d: .137 };
const pieces = PortalDrainModel.boardPieces(board, model);
assert.equal(pieces.length, 2);
for (const p of pieces) {
  assert.ok(p.x >= 20.592 - 1e-9);
  assert.ok(p.x + p.w <= 23.58 + 1e-9);
  const f = model.footprint;
  assert.ok(!(p.x < f.x + f.w && p.x + p.w > f.x && p.y < f.y + f.d && p.y + p.d > f.y));
}
const local = PortalDrainModel.build(GARDEN, 2.465, [
  { model: { opening: { sliding: true, width: 4 } }, match: { axis: 'x', wall: 20.13, center: 16.4 } },
]);
assert.ok(Math.abs(local.footprint.y - 14.4) < 1e-8);
assert.equal(local.footprint.d, 4);
console.log('Portal drain: flush, bounded, source-aligned; deck boards clear the channel.');
