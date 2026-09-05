import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { TERRAIN } = require('./terrain.js');
const { FirepitModel } = require('./firepit-model.js');
const model = FirepitModel.build(GARDEN, TERRAIN.plane);
const parts = new Map(model.parts.map(part => [part.name, part]));
const circles = GARDEN.elements.find(element => element.id === 'firePit').parts.filter(part => part.kind === 'circle');
const seating = circles[0], pit = circles[1];
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 0.001, message || `${a} != ${b}`);
const localGround = (x, y) => TERRAIN.basePlaneHeight(x, y) - model.floorHeight;

assert.equal(parts.size, model.parts.length, 'Part names must be unique');
assert.deepEqual(model, FirepitModel.build(GARDEN, TERRAIN.plane), 'Geometry must be deterministic');
near(model.firecenter[0], pit.cx);
near(model.firecenter[1], pit.cy);
near(model.floorHeight, TERRAIN.basePlaneHeight(pit.cx, pit.cy));
assert.equal(model.groundPatch, undefined, 'Fire pit must preserve natural ground slope');
near(model.pit.outerRadius, pit.r);
near(model.pit.outerRadius, 0.5);
near(seating.r, 1.75);
assert.equal(model.categoryVisibility.fire, false, 'Fire must be off initially');
assert.ok(model.lights.length > 0 && model.lights.every(light => light.category === 'fire'),
  'Fire lighting must hide with the fire geometry');
const burningParts = model.parts.filter(part => /^(flame|coal)_/.test(part.name));
assert.ok(burningParts.length > 0 && burningParts.every(part => part.category === 'fire'),
  'Flames and glowing coals must hide with the fire lighting');
