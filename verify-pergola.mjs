import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { TERRAIN } = require('./terrain.js');
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
near(TERRAIN.houseFFLInternal - model.floorHeight, 0.75, 'Pergola finish must sit 75 cm below the bedroom floor');
near(model.groundPatch.level, element.meta.grading.level);
const { site } = require('./grading-site.js').GradingSite.create({garden:GARDEN,terrain:TERRAIN});
near(site.routeHeight(27,11.2),model.floorHeight,'Terrace approach must meet the lowered pergola');
near(site.routeHeight(30.5,10.6),model.floorHeight,'Firepit connection must start at the lowered pergola');
near(site.routeHeight(32.6,8),1.615,'Firepit finish must remain unchanged');
near(model.floorHeight-site.routeHeight(32.6,8),.1,'Firepit remains below the pergola');
near(site.height(28,8.8),model.floorHeight-.1,'Ground and paving must lower together');
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
near(table.w, 2.4);
near(table.d, 1.1);
near(model.diningTable.center[0], table.x+table.w/2);
near(model.diningTable.center[1], table.y+table.d/2);
near(model.diningTable.height, .75);
const tableTop = parts.get('table_ceramic_top');
near(Math.max(...tableTop.vertices.map(p => p[2])), .75);
near(Math.min(...tableTop.vertices.map(p => p[2])), .741);
assert.equal(tableTop.material, 'table_ceramic');
for (const [axis, span] of [[0,2.4],[1,1.1]]) near(Math.max(...tableTop.vertices.map(p=>p[axis]))-Math.min(...tableTop.vertices.map(p=>p[axis])),span);
for (let i=0;i<4;i++) {
  const foot=parts.get(`table_foot_${i}`),lower=parts.get(`table_lower_branch_${i}`),upper=parts.get(`table_upper_branch_${i}`);
  near(bottom(foot),0);
  near(Math.min(...lower.vertices.map(p=>p[2])),top(foot));
  assert.ok(Math.max(...lower.vertices.map(p=>p[2]))>Math.min(...upper.vertices.map(p=>p[2])));
  near(Math.max(...upper.vertices.map(p=>p[2])),.695);
  assert.ok(foot.position[0]>paving.x && foot.position[0]<paving.x+paving.w);
  assert.ok(foot.position[1]>paving.y && foot.position[1]<paving.y+paving.d);
}
assert.equal(model.diningSeats.length, 8);
assert.ok(!model.parts.some(p => p.name.startsWith('bench_')));
for (const seat of model.diningSeats) {
  near(top(parts.get(`${seat.name}_seat`)), .47);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const glide = parts.get(`${seat.name}_glide_${i}_${j}`);
    const leg = parts.get(`${seat.name}_leg_${i}_${j}`);
    near(bottom(glide), 0, 'Chair glide must touch pavement');
    near(leg.start[2], top(glide));
    assert.ok(leg.end[2] >= bottom(parts.get(`${seat.name}_seat`)), 'Chair leg must reach seat');
    assert.ok(glide.position[0] > paving.x && glide.position[0] < paving.x + paving.w);
    assert.ok(glide.position[1] > paving.y && glide.position[1] < paving.y + paving.d);
  }
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
  near(item.position[2], model.diningTable.height);
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
