import assert from 'node:assert/strict';
import { buildHoxterH60 } from './hoxter-stove-model.js';

const model = buildHoxterH60();
const near = (a, b) => assert(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const bounds = part => ({ min: part.position.map((n, i) => n - part.size[i] / 2), max: part.position.map((n, i) => n + part.size[i] / 2) });
assert.deepEqual(model, buildHoxterH60());
assert.equal(buildHoxterH60({ floorHeight: 2.4 }).floorHeight, 2.4);
assert.equal(new Set(model.parts.map(p => p.name)).size, model.parts.length);
for (const part of model.parts) {
  assert(model.materials[part.material]);
  assert.equal(part.category, 'furniture');
  if (part.position) assert(part.position.every(Number.isFinite));
  if (part.size) assert(part.size.every(n => Number.isFinite(n) && n > 0));
  if (part.vertices) assert(part.vertices.flat().every(Number.isFinite));
  if (part.type === 'beam') assert([...part.start, ...part.end, part.width, part.depth].every(Number.isFinite));
}
const concrete = model.parts.filter(p => p.material === 'concrete');
for (const axis of [0, 1, 2]) {
  near(Math.min(...concrete.map(p => bounds(p).min[axis])), [-.3, 0, .06][axis]);
  near(Math.max(...concrete.map(p => bounds(p).max[axis])), [.3, .6, 1.968][axis]);
}
for (const part of concrete) {
  const { min, max } = bounds(part);
  assert(max[0] <= -.191 || min[0] >= .191 || max[2] <= .49 || min[2] >= .997 || min[1] >= .40,
    `${part.name} blocks the technical opening`);
}
const door = model.parts.filter(p => p.name.startsWith('door_frame_'));
near(Math.min(...door.map(p => bounds(p).min[0])), -.1885);
near(Math.max(...door.map(p => bounds(p).max[0])), .1885);
near(Math.min(...door.map(p => bounds(p).min[2])), .491);
near(Math.max(...door.map(p => bounds(p).max[2])), .996);
const pane = model.parts.find(p => p.name === 'door_glass');
assert(model.materials[pane.material].transmission > 0);
assert(model.parts.some(p => p.name === 'firebrick_floor'));
assert(model.parts.some(p => p.name === 'handle_spring'));
const spring = model.parts.find(p => p.name === 'handle_spring');
let volume = 0;
for (const face of spring.faces) for (let i = 1; i < face.length - 1; i++) {
  const [a, b, c] = [face[0], face[i], face[i + 1]].map(index => spring.vertices[index]);
  volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
}
assert(volume > 0, 'Spring normals face outward');
assert.equal(model.lights.length, 0);
console.log(`H60 stove checks passed: ${model.parts.length} finite parts, 600×600×1968 mm body, portrait door and hollow opening.`);
