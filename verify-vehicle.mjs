import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const VehicleModel = require('./vehicle-model.js');
for (const spec of [
  { l: 4.36, w: 1.79, col: '#3a72b8', style: 'hatchback' },
  { l: 4.95, w: 1.90, col: '#b3a06e', style: 'estate' },
  { l: 4.67, w: 1.87, col: '#0f5aa8', style: 'coupe' },
  { l: 2.37, w: 0.91, col: '#462482', moto: true },
]) {
  const model = VehicleModel.build(spec);
  assert.deepEqual(model, VehicleModel.build(spec));
  assert.equal(model.floorHeight, 0);
  assert.equal(new Set(model.parts.map(p => p.name)).size, model.parts.length);
  assert.equal(model.parts.filter(p => p.name.startsWith('tire_')).length, spec.moto ? 2 : 4);
  for (const part of model.parts) {
    assert(model.materials[part.material]);
    for (const p of [part.position, part.size, part.start, part.end, ...(part.vertices || [])].filter(Boolean)) {
      assert(p.every(Number.isFinite), part.name);
    }
    if (part.size) assert(part.size.every(n => n > 0), part.name);
    if (part.vertices) {
      assert(part.vertices.every(([x, y, z]) => Math.abs(x) <= spec.w / 2 + 0.16 && Math.abs(y) <= spec.l / 2 + 0.001 && z >= 0), part.name);
      assert(part.faces.every(f => f.every(i => i >= 0 && i < part.vertices.length)), part.name);
    }
  }
  if (!spec.moto) {
    for (const [name, axis, sign] of [['hood', 2, 1], ['roof', 2, 1], ['body_side_1', 0, 1], ['body_side_-1', 0, -1]]) {
      const part = model.parts.find(p => p.name === name);
      assert(part.smooth, `${name} must share normals across segments`);
      const [p, q, r] = part.faces[0].slice(0, 3).map(i => part.vertices[i]);
      const a = q.map((v, i) => v - p[i]), b = r.map((v, i) => v - p[i]);
      const normal = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      assert(normal[axis] * sign > 0, `${name} normal must face outside`);
    }
    for (const end of [-1, 1]) {
      const plate = model.parts.find(p => p.name === `license_plate_${end}`);
      const bumper = model.parts.find(p => p.name === `bumper_${end}`);
      const outerFace = part => Math.abs(part.position[1]) + part.size[1] / 2;
      if (bumper.type === 'box') assert(outerFace(plate) > outerFace(bumper) + 0.001, 'Plate must sit clear of the bumper');
    }
    assert(model.parts.some(p => p.name === 'windscreen'));
    assert(model.parts.some(p => p.name === 'steering_wheel'));
    assert(model.parts.some(p => p.name === 'seat_front_left_back'));
    const rearWindow = model.parts.find(p => p.name === 'rear_window');
    const rearHeadrest = model.parts.find(p => p.name === 'seat_rear_left_headrest');
    const back = rearHeadrest.position[1] + rearHeadrest.size[1] / 2;
    const [bottom, , top] = rearWindow.vertices;
    const fraction = Math.max(0, (back - top[1]) / (bottom[1] - top[1]));
    const ceiling = top[2] + (bottom[2] - top[2]) * fraction;
    assert(rearHeadrest.position[2] + rearHeadrest.size[2] / 2 < ceiling, 'Rear headrests must stay beneath roof/glazing');
    assert.equal(model.materials.paint.color, spec.col);
    assert.equal(model.parts.filter(p => p.name.startsWith('mirror_glass')).length, 2);
    assert.equal(model.parts.filter(p => p.name.startsWith('door_handle')).length, spec.style === 'coupe' ? 2 : 4);
  }
  console.log(`${spec.style || 'motorcycle'}: ${model.parts.length} parts verified`);
}
