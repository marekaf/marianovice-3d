import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { TERRAIN } = require('./terrain.js');
const { GreenhouseModel } = require('./greenhouse-model.js');
const model = GreenhouseModel.build(GARDEN, TERRAIN.plane);
const parts = new Map(model.parts.map(part => [part.name, part]));
const footprint = GARDEN.elements.find(element => element.id === 'greenhouse').parts.find(part => part.kind === 'rect');
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 0.001, message || `${a} != ${b}`);
const bounds = part => {
  if (part.vertices) return {
    min: [0, 1, 2].map(axis => Math.min(...part.vertices.map(vertex => vertex[axis]))),
    max: [0, 1, 2].map(axis => Math.max(...part.vertices.map(vertex => vertex[axis]))),
  };
  return { min: part.position.map((value, axis) => value - part.size[axis] / 2),
    max: part.position.map((value, axis) => value + part.size[axis] / 2) };
};
const intersects = (a, b) => a.min.every((value, axis) =>
  Math.min(a.max[axis], b.max[axis]) - Math.max(value, b.min[axis]) > 0.001);
const contains = (rect, x, y) => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.d;

assert.equal(parts.size, model.parts.length, 'Part names must be unique');
assert.ok(parts.has('door_handle_mount_0'), 'First door handle mount must use an integer-indexed name');
assert.ok(parts.has('door_handle_mount_1'), 'Second door handle mount must use an integer-indexed name');
assert.deepEqual(model, GreenhouseModel.build(GARDEN, TERRAIN.plane), 'Geometry must be deterministic');
assert.ok(Number.isFinite(model.floorHeight));
for (const part of model.parts) {
  assert.ok(model.materials[part.material], `${part.name}: missing material`);
  assert.ok(['structure', 'roof', 'furniture'].includes(part.category), `${part.name}: invalid category`);
  const values = [...part.position || [], ...part.size || [], ...part.start || [], ...part.end || [],
    ...part.vertices?.flat() || [], ...part.profile?.flat() || []];
  assert.ok(values.every(Number.isFinite), `${part.name}: non-finite geometry`);
  if (part.size) assert.ok(part.size.every(value => value > 0), `${part.name}: invalid size`);
  if (part.type === 'beam') {
    assert.ok(part.width > 0 && part.depth > 0);
    assert.ok(Math.hypot(...part.end.map((value, axis) => value - part.start[axis])) > 0.001);
  }
  if (part.type === 'cylinder') assert.ok(part.height > 0 && part.radiusTop > 0 && part.radiusBottom > 0);
  if (part.vertices) for (const face of part.faces) {
    assert.ok(face.length >= 3 && face.every(index => Number.isInteger(index) && index >= 0 && index < part.vertices.length));
  }
}

const floor = bounds(parts.get('greenhouse_floor'));
near(floor.max[2], 0, 'The floor must end at the finished floor level');
near(floor.min[0], footprint.x);
near(floor.min[1], footprint.y);
near(floor.max[0], footprint.x + footprint.w);
near(floor.max[1], footprint.y + footprint.d);
const interior = { min: [footprint.x + 0.14, footprint.y + 0.14, 0.02],
  max: [footprint.x + footprint.w - 0.14, footprint.y + footprint.d - 0.14, 0.38] };
for (const part of model.parts.filter(part => ['masonry', 'joints', 'floor'].includes(part.material))) {
  assert.ok(!intersects(interior, bounds(part)), `${part.name} fills the greenhouse interior`);
}
const door = model.openings.find(opening => opening.name === 'door');
assert.ok(door && door.wall === 'N');
const entrance = { min: [door.from + 0.05, footprint.y - 0.02, 0.05],
  max: [door.from + door.w - 0.05, footprint.y + 0.14, door.h - 0.05] };
for (const part of model.parts.filter(part => ['box', 'mesh'].includes(part.type)
  && part.category === 'structure' && ['glass', 'masonry', 'joints'].includes(part.material) && part.name !== 'door_glass')) {
  assert.ok(!intersects(entrance, bounds(part)), `${part.name} blocks the entrance behind the door leaf`);
}

const benchTops = model.parts.filter(part => part.name.startsWith('bench_top_')).map(bounds);
for (const leg of model.parts.filter(part => part.name.startsWith('bench_leg_'))) {
  const b = bounds(leg);
  near(b.min[2], 0, `${leg.name} must rest on the floor`);
  assert.ok(b.min[0] >= floor.min[0] && b.max[0] <= floor.max[0] && b.min[1] >= floor.min[1] && b.max[1] <= floor.max[1]);
  assert.ok(benchTops.some(top => top.min[0] < b.max[0] && top.max[0] > b.min[0]
    && top.min[1] < b.max[1] && top.max[1] > b.min[1] && Math.abs(top.min[2] - b.max[2]) < 0.001),
  `${leg.name} must support the bench top`);
}
const shelf = bounds(parts.get('bench_shelf'));
for (const part of model.parts.filter(part => part.name.startsWith('bench_shelf_support_'))) near(bounds(part).max[2], shelf.min[2]);
for (const pot of model.parts.filter(part => /^pot_\d+$/.test(part.name))) {
  near(pot.position[2] + Math.min(...pot.profile.map(point => point[1])), shelf.max[2], `${pot.name} floats above its shelf`);
}

