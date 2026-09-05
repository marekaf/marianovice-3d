import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { TERRAIN } = require('./terrain.js');
const { GarageModel } = require('./garage-model.js');
const { HiddenBenchModel } = require('./hidden-bench-model.js');
const patch = GarageModel.groundPatch(GARDEN, TERRAIN.houseFFLInternal - 0.5);
const model = HiddenBenchModel.build(GARDEN, TERRAIN.plane, patch);
const rect = GARDEN.elements.find(element => element.id === 'zasivarna').parts.find(part => part.kind === 'rect');
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 0.00001, message || `${a} != ${b}`);
const ground = (x, y) => {
  const base = TERRAIN.basePlaneHeight(x, y);
  const distance = Math.hypot(Math.max(patch.x - x, 0, x - patch.x - patch.w),
    Math.max(patch.y - y, 0, y - patch.y - patch.d));
  const t = Math.min(1, distance / patch.blend);
  return patch.level + (base - patch.level) * t * t * (3 - 2 * t);
};
const vertices = part => {
  if (part.vertices) return part.vertices;
  if (part.type === 'beam') {
    const radius = Math.hypot(part.width, part.depth) / 2;
    return [part.start, part.end].flatMap(point => [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z =>
      point.map((value, axis) => value + [x, y, z][axis] * radius)))));
  }
  let size = part.size;
  if (part.type === 'cylinder') {
    const diameter = 2 * Math.max(part.radiusTop, part.radiusBottom);
    size = [diameter, diameter, diameter];
    size[{ x: 0, y: 1, z: 2 }[part.axis || 'z']] = part.height;
  }
  assert.ok(size, `${part.name}: unsupported geometry type`);
  return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z =>
    part.position.map((value, axis) => value + [x, y, z][axis] * size[axis] / 2))));
};
const bounds = part => {
  const points = vertices(part);
  return { min: [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis]))),
    max: [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis]))) };
};
assert.deepEqual(model, HiddenBenchModel.build(GARDEN, TERRAIN.plane, patch), 'Geometry must be deterministic');
assert.equal(new Set(model.parts.map(part => part.name)).size, model.parts.length, 'Part names must be unique');
assert.equal(model.groundPatch, undefined, 'Bench must not create a new terrain pad');
assert.deepEqual(model.groundPatches, [patch], 'Standalone preview must use the existing garage cut');
near(model.floorHeight, 1.7679696668768756);
near(model.floorHeight, ground(rect.x + rect.w / 2, rect.y + rect.d / 2));
near(rect.x, 31.4); near(rect.y, 18.3); near(rect.w, 1.8); near(rect.d, 0.5);
for (const part of model.parts) {
  assert.equal(part.category, 'furniture', `${part.name}: furniture toggle must hide the whole bench`);
  assert.ok(model.materials[part.material], `${part.name}: unknown material`);
  if (part.size) assert.ok(part.size.every(value => Number.isFinite(value) && value > 0), `${part.name}: invalid size`);
  if (part.type === 'beam') assert.ok(part.width > 0 && part.depth > 0
    && Math.hypot(...part.end.map((value, axis) => value - part.start[axis])) > 0.001, `${part.name}: invalid beam`);
  if (part.type === 'cylinder') assert.ok(part.radiusTop > 0 && part.radiusBottom > 0 && part.height > 0,
    `${part.name}: invalid hardware dimensions`);
  const points = vertices(part);
  assert.ok(points.flat().every(Number.isFinite), `${part.name}: non-finite geometry`);
  const box = bounds(part);
  assert.ok(box.min[0] >= rect.x - 0.00001 && box.max[0] <= rect.x + rect.w + 0.00001
    && box.min[1] >= rect.y - 0.00001 && box.max[1] <= rect.y + rect.d + 0.00001,
  `${part.name}: geometry exceeds the original bench footprint`);
  if (part.vertices) {
    let volume = 0;
    const origin = points[0];
    for (const face of part.faces) {
      assert.ok(face.length >= 3 && face.every(index => Number.isInteger(index) && index >= 0 && index < points.length));
      for (let i = 1; i < face.length - 1; i++) {
        const [a, b, c] = [face[0], face[i], face[i + 1]].map(index =>
          points[index].map((value, axis) => value - origin[axis]));
        volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2])
          + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      }
    }
    assert.ok(volume > 0, `${part.name}: mesh winding must enclose a positive volume`);
  }
}
const parts = new Map(model.parts.map(part => [part.name, part]));
const get = name => {
  assert.ok(parts.has(name), `Missing structural part: ${name}`);
  return parts.get(name);
};
const touches = (a, b) => {
  const aa = bounds(a), bb = bounds(b);
  return aa.min.every((value, axis) => value <= bb.max[axis] + 0.001 && aa.max[axis] >= bb.min[axis] - 0.001);
};
const contains = (part, point) => {
  const box = bounds(part);
  return point.every((value, axis) => value >= box.min[axis] - 0.001 && value <= box.max[axis] + 0.001);
};
near(model.seatHeight, 0.45);
assert.equal(model.facing, 'N');
assert.equal(model.materials.paint.color, rect.fill, 'Preserve the red bench finish');
assert.equal(model.feet.length, 4);
for (const foot of model.feet) {
  const part = get(foot.name), leg = get(foot.leg);
  for (const point of part.vertices.slice(0, 4)) near(point[2] + model.floorHeight, ground(point[0], point[1]),
    `${foot.name}: foot corner must meet existing grade`);
  near(bounds(part).max[2], bounds(leg).min[2], `${foot.name}: foot must meet leg`);
  const side = Number(foot.name.split('_')[1]);
  assert.ok(touches(leg, get(`side_rail_${side}`)), `${foot.leg}: leg must support side rail`);
  near(bounds(leg).max[2], bounds(get('seat_slat_0')).min[2]);
}
for (const part of model.parts.filter(part => part.name.startsWith('seat_slat_'))) {
  near(bounds(part).max[2], model.seatHeight);
  for (let i = 0; i < 2; i++) assert.ok(touches(part, get(`side_rail_${i}`)), `${part.name}: seat must contact both rails`);
}
for (let i = 0; i < 2; i++) {
  const stay = get(`back_stay_${i}`);
  assert.ok(contains(get(`leg_${i}_1`), stay.start), `${stay.name}: stay must anchor to rear leg`);
  for (const slat of model.parts.filter(part => part.name.startsWith('back_slat_'))) {
    const box = bounds(slat), z = (box.min[2] + box.max[2]) / 2;
    const t = (z - stay.start[2]) / (stay.end[2] - stay.start[2]);
    const y = stay.start[1] + t * (stay.end[1] - stay.start[1]);
    assert.ok(y - stay.depth / 2 <= box.max[1] + 0.001 && y + stay.depth / 2 >= box.min[1] - 0.001,
      `${slat.name}: back slat must contact stay ${i}`);
  }
  const front = get(`arm_front_bracket_${i}`), post = get(`arm_front_post_${i}`);
  assert.ok(contains(get(`leg_${i}_0`), front.start), `${front.name}: bracket must anchor to front leg`);
  assert.deepEqual(front.end, post.start, `${front.name}: bracket must meet arm post`);
  const rear = get(`arm_rear_bracket_${i}`);
  assert.ok(contains(stay, rear.start), `${rear.name}: rear bracket must anchor to back stay`);
  assert.ok(touches(post, get(`arm_rail_${i}`)) && touches(rear, get(`arm_rail_${i}`)), `Arm ${i}: rail must meet both supports`);
  assert.ok(touches(get(`arm_pad_${i}`), get(`arm_rail_${i}`)), `Arm ${i}: pad must contact rail`);
}
for (const [x, y] of [[rect.x, rect.y], [rect.x + rect.w, rect.y + rect.d],
  [rect.x + rect.w / 2, rect.y - 0.6]]) {
  assert.ok(model.plantingClearances.some(clearance => x >= clearance.x && x <= clearance.x + clearance.w
    && y >= clearance.y && y <= clearance.y + clearance.d), 'Bench and north approach must exclude planting');
}
console.log(`Hidden bench: ${model.parts.length} parts; footprint, grading, supported seat/back/arms and mesh checks pass`);
