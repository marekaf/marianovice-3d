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
assert.deepEqual(model.groundPatch, GarageModel.groundPatch(GARDEN, floorHeight));
near(model.floorHeight - model.groundPatch.level, 0.04);
for (const height of [-0.5, 0, floorHeight]) {
  const shifted = GarageModel.build(GARDEN, height);
  assert.deepEqual(rounded(shifted.parts), rounded(model.parts), 'Floor offset must not change local geometry');
  near(shifted.dims.wallTop - height, 2.3);
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
  for (const panel of panels) {
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
