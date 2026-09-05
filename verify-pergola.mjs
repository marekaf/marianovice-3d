import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { PergolaModel } = require('./pergola-model.js');
const model = PergolaModel.build(GARDEN);
const parts = new Map(model.parts.map(p => [p.name, p]));
const element = GARDEN.elements.find(e => e.id === 'pergola');
const paving = element.parts.find(p => p.role === 'paving');
const table = element.parts.find(p => p.role === 'table');
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 0.001, message || `${a} != ${b}`);
const top = p => p.position[2] + p.size[2] / 2;
const bottom = p => p.position[2] - p.size[2] / 2;
const overlapsXY = (a, b) => [0, 1].every(i =>
  Math.abs(a.position[i] - b.position[i]) < (a.size[i] + b.size[i]) / 2 - 0.001);
const inside = (point, box, margin = 0) => point.every((v, i) =>
  Math.abs(v - box.position[i]) <= box.size[i] / 2 + margin);

assert.equal(parts.size, model.parts.length, 'Part names must be unique');
assert.deepEqual(model, PergolaModel.build(GARDEN), 'Geometry must be repeatable');
near(model.floorHeight - model.groundPatch.level, 0.1);
near(model.groundPatch.level, element.meta.grading.level);
for (const part of model.parts) {
  assert.ok(model.materials[part.material], `${part.name}: unknown material`);
  assert.ok(['structure', 'roof', 'furniture'].includes(part.category));
  const values = [...part.position || [], ...part.size || [], ...part.start || [], ...part.end || [], ...part.profile?.flat() || []];
  assert.ok(values.every(Number.isFinite), `${part.name}: non-finite geometry`);
  if (part.size) assert.ok(part.size.every(v => v > 0), `${part.name}: non-positive size`);
  if (part.type === 'beam') {
    assert.ok(Math.hypot(...part.start.map((v, i) => v - part.end[i])) > 0.02);
    assert.ok(part.width > 0 && part.depth > 0);
  }
}
for (let i = 0; i < 4; i++) {
  const post = parts.get(`post_${i}`);
  near(bottom(post), top(parts.get(`post_plate_${i}`)), `Post ${i} needs a base`);
  near(bottom(parts.get(`post_plate_${i}`)), top(parts.get(`post_footing_${i}`)));
  const beam = parts.get(`beam_x_${i < 2 ? 0 : 1}`);
  assert.ok(overlapsXY(post, beam));
  near(top(post), bottom(beam));
  for (const axis of ['x', 'y']) {
    const brace = parts.get(`brace_${axis}_${i}`);
    assert.ok(inside(brace.start, post, 0.001), `${brace.name} misses its post`);
    const support = axis === 'x' ? beam : parts.get(`beam_y_${i % 2}`);
    assert.ok(inside(brace.end, support, 0.06), `${brace.name} misses its beam`);
  }
}
const rafters = model.parts.filter(p => p.name.startsWith('rafter_'));
const beams = model.parts.filter(p => p.name.startsWith('beam_x_'));
for (const rafter of rafters) {
  assert.equal(beams.filter(b => overlapsXY(rafter, b) && Math.abs(top(b) - bottom(rafter)) < 0.001).length, 2,
    `${rafter.name} needs support at both ends`);
}
for (const slat of model.parts.filter(p => p.name.startsWith('roof_slat_'))) {
  assert.ok(rafters.filter(r => overlapsXY(slat, r) && Math.abs(top(r) - bottom(slat)) < 0.001).length >= 2,
    `${slat.name} lacks support`);
}
for (const leg of model.parts.filter(p => /^(table|bench|chair).*_leg_/.test(p.name))) {
  near(bottom(leg), 0, `${leg.name} floats above the pavement`);
  assert.ok(leg.position[0] > paving.x && leg.position[0] < paving.x + paving.w);
  assert.ok(leg.position[1] > paving.y && leg.position[1] < paving.y + paving.d);
}
near(top(parts.get('table_trestle_0')), bottom(parts.get('table_board_0')));
assert.ok(top(parts.get('table_leg_0_0')) >= bottom(parts.get('table_trestle_0')),
  'Table leg must reach trestle');
for (const side of ['north', 'south']) {
  near(top(parts.get(`bench_${side}_leg_0_0`)), bottom(parts.get(`bench_${side}_seat_0`)));
  near(top(parts.get(`bench_${side}_apron_0`)), bottom(parts.get(`bench_${side}_seat_0`)));
}
for (const [width, depth] of [[paving.w, paving.d], [5.6, 3], [8.3, 4.5]]) {
  const garden = structuredClone(GARDEN);
  const resized = garden.elements.find(e => e.id === 'pergola').parts.find(p => p.role === 'paving');
  Object.assign(resized, { w: width, d: depth });
  const slabs = PergolaModel.build(garden).parts.filter(p => p.name.startsWith('paver_'));
  for (const slab of slabs) {
    near(top(slab), 0);
    for (const [axis, start, length] of [[0, resized.x, width], [1, resized.y, depth]]) {
      assert.ok(slab.position[axis] - slab.size[axis] / 2 >= start, 'Paver overhangs foundation');
      assert.ok(slab.position[axis] + slab.size[axis] / 2 <= start + length, 'Paver overhangs foundation');
    }
  }
  const coveredArea = slabs.reduce((area, slab) => area + (slab.size[0] + 0.006) * (slab.size[1] + 0.006), 0);
  near(coveredArea, width * depth, 'Pavers and joints must cover the footprint');
}
for (const item of model.parts.filter(p => /^(plate_|glass_|serving_bowl)/.test(p.name))) {
  near(item.position[2], top(parts.get('table_board_0')));
  assert.ok(item.position[0] > table.x && item.position[0] < table.x + table.w);
  assert.ok(item.position[1] > table.y && item.position[1] < table.y + table.d);
}
near(top(parts.get('pendant_diffuser')), bottom(parts.get('pendant_body')));
for (const cord of model.parts.filter(p => p.name.startsWith('pendant_cord'))) {
  near(cord.position[2] + cord.height / 2, bottom(parts.get('pendant_anchor')));
  assert.ok(cord.position[2] - cord.height / 2 <= top(parts.get('pendant_body')));
}
assert.ok(model.plantingClearances.some(r => r.x <= paving.x && r.y <= paving.y && r.x + r.w >= paving.x + paving.w
  && r.y + r.d >= paving.y + paving.d), 'Pavement must remain clear of plants');
console.log(`Pergola: ${model.parts.length} parts; frame connections, grounded furniture, paving and lighting pass`);
