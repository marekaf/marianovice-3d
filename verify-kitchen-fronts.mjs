import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { FurnitureModel } = createRequire(import.meta.url)('./furniture-model.js');
const fixture = { kind: 'cab', x0: 1, x1: 2.2, z0: 3, z1: 3.6, h: .9, plinth: .1,
  front: 'N', modules: [.6, .6], tags: ['d', 'd'] };
const legacy = FurnitureModel.build([fixture]);
assert.equal(legacy.parts.filter(p => /_pull_N_\d$/.test(p.name)).length, 2);
for (const front of ['N', 'S', 'E', 'W']) {
  const input = { ...fixture, front, ...(front === 'E' || front === 'W' ? { modules: [.3, .3] } : {}) };
  const gola = FurnitureModel.build([{ ...input, handle: 'gola' }]);
  const push = FurnitureModel.build([{ ...input, handle: 'push' }]);
  assert(!gola.parts.some(p => p.name.includes('_pull_')));
  assert(!push.parts.some(p => p.name.includes('_pull_')));
  const recess = gola.parts.find(p => p.name === `fixture_0_gola_${front}`);
  assert(recess, `${front} has a continuous grip recess`);
  assert.equal(recess.material, 'grip');
  for (const panel of gola.parts.filter(p => p.name.includes('_front_'))) {
    assert(panel.position[2] + panel.size[2] / 2 <= .855 + 1e-9);
  }
  assert.deepEqual(gola, FurnitureModel.build([{ ...input, handle: 'gola' }]));
  const upper = FurnitureModel.build([{ ...input, y0: 1.5, handle: 'gola', golaEdge: 'bottom' }]);
  const lowerGrip = upper.parts.find(p => p.name === `fixture_0_gola_${front}`);
  assert(Math.abs(lowerGrip.position[2] - 1.625) < 1e-9);
  for (const panel of upper.parts.filter(p => p.name.includes('_front_'))) {
    assert(Math.abs(panel.position[2] - panel.size[2] / 2 - 1.645) < 1e-9);
    assert(Math.abs(panel.position[2] + panel.size[2] / 2 - 2.395) < 1e-9);
  }
  for (const model of [gola, push]) for (const part of model.parts) {
    assert(part.position.every(Number.isFinite));
    if (part.size) assert(part.size.every(n => n > 0));
  }
}
const oven = FurnitureModel.build([{ ...fixture, handle: 'gola', tags: ['a', 'd'], appliances: ['oven'] }]);
assert(oven.parts.some(p => p.name === 'fixture_0_oven_glass_N_0'));
assert(!oven.parts.some(p => p.name.startsWith('fixture_0_shelf_0_')));
assert.equal(oven.parts.filter(p => /_pull_N_\d$/.test(p.name)).length, 1);
const top = { x0: .98, x1: 2.22, z0: 2.98, z1: 3.62, th: .025,
  cutouts: [{ x0: 1.1, x1: 1.5, z0: 3.1, z1: 3.5 }] };
const cutModel = FurnitureModel.build([{ ...fixture, tags: ['s', 'd'], worktop: top }]);
assert(!cutModel.parts.some(p => p.name.startsWith('fixture_0_shelf_0_')));
assert(cutModel.parts.some(p => p.name === 'fixture_0_front_N_0'));
for (const slab of cutModel.parts.filter(p => p.name.startsWith('fixture_0_top_'))) {
  const [cx, cy] = slab.position, [w, d] = slab.size;
  assert(cx + w / 2 <= 1.1 + 1e-9 || cx - w / 2 >= 1.5 - 1e-9 || cy + d / 2 <= 3.1 + 1e-9 || cy - d / 2 >= 3.5 - 1e-9);
}
const slabs = cutModel.parts.filter(p => p.name.includes('_worktop'));
assert(slabs.length > 1);
let area = 0;
for (const slab of slabs) {
  const [cx, cy] = slab.position, [w, d] = slab.size;
  const left = cx - w / 2, right = cx + w / 2, north = cy - d / 2, south = cy + d / 2;
  assert(left >= top.x0 - 1e-9 && right <= top.x1 + 1e-9 && north >= top.z0 - 1e-9 && south <= top.z1 + 1e-9);
  assert(right <= 1.1 + 1e-9 || left >= 1.5 - 1e-9 || south <= 3.1 + 1e-9 || north >= 3.5 - 1e-9);
  area += w * d;
}
assert(Math.abs(area - (.7936 - .16)) < 1e-9);
console.log('Kitchen front checks passed: default pulls, Gola, push fronts, four orientations, opt-in oven and worktop opening.');
