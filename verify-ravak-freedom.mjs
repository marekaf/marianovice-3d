import assert from 'node:assert/strict';
import { buildRavakFreedomWall } from './ravak-freedom-model.js';

const model = buildRavakFreedomWall(), mesh = model.parts[0], points = mesh.vertices;
assert.deepEqual(model, buildRavakFreedomWall());
assert.equal(buildRavakFreedomWall({ floorHeight: 2.4 }).floorHeight, 2.4);
assert(points.flat().every(Number.isFinite));
for (const [axis, minimum, maximum] of [[0,0,.8],[1,0,1.66],[2,0,.565]]) {
  assert(Math.abs(Math.min(...points.map(p => p[axis])) - minimum) < .001);
  assert(Math.abs(Math.max(...points.map(p => p[axis])) - maximum) < .001);
}
assert(points.filter(([x,,z]) => Math.abs(x-.8)<1e-8 && z>.2).length > 100, 'Wall back is flat, not elliptical');
assert(points.some(([x,y,z]) => x<.005 && y>.4 && y<1.26 && z>.55), 'Front apron has a broad curved outline');
assert(points.some(([x,y,z]) => x>.1 && x<.62 && y>.24 && y<1.42 && Math.abs(z-.12)<1e-8), 'Inner floor is 445 mm below rim');
let volume = 0;
for (const face of mesh.faces) for (let i = 1; i < face.length - 1; i++) {
  assert(face.every(j => Number.isInteger(j) && j>=0 && j<points.length));
  const [a,b,c]=[face[0],face[i],face[i+1]].map(j=>points[j]);
  volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
}
assert(volume>0, 'Shell normals face out of the solid acrylic');
assert(volume<.3, 'Open bowl is not a solid bathtub block');
assert.equal(model.parts.find(p=>p.name==='center_drain').position[1], .83);
console.log(`Freedom Wall checks passed: ${points.length} vertices, flat wall back, hollow bowl, 1660×800×565 mm.`);