assert.equal(model.benches.length, 5, 'Preserve five seats around the fire pit');
near(model.approach.angle, 120);
assert.ok(model.approach.width >= 50, 'Keep the southwest approach open');
assert.ok(model.pit.ashHeight < model.pit.wallHeight, 'Ash must sit inside the stone ring');
for (const part of model.parts) {
  assert.ok(model.materials[part.material], `${part.name}: missing material`);
  assert.ok(['structure', 'furniture', 'fire'].includes(part.category), `${part.name}: invalid category`);
  const values = [...part.position || [], ...part.size || [], ...part.start || [], ...part.end || [],
    ...part.vertices?.flat() || [], ...part.profile?.flat() || []];
  assert.ok(values.every(Number.isFinite), `${part.name}: non-finite geometry`);
  if (part.size) assert.ok(part.size.every(value => value > 0), `${part.name}: invalid dimensions`);
  if (part.type === 'beam') {
    assert.ok(part.width > 0 && part.depth > 0);
    assert.ok(Math.hypot(...part.end.map((value, axis) => value - part.start[axis])) > 0.001);
  }
  if (part.type === 'cylinder') assert.ok(part.height > 0 && part.radiusTop > 0 && part.radiusBottom > 0);
  if (part.vertices) {
    assert.ok(part.vertices.length >= 3 && part.faces.length > 0, `${part.name}: empty mesh`);
    for (const face of part.faces) assert.ok(face.length >= 3
      && face.every(index => Number.isInteger(index) && index >= 0 && index < part.vertices.length));
    let volume = 0;
    const origin = part.vertices[0];
    for (const face of part.faces) for (let i = 1; i < face.length - 1; i++) {
      const [a, b, c] = [face[0], face[i], face[i + 1]].map(index =>
        part.vertices[index].map((value, axis) => value - origin[axis]));
      volume += (a[0] * (b[1] * c[2] - b[2] * c[1])
        + a[1] * (b[2] * c[0] - b[0] * c[2])
        + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    }
    assert.ok(volume > 0, `${part.name}: mesh must have outward winding and positive volume`);
  }
}
for (const bench of model.benches) {
  const angle = bench.angle * Math.PI / 180;
  const tangent = [-Math.sin(angle), Math.cos(angle)], radial = [Math.cos(angle), Math.sin(angle)];
  for (const along of [-bench.length / 2, bench.length / 2]) for (const across of [-bench.depth / 2, bench.depth / 2]) {
    const x = bench.center[0] + tangent[0] * along + radial[0] * across;
    const y = bench.center[1] + tangent[1] * along + radial[1] * across;
    assert.ok(Math.hypot(x - pit.cx, y - pit.cy) <= seating.r + 0.001, `${bench.id}: seat corner exceeds layout circle`);
    const direction = Math.atan2(y - pit.cy, x - pit.cx) * 180 / Math.PI;
    const delta = Math.abs(((direction - model.approach.angle + 540) % 360) - 180);
    assert.ok(delta >= model.approach.width / 2, `${bench.id}: seat corner blocks southwest approach`);
  }
  for (const foot of bench.feet) {
    near(foot.groundHeight, localGround(...foot.center), `${bench.id}: foot must match natural grade`);
    assert.ok(foot.topHeight > foot.groundHeight, `${bench.id}: negative leg height`);
  }
  const local = point => {
    const dx = point[0] - bench.center[0], dy = point[1] - bench.center[1];
    return [dx * tangent[0] + dy * tangent[1], dx * radial[0] + dy * radial[1], point[2]];
  };
  const bounds = part => {
    const vertices = part.vertices.map(local);
    return { min: [0, 1, 2].map(axis => Math.min(...vertices.map(vertex => vertex[axis]))),
      max: [0, 1, 2].map(axis => Math.max(...vertices.map(vertex => vertex[axis]))) };
  };
  const contains = (point, b) => point.every((value, axis) => value >= b.min[axis] - 0.001 && value <= b.max[axis] + 0.001);
  const seats = model.parts.filter(part => part.name.startsWith(`${bench.id}_seat_`));
  const legs = model.parts.filter(part => part.name.startsWith(`${bench.id}_leg_`));
  assert.equal(legs.length, bench.feet.length, `${bench.id}: missing modeled feet`);
  assert.ok(seats.length > 0, `${bench.id}: missing seat`);
  for (const seat of seats) {
    near(bounds(seat).max[2], bench.seatHeight);
    for (const vertex of seat.vertices) assert.ok(Math.hypot(vertex[0] - pit.cx, vertex[1] - pit.cy) <= seating.r + 0.001,
      `${seat.name}: actual mesh exceeds seating footprint`);
  }
  for (const leg of legs) {
    for (const bottom of leg.vertices.slice(0, 4)) near(bottom[2], localGround(bottom[0], bottom[1]),
      `${leg.name}: foot corner must contact natural slope`);
    const b = bounds(leg);
    assert.ok(seats.some(seat => {
      const top = bounds(seat);
      return Math.abs(top.min[2] - b.max[2]) < 0.001 && top.min[0] < b.max[0] && top.max[0] > b.min[0]
        && top.min[1] < b.max[1] && top.max[1] > b.min[1];
    }), `${leg.name}: leg must support a seat plank`);
  }
  const aprons = model.parts.filter(part => part.name.startsWith(`${bench.id}_apron_`));
  for (const brace of model.parts.filter(part => part.name.startsWith(`${bench.id}_brace_`))) {
    assert.ok(legs.some(leg => contains(local(brace.start), bounds(leg))), `${brace.name}: brace must meet a leg`);
    assert.ok(aprons.some(apron => contains(local(brace.end), bounds(apron))), `${brace.name}: brace must meet an apron`);
  }
}

const stones = model.parts.filter(part => /^ring_course_\d+_stone_\d+$/.test(part.name));
assert.ok(stones.length > 0, 'Stone ring must be modeled');
for (const stone of stones) {
  for (const vertex of stone.vertices) assert.ok(Math.hypot(vertex[0] - pit.cx, vertex[1] - pit.cy) <= pit.r + 0.001,
    `${stone.name}: stone exceeds the half-metre pit radius`);
  const footprintCenter = [0, 1].map(axis => stone.vertices.reduce((sum, vertex) => sum + vertex[axis], 0) / stone.vertices.length);
  assert.ok(Math.hypot(footprintCenter[0] - pit.cx, footprintCenter[1] - pit.cy) > model.pit.innerRadius,
    `${stone.name}: solid stone blocks the central cavity`);
  const course = Number(stone.name.match(/^ring_course_(\d+)/)[1]);
  if (course === 0) for (const vertex of stone.vertices.slice(0, 4)) {
    const depth = vertex[2] - localGround(vertex[0], vertex[1]);
    assert.ok(depth <= 0 && depth >= -0.02, `${stone.name}: stone base must be embedded in grade`);
  }
}
const ash = parts.get('ash');
const ashHeights = ash.vertices.map(vertex => vertex[2] - localGround(vertex[0], vertex[1]));
near(Math.max(...ashHeights), model.pit.ashHeight);
assert.ok(Math.max(...ashHeights) < model.pit.wallHeight - 0.1, 'Ash must remain recessed inside the ring');
for (const log of model.logs) {
  const part = parts.get(log.name);
  const heights = part.vertices.map(vertex => vertex[2] - localGround(vertex[0], vertex[1]));
  assert.ok(Math.min(...heights) <= model.pit.ashHeight && Math.max(...heights) > model.pit.ashHeight,
    `${log.name}: firewood must contact the ash bed`);
  for (const vertex of part.vertices) assert.ok(Math.hypot(vertex[0] - pit.cx, vertex[1] - pit.cy) < model.pit.innerRadius,
    `${log.name}: firewood intersects the stone ring`);
}
for (let i = 0; i < 24; i++) {
  const angle = i * Math.PI / 12;
  const x = pit.cx + Math.cos(angle) * seating.r, y = pit.cy + Math.sin(angle) * seating.r;
  assert.ok(model.plantingClearances.some(rect => x >= rect.x - 0.001 && x <= rect.x + rect.w + 0.001
    && y >= rect.y - 0.001 && y <= rect.y + rect.d + 0.001), 'Seating area must exclude external planting');
}
const approachAngle = model.approach.angle * Math.PI / 180;
const approachX = pit.cx + Math.cos(approachAngle) * (seating.r + 0.5);
const approachY = pit.cy + Math.sin(approachAngle) * (seating.r + 0.5);
assert.ok(model.plantingClearances.some(rect => approachX >= rect.x && approachX <= rect.x + rect.w
  && approachY >= rect.y && approachY <= rect.y + rect.d), 'Southwest entrance must exclude external planting');
console.log(`Firepit: ${model.parts.length} parts; fixed footprint, hollow ring, supported logs, grounded benches and access pass`);