const vent = bounds(parts.get('vent_glass'));
const cx = footprint.x + footprint.w / 2;
const roofHeight = x => 1.9 + (1 - Math.abs(x - cx) / (footprint.w / 2)) * 0.75;
const ventProbe = { min: [vent.min[0] + 0.05, vent.min[1] + 0.05, 0],
  max: [Math.min(vent.max[0] - 0.05, footprint.x + footprint.w - 0.05), vent.max[1] - 0.05, 4] };
for (const part of model.parts.filter(part => part.material === 'glass' && part.category === 'roof' && part.name !== 'vent_glass')) {
  assert.ok(!intersects(ventProbe, bounds(part)), `${part.name} leaves fixed glass beneath the opening vent`);
}
const ventOuter = parts.get('vent_glass').vertices.filter(vertex => Math.abs(vertex[0] - vent.max[0]) < 0.001);
assert.ok(ventOuter.every(vertex => vertex[2] > roofHeight(vertex[0]) + 0.05), 'Vent must lift visibly above the closed roof plane');
const downpipe = parts.get('downpipe');
const gutter = bounds(parts.get('east_gutter_base'));
assert.ok(downpipe.position[2] + downpipe.height / 2 >= gutter.min[2] - 0.001,
  'Downpipe must reach the gutter underside');
for (const axis of [0, 1]) assert.ok(downpipe.position[axis] + downpipe.radiusTop > gutter.min[axis]
  && downpipe.position[axis] - downpipe.radiusTop < gutter.max[axis], 'Downpipe must meet the gutter footprint');
const onBeam = (point, beam, contactRadius = 0) => {
  const direction = beam.end.map((value, axis) => value - beam.start[axis]);
  const lengthSquared = direction.reduce((sum, value) => sum + value * value, 0);
  const t = Math.max(0, Math.min(1, point.reduce((sum, value, axis) =>
    sum + (value - beam.start[axis]) * direction[axis], 0) / lengthSquared));
  const distance = Math.hypot(...point.map((value, axis) => value - beam.start[axis] - t * direction[axis]));
  return distance <= Math.min(beam.width, beam.depth) / 2 + contactRadius + 0.002;
};
const opener = parts.get('vent_opener');
const inBounds = (point, b) => point.every((value, axis) => value >= b.min[axis] - 0.001 && value <= b.max[axis] + 0.001);
for (const [side, endpoint] of [['fixed', opener.start], ['moving', opener.end]]) {
  const bracket = bounds(parts.get(`vent_${side}_bracket`));
  const pin = parts.get(`vent_${side}_pin`);
  const crossbar = parts.get(`vent_${side}_crossbar`);
  assert.ok(inBounds(endpoint, bracket), `${side} opener endpoint must attach to its bracket`);
  endpoint.forEach((value, axis) => near(value, pin.position[axis], `${side} opener endpoint must meet its pin`));
  const middle = crossbar.start.map((value, axis) => (value + crossbar.end[axis]) / 2);
  assert.ok(inBounds(middle, bracket), `${side} opener bracket must meet its crossbar`);
  const supports = model.parts.filter(part => part.type === 'beam'
    && (side === 'fixed' ? part.name.startsWith('east_rafter_') : part.name.startsWith('vent_side_')));
  for (const end of [crossbar.start, crossbar.end]) assert.ok(supports.some(part =>
    onBeam(end, part, Math.min(crossbar.width, crossbar.depth) / 2)), `${side} crossbar must reach supporting frame at both ends`);
}

for (const x of [footprint.x, footprint.x + footprint.w]) for (const y of [footprint.y, footprint.y + footprint.d]) {
  assert.ok(model.plantingClearances.some(rect => contains(rect, x, y)), 'Greenhouse footprint must exclude external planting');
}
for (const x of [door.from, door.from + door.w]) for (const y of [footprint.y - 0.6, footprint.y]) {
  assert.ok(model.plantingClearances.some(rect => contains(rect, x, y)), 'Entrance must exclude external planting');
}
near(model.groundPatch.level, model.floorHeight - 0.04);
console.log(`Greenhouse: ${model.parts.length} parts; hollow walls, doorway, bench supports, vent and planting clearance pass`);
