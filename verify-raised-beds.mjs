import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { RaisedBedsModel } = require('./raised-beds-model.js');
const model = RaisedBedsModel.build(GARDEN);
const parts = new Map(model.parts.map(part => [part.name, part]));
const rect = id => GARDEN.elements.find(element => element.id === id).parts.find(part => part.kind === 'rect');
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 0.001, message || `${a} != ${b}`);
const bounds = part => {
  let vertices = part.vertices;
  if (!vertices) {
    let size = part.size;
    if (part.type === 'cylinder') {
      const diameter = 2 * Math.max(part.radiusTop, part.radiusBottom);
      size = [diameter, diameter, diameter];
      size[{ x: 0, y: 1, z: 2 }[part.axis || 'z']] = part.height;
    }
    vertices = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z =>
      part.position.map((value, axis) => value + [x, y, z][axis] * size[axis] / 2))));
  }
  return { min: [0, 1, 2].map(axis => Math.min(...vertices.map(vertex => vertex[axis]))),
    max: [0, 1, 2].map(axis => Math.max(...vertices.map(vertex => vertex[axis]))) };
};
const intersects = (a, b) => a.min.every((value, axis) =>
  Math.min(a.max[axis], b.max[axis]) - Math.max(value, b.min[axis]) > 0.001);
const touchesStem = (point, beam) => {
  const direction = beam.end.map((value, axis) => value - beam.start[axis]);
  const lengthSquared = direction.reduce((sum, value) => sum + value * value, 0);
  const t = Math.max(0, Math.min(1, point.reduce((sum, value, axis) =>
    sum + (value - beam.start[axis]) * direction[axis], 0) / lengthSquared));
  return Math.hypot(...point.map((value, axis) => value - beam.start[axis] - t * direction[axis]))
    <= Math.min(beam.width, beam.depth) / 2 + 0.001;
};

assert.equal(parts.size, model.parts.length, 'Part names must be unique');
assert.deepEqual(model, RaisedBedsModel.build(GARDEN), 'Geometry must be deterministic');
near(model.floorHeight, 3.21, 'Raised beds must rest on the existing gravel pad');
near(model.groundPatch.level, 3.15, 'Existing subgrade must remain unchanged');
for (const key of ['x', 'y', 'w', 'd']) near(model.groundPatch[key], rect('raisedBedsPad')[key]);
for (const part of model.parts) {
  assert.ok(model.materials[part.material], `${part.name}: missing material`);
  assert.ok(['structure', 'furniture'].includes(part.category), `${part.name}: invalid category`);
  const values = [...part.position || [], ...part.size || [], ...part.start || [], ...part.end || [],
    ...part.vertices?.flat() || [], ...part.profile?.flat() || []];
  assert.ok(values.every(Number.isFinite), `${part.name}: non-finite geometry`);
  if (part.size) assert.ok(part.size.every(value => value > 0), `${part.name}: non-positive dimensions`);
  if (part.type === 'beam') {
    assert.ok(part.width > 0 && part.depth > 0);
    assert.ok(Math.hypot(...part.end.map((value, axis) => value - part.start[axis])) > 0.001);
  }
  if (part.type === 'cylinder') assert.ok(part.height > 0 && part.radiusTop > 0 && part.radiusBottom > 0);
  if (part.vertices) {
    assert.ok(part.vertices.length >= 3 && part.faces.length > 0, `${part.name}: empty mesh`);
    for (const face of part.faces) assert.ok(face.length >= 3
      && face.every(index => Number.isInteger(index) && index >= 0 && index < part.vertices.length));
  }
}

