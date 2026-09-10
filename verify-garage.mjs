import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { TERRAIN } = require('./terrain.js');
const { GarageModel } = require('./garage-model.js');
const floorHeight = TERRAIN.houseFFLInternal - 0.5;
const model = GarageModel.build(GARDEN, floorHeight);
const element = GARDEN.elements.find(e => e.id === 'garage');
const rect = element.parts.find(p => p.kind === 'rect');
const parts = new Map(model.parts.map(p => [p.name, p]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.0001, `${a} != ${b}`);
const rounded = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v));
const bounds = part => part.vertices
  ? [0, 1, 2].map(axis => [Math.min(...part.vertices.map(p => p[axis])), Math.max(...part.vertices.map(p => p[axis]))])
  : part.position.map((v, axis) => [v - part.size[axis] / 2, v + part.size[axis] / 2]);
assert.equal(parts.size, model.parts.length, 'Part names must be unique');
assert.deepEqual(model, GarageModel.build(GARDEN, floorHeight));
assert.equal(model.categoryVisibility.gateOpen, false);
assert.equal(model.materials.render.color, GarageModel.facadeFinish.color);
assert.equal(GarageModel.facadeFinish.code, 'HN3E');
assert.equal(GarageModel.facadeFinish.hbw, 61.9);
assert.equal(model.materials.render.color, '#e2cec5');
assert.equal(model.materials.foundation.finish, 'marmolit');
for (const part of model.parts.filter(part => part.name.startsWith('wall_plinth_'))) {
  near(part.position[2] + part.size[2] / 2, .25);
  const side = part.name.split('_')[2], along = ['N', 'S'].includes(side) ? 0 : 1;
  const [min, max] = bounds(part)[along];
  for (const opening of element.meta.openings.filter(opening => opening.wall === side)) {
    assert(Math.min(max, opening.from + opening.w) - Math.max(min, opening.from) < 1e-8, 'Plinth clears garage openings');
  }
}
assert.equal(model.materials.gateLightGrey.color,'#c6c9c7');
assert.match(model.gateFinish.note,/approximate/);
assert.equal(parts.get('personnel_leaf').material,'charcoal');
assert.deepEqual(model.groundPatch, GarageModel.groundPatch(GARDEN, floorHeight));
near(model.floorHeight - model.groundPatch.level, 0.04);
const sectionModel = GarageModel.build(GARDEN, -.5);
const roofAt = x => x < 27.74 ? 3.5 + (x - 27.74) * Math.tan(2 * Math.PI / 180) : 3.5 - (x - 27.74) * .7 / 6.39;
for (const side of ['W', 'E']) {
  const wall = sectionModel.parts.find(part => part.name === `wall_${side}_0`);
  const x = side === 'W' ? rect.x : rect.x + rect.w;
  const edge = wall.vertices.slice(4).filter(vertex => Math.abs(vertex[0] - x) < 1e-8);
  assert.equal(edge.length, 2);
  for (const vertex of edge) near(vertex[2] + sectionModel.floorHeight, side === 'W' ? 3 - .11 * Math.tan(2 * Math.PI / 180) : 2.3);
}
for (const wall of model.parts.filter(part => /^wall_(?:lining_)?[NSEW]_/.test(part.name) && part.vertices)) {
  const xs=wall.vertices.map(v=>v[0]);
  assert(!(Math.min(...xs)<27.74-1e-8&&Math.max(...xs)>27.74+1e-8),'Wall caps split at the ridge instead of bridging the two slopes');
  for(const vertex of wall.vertices.slice(4))near(vertex[2],roofAt(vertex[0]));
}
for (const part of model.parts.filter(part => part.name === 'ceiling_backing' || part.name.startsWith('ceiling_board_'))) {
  const offset = part.name === 'ceiling_backing' ? .01 : .035;
  for (const vertex of part.vertices.slice(4)) near(vertex[2], roofAt(vertex[0]) - offset);
}
near(bounds(parts.get('opener_mount'))[2][1], roofAt(bounds(parts.get('opener_mount'))[0][1]) - .06);
for (const height of [-0.5, 0, floorHeight]) {
  const shifted = GarageModel.build(GARDEN, height);
  assert.deepEqual(rounded(shifted.parts), rounded(model.parts), 'Floor offset must not change local geometry');
  near(shifted.dims.wallTop - height, 2.8);
  near(shifted.dims.roofHigh - height, 3.5);
}
for (const part of model.parts) {
  assert.ok(model.materials[part.material], `${part.name}: unknown material`);
  assert.ok(['N', 'S', 'E', 'W', 'floor', 'roof', 'furniture', 'gateClosed', 'gateOpen'].includes(part.category));
  const values = [...part.position || [], ...part.size || [], ...part.start || [], ...part.end || [], ...part.vertices?.flat() || []];
  assert.ok(values.every(Number.isFinite), `${part.name}: non-finite geometry`);
  if (part.size) assert.ok(part.size.every(v => v > 0), `${part.name}: non-positive size`);
  if (part.type === 'beam') assert.ok(Math.hypot(...part.start.map((v, i) => v - part.end[i])) > 0.001);
}
near(bounds(parts.get('garage_floor'))[2][1], 0);
near(bounds(parts.get('garage_foundation'))[2][1], bounds(parts.get('garage_floor'))[2][0]);
for (const opening of element.meta.openings) {
  const axis = ['N', 'S'].includes(opening.wall) ? 0 : 1;
  for (const wall of model.parts.filter(p => p.name.startsWith(`wall_${opening.wall}_`) || p.name.startsWith(`wall_lining_${opening.wall}_`))) {
    const b = bounds(wall);
    const overlap = Math.min(b[axis][1], opening.from + opening.w) - Math.max(b[axis][0], opening.from);
    assert.ok(overlap < 0.0001 || b[2][0] >= opening.h, `${wall.name}: blocks opening`);
  }
}
const gate = element.meta.openings.find(o => o.kind === 'gate');
for (const state of ['gateClosed', 'gateOpen']) {
  const panels = model.parts.filter(p => p.name.startsWith(`${state}_panel_`));
  assert.equal(panels.length, 5);
  const skins=model.parts.filter(p=>p.name.startsWith(`${state}_interior_skin_`));
  assert.equal(skins.length,5);
  assert(skins.every(p=>p.material==='gateInteriorWhite'));
  for (const panel of panels) {
    assert.equal(panel.material,'gateLightGrey');
    const b = bounds(panel);
    assert.ok(b[0][0] >= gate.from && b[0][1] <= gate.from + gate.w);
    if (state === 'gateClosed') assert.ok(b[2][0] >= 0 && b[2][1] <= gate.h);
    else assert.ok(b[2][0] >= gate.h && b[1][1] <= rect.y + rect.d);
  }
}
const feet = model.parts.filter(p => p.name.startsWith('bench_foot_'));
assert.equal(feet.length, 6);
for (const foot of feet) near(foot.position[2] - foot.height / 2, 0);
const furniture = model.parts.filter(p => p.category === 'furniture' && p.type === 'box');
for (const part of furniture) {
  const b = bounds(part);
  assert.ok(b[0][0] >= rect.x + element.meta.wallT && b[0][1] <= rect.x + rect.w - element.meta.wallT);
  assert.ok(b[1][0] >= rect.y + element.meta.wallT);
  for (const vehicle of GARDEN.vehicles.filter(v => v.bay === 'garage')) {
    assert.ok(b[1][1] < vehicle.noseZ, `${part.name}: encroaches on parking`);
  }
}
console.log(`Garage: ${model.parts.length} parts; openings, gate states, floor datum and parking clearances pass`);
