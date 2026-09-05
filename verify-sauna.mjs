import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { TERRAIN } = require('./terrain.js');
const { SaunaModel } = require('./sauna-model.js');
const model = SaunaModel.build(GARDEN, TERRAIN.plane);
const parts = new Map(model.parts.map(p => [p.name, p]));
const rect = id => GARDEN.elements.find(e => e.id === id).parts.find(p => p.kind === 'rect');
const sauna = rect('sauna');
const top = p => p.position[2] + p.size[2] / 2;
const bottom = p => p.position[2] - p.size[2] / 2;
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.001, `${a} != ${b}`);
const bounds = p => ({ min: p.position.map((v, i) => v - p.size[i] / 2), max: p.position.map((v, i) => v + p.size[i] / 2) });
const overlaps = (a, b) => a.min.every((v, i) => Math.min(a.max[i], b.max[i]) - Math.max(v, b.min[i]) > 0.001);

assert.equal(parts.size, model.parts.length, 'Part names must be unique');
assert.deepEqual(model, SaunaModel.build(GARDEN, TERRAIN.plane), 'Geometry must be repeatable');
for (const [name, category] of Object.entries({ wall_north: 'N', wall_west: 'W', wall_east: 'E',
  window_glass: 'S', door_glass: 'S', sauna_floor: 'floor', sauna_roof: 'roof', sauna_ceiling: 'roof',
  heater_body: 'furniture', bench_1_slat_0: 'furniture', tub_shell: 'outdoor', shelter_roof: 'outdoor' })) {
  assert.equal(parts.get(name).category, category, `${name}: incorrect cutaway owner`);
}
for (const part of model.parts) {
  assert.ok(['N', 'S', 'E', 'W', 'floor', 'roof', 'furniture', 'outdoor'].includes(part.category), `${part.name}: missing cutaway owner`);
  assert.ok(model.materials[part.material], `${part.name}: missing material`);
  for (const value of [...part.position || [], ...part.size || [], ...part.vertices?.flat() || [], ...part.profile?.flat() || []]) {
    assert.ok(Number.isFinite(value), `${part.name}: non-finite geometry`);
  }
  if (part.size) assert.ok(part.size.every(v => v > 0), `${part.name}: degenerate dimensions`);
}

for (const opening of model.openings) {
  const aperture = { min: [sauna.x + opening.from + 0.06, sauna.y + sauna.d - 0.14, opening.bottom + 0.06],
    max: [sauna.x + opening.to - 0.06, sauna.y + sauna.d + 0.028, opening.top - 0.06] };
  for (const part of model.parts.filter(p => p.type === 'box' && /^(wall_|cladding_)/.test(p.name))) {
    assert.ok(!overlaps(aperture, bounds(part)), `${part.name} blocks ${opening.name}`);
  }
}
const door = model.openings.find(o => o.name === 'door');
const passage = { min: [sauna.x + door.from + 0.07, sauna.y + sauna.d - 1, 0.08],
  max: [sauna.x + door.to - 0.07, sauna.y + sauna.d - 0.17, 2.05] };
for (const part of model.parts.filter(p => p.type === 'box' && /^(bench_|heater_)/.test(p.name))) {
  assert.ok(!overlaps(passage, bounds(part)), `${part.name} obstructs the entrance`);
}

const tub = GARDEN.elements.find(e => e.id === 'softub').parts.find(p => p.kind === 'circle');
for (const part of model.parts.filter(p => p.name.startsWith('log_'))) {
  if (!part.position) continue;
  const radius = part.size ? Math.hypot(part.size[0], part.size[1]) / 2 : Math.hypot(part.radiusTop, part.height / 2);
  assert.ok(Math.hypot(part.position[0] - tub.cx, part.position[1] - tub.cy) > radius + tub.r,
    `${part.name} intersects the tub`);
}
const profile = parts.get('tub_shell').profile;
assert.ok(profile.some(([radius, height]) => radius < tub.r - 0.1 && height > 0.7), 'Tub needs an inner wall');
assert.ok(Math.max(...profile.map(p => p[1])) > parts.get('tub_water').position[2] + 0.1, 'Water must sit below the rim');
near(parts.get('tub_base').position[2] - parts.get('tub_base').height / 2, 0);
near(top(parts.get('heater_hearth')), bottom(parts.get('heater_foot_0')));
assert.ok(top(parts.get('heater_foot_0')) >= bottom(parts.get('heater_body')), 'Heater needs supporting feet');
near(top(parts.get('ceiling_light_housing')), bottom(parts.get('sauna_ceiling')));
near(top(parts.get('bench_light')), bottom(parts.get('bench_1_slat_0')));

for (const part of model.parts.filter(p => p.name.startsWith('entry_tread'))) {
  const b = bounds(part);
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) {
    assert.ok(model.floorHeight + top(part) > TERRAIN.basePlaneHeight(x, y), `${part.name} is buried`);
  }
}
const roof = parts.get('shelter_roof').vertices;
const roofHeight = y => roof[0][2] + (y - roof[0][1]) * (roof[2][2] - roof[0][2]) / (roof[2][1] - roof[0][1]);
for (const part of model.parts.filter(p => p.name.startsWith('shelter_rafter'))) {
  for (const vertex of [part.vertices[4], part.vertices[6]]) {
    assert.ok(vertex[2] >= roofHeight(vertex[1]) - 0.002, `${part.name} does not reach its roof`);
  }
}
const landing = GARDEN.elements.find(e => e.id === 'saunaPath').parts.find(p => p.role === 'saunaLanding');
near(landing.y, sauna.y + sauna.d);
assert.ok(landing.x <= sauna.x + door.from && landing.x + landing.w >= sauna.x + door.to, 'Door must open onto landing');
const approach = GARDEN.elements.find(e => e.id === 'saunaPath').parts.find(p => !p.role);
near(landing.y + landing.d, approach.y);
for (const fixture of GARDEN.elements.filter(e => e.meta?.light).flatMap(e => e.parts.filter(p => p.kind === 'circle'))) {
  for (const r of [sauna, rect('saunaShelter'), landing]) {
    assert.ok(!(fixture.cx > r.x && fixture.cx < r.x + r.w && fixture.cy > r.y && fixture.cy < r.y + r.d),
      'A garden light intersects the sauna area');
  }
}
assert.ok(model.plantingClearances.some(r => r.x <= landing.x && r.y <= landing.y && r.x + r.w >= landing.x + landing.w),
  'Landing must be excluded from planting');
console.log(`Sauna: ${model.parts.length} parts; openings, access, footing, roof joins and tub clearance pass`);