const bedIds = ['raisedBed1', 'raisedBed2', 'raisedBed3', 'raisedBed4'];
assert.deepEqual(model.beds.map(bed => bed.id).sort(), bedIds, 'All four beds must be modeled');
const pad = rect('raisedBedsPad');
const aggregate = model.parts.filter(part => part.name.startsWith('gravel_piece_'));
assert.ok(aggregate.length > 0, 'Exposed gravel pad needs aggregate');
for (const part of aggregate) {
  const b = bounds(part);
  assert.ok(b.min[2] < 0 && b.max[2] > 0, `${part.name}: aggregate must embed in the pad surface`);
  assert.ok(b.min[0] >= pad.x && b.max[0] <= pad.x + pad.w && b.min[1] >= pad.y && b.max[1] <= pad.y + pad.d,
    `${part.name}: aggregate spills outside the pad`);
  for (const bed of model.beds) assert.ok(!intersects(b, {
    min: [bed.rect.x, bed.rect.y, -1], max: [bed.rect.x + bed.rect.w, bed.rect.y + bed.rect.d, bed.height],
  }), `${part.name}: aggregate intersects a bed instead of exposed pad`);
}
for (const bed of model.beds) {
  for (const key of ['x', 'y', 'w', 'd']) near(bed.rect[key], rect(bed.id)[key]);
  near(bed.height, 0.6, `${bed.id}: preserve the 60 cm shell`);
  near(bed.height - bed.soilHeight, 0.07, `${bed.id}: soil must be recessed below the rim`);
  const walls = model.parts.filter(part => part.name.startsWith(`${bed.id}_wall_`));
  const corners = model.parts.filter(part => part.name.startsWith(`${bed.id}_corner_`));
  assert.ok(walls.length >= 4 && corners.length === 4, `${bed.id}: missing shell members`);
  const wallBounds = walls.map(bounds);
  near(Math.min(...wallBounds.map(b => b.min[0])), bed.rect.x);
  near(Math.max(...wallBounds.map(b => b.max[0])), bed.rect.x + bed.rect.w);
  near(Math.min(...wallBounds.map(b => b.min[1])), bed.rect.y);
  near(Math.max(...wallBounds.map(b => b.max[1])), bed.rect.y + bed.rect.d);
  near(Math.max(...[...wallBounds, ...corners.map(bounds)].map(b => b.max[2])), bed.height);
  for (const wall of walls) assert.ok(corners.some(corner => {
    const a = bounds(wall), b = bounds(corner);
    return a.min.every((value, axis) => Math.min(a.max[axis], b.max[axis]) - Math.max(value, b.min[axis]) >= -0.004);
  }),
    `${wall.name}: wall board lacks a connection to its corner support`);
  const soil = bounds(parts.get(`${bed.id}_soil`));
  near(soil.max[2], bed.soilHeight, `${bed.id}: soil geometry must match its reported height`);
  for (const wall of walls) assert.ok(!intersects(soil, bounds(wall)), `${bed.id}: soil intersects timber wall`);
  assert.ok(soil.min[0] > bed.rect.x && soil.max[0] < bed.rect.x + bed.rect.w
    && soil.min[1] > bed.rect.y && soil.max[1] < bed.rect.y + bed.rect.d,
  `${bed.id}: soil must remain inside timber boundaries`);
  const clods = model.parts.filter(part => part.name.startsWith(`${bed.id}_soil_clod_`));
  assert.ok(clods.length > 0, `${bed.id}: missing soil surface detail`);
  for (const clod of clods) {
    const b = bounds(clod);
    assert.ok(b.min[2] < soil.max[2] && b.max[2] > soil.max[2], `${clod.name}: clod must embed in soil`);
    assert.ok(b.max[2] < bed.height, `${clod.name}: soil detail exceeds the bed rim`);
    assert.ok(b.min[0] >= soil.min[0] && b.max[0] <= soil.max[0] && b.min[1] >= soil.min[1] && b.max[1] <= soil.max[1],
      `${clod.name}: clod crosses a timber boundary`);
  }
  const cavity = { min: [soil.min[0] + 0.07, soil.min[1] + 0.07, soil.max[2] + 0.005],
    max: [soil.max[0] - 0.07, soil.max[1] - 0.07, bed.height - 0.005] };
  for (const part of [...walls, ...corners]) assert.ok(!intersects(cavity, bounds(part)), `${part.name} fills the recessed cavity`);
  const plants = model.plants.filter(plant => plant.bedId === bed.id);
  assert.ok(plants.length > 0, `${bed.id}: missing crops`);
  for (const plant of plants) {
    const stem = parts.get(plant.stem);
    assert.ok(stem && stem.type === 'beam', `${plant.stem}: missing plant stem`);
    for (const axis of [0, 1, 2]) near(stem.start[axis], plant.root[axis], `${plant.stem}: stem must meet its root`);
    assert.ok(plant.root[0] > soil.min[0] && plant.root[0] < soil.max[0]
      && plant.root[1] > soil.min[1] && plant.root[1] < soil.max[1], `${plant.stem}: root is outside soil`);
    assert.ok(plant.root[2] <= soil.max[2] && plant.root[2] >= soil.max[2] - 0.02,
      `${plant.stem}: root must contact soil`);
    assert.ok(stem.end[2] > soil.max[2], `${plant.stem}: crop does not emerge from soil`);
    const prefix = plant.stem.replace(/_stem$/, '');
    const branches = model.parts.filter(part => part.type === 'beam' && part.name.startsWith(`${prefix}_branch_`));
    for (const branch of branches) assert.ok(touchesStem(branch.start, stem), `${branch.name}: branch must contact its stem`);
    const leaves = model.parts.filter(part => part.name.startsWith(`${prefix}_leaf_`));
    assert.ok(leaves.length > 0, `${plant.stem}: missing leaves`);
    for (const leaf of leaves) assert.ok(leaf.vertices.some(vertex => [stem, ...branches].some(support => touchesStem(vertex, support))),
      `${leaf.name}: leaf floats away from its stem or branch`);
    const fruitStems = model.parts.filter(part => part.name.startsWith(`${prefix}_fruit_stem_`));
    for (const fruitStem of fruitStems) {
      assert.ok(branches.some(branch => touchesStem(fruitStem.start, branch)), `${fruitStem.name}: fruit stem must contact its branch`);
      const fruit = parts.get(fruitStem.name.replace('_fruit_stem_', '_fruit_'));
      const b = bounds(fruit);
      assert.ok(fruitStem.end.every((value, axis) => value >= b.min[axis] - 0.001 && value <= b.max[axis] + 0.001),
        `${fruit.name}: fruit must meet its supporting stem`);
    }
  }
}
console.log(`Raised beds: ${model.parts.length} parts; four footprints, hollow shells, recessed soil and rooted crops pass`);
