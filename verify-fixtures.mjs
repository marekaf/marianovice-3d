import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { FurnitureModel } = require('./furniture-model.js');
const { FIXTURE_SAMPLES } = require('./fixture-samples.js');
function points(part) {
  if (part.vertices) return part.vertices;
  if (part.type === 'beam') return [part.start, part.end];
  let size = part.size;
  if (part.type === 'cylinder') {
    const diameter = 2 * Math.max(part.radiusTop, part.radiusBottom);
    size = [diameter, diameter, diameter];
    size[{ x: 0, y: 1, z: 2 }[part.axis || 'z']] = part.height;
  }
  if (part.type === 'lathe') {
    const radius = Math.max(...part.profile.map(p => p[0]));
    return [-radius, radius].flatMap(x => [-radius, radius].flatMap(y => part.profile.map(p =>
      [part.position[0] + x, part.position[1] + y, part.position[2] + p[1]])));
  }
  return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z =>
    part.position.map((v, axis) => v + [x, y, z][axis] * size[axis] / 2))));
}
const cases = [...FIXTURE_SAMPLES];
for (const type of ['bath', 'basin', 'wc']) cases.push({ id: `compact-${type}`, furniture: [
  { kind: 'fix', type, x0: 0, z0: 0, x1: 0.3, z1: 0.4, h: 0.18 },
] });
for (const front of ['N', 'S', 'E', 'W', ['N', 'S'], ['E', 'W'], undefined]) {
  const alongX = front === undefined || (Array.isArray(front) ? front[0] : front) === 'N' || (Array.isArray(front) ? front[0] : front) === 'S';
  cases.push({ id: `cabinet-${front}`, furniture: [{ kind: 'cab', front, x0: 0, z0: 0,
    x1: alongX ? 1.8 : 0.6, z1: alongX ? 0.6 : 1.8, h: 0.75, y0: 0.4,
    modules: [0.3, 0.5, 0.5, 0.5], tags: ['f', 'd', 'a', 'o'], plinth: 0.08,
    worktop: 0.025 }] });
}
for (const head of ['N', 'S', 'E', 'W']) cases.push({ id: `bed-${head}`, furniture: [
  { kind: 'bed', x0: 0, z0: 0, x1: 1, z1: 2, h: 0.45, head },
] });
for (const sample of cases) {
  const model = FurnitureModel.build(sample.furniture, 1.25);
  assert.equal(model.floorHeight, 1.25);
  assert.deepEqual(model, FurnitureModel.build(sample.furniture, 1.25));
  assert.deepEqual(model.parts, FurnitureModel.build(sample.furniture, -0.5).parts, 'Floor offset applied inside geometry');
  assert.equal(new Set(model.parts.map(p => p.name)).size, model.parts.length);
  const f = sample.furniture[0];
  const margin = f.kind === 'cab' ? 0.025 : 0.001;
  for (const part of model.parts) {
    assert.ok(model.materials[part.material], `${part.name}: unknown material`);
    if (part.size) assert.ok(part.size.every(v => v > 0), `${part.name}: degenerate size`);
    for (const p of points(part)) {
      assert.ok(p.every(Number.isFinite), `${part.name}: non-finite point`);
      assert.ok(p[0] >= f.x0 - margin && p[0] <= f.x1 + margin, `${sample.id}/${part.name}: width exceeds envelope`);
      assert.ok(p[1] >= f.z0 - margin && p[1] <= f.z1 + margin, `${sample.id}/${part.name}: depth exceeds envelope`);
      assert.ok(p[2] >= (f.y0 || 0) - 0.001 && p[2] <= (f.y0 || 0) + f.h + (f.worktop || 0) + 0.001,
        `${sample.id}/${part.name}: height exceeds envelope`);
    }
  }
}
assert.equal(FurnitureModel.build([]).parts.length, 0);
const topRect = { x0: -0.05, z0: -0.04, x1: 1.1, z1: 0.7, th: 0.03 };
const custom = FurnitureModel.build([{ kind: 'cab', front: 'S', x0: 0, z0: 0, x1: 1, z1: 0.6,
  h: 0.9, worktop: topRect, fmat: 'green', cmat: 'wood', wmat: 'stone' }]);
const worktop = custom.parts.find(p => p.name === 'fixture_0_worktop');
assert.equal(worktop.material, 'stone');
assert.equal(custom.parts.find(p => p.name === 'fixture_0_front_S_0').material, 'green');
assert.equal(custom.parts.find(p => p.name === 'fixture_0_bottom').material, 'wood');
for (const [axis, expected] of [[0, [topRect.x0, topRect.x1]], [1, [topRect.z0, topRect.z1]], [2, [0.9, 0.93]]]) {
  const values = points(worktop).map(p => p[axis]);
  assert.ok(Math.abs(Math.min(...values) - expected[0]) < 1e-6 && Math.abs(Math.max(...values) - expected[1]) < 1e-6,
    'Custom worktop rectangle must be exact');
}
console.log(`Fixtures: ${cases.length} samples; finite geometry, footprints, heights and floor offsets pass`);
