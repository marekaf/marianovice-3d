import assert from 'node:assert/strict';
import { buildStairFlight } from './stair-flight-model.js';

for (const toward of ['N', 'S', 'E', 'W']) for (const steps of [1, 6, 13]) {
  const alongX = toward === 'E' || toward === 'W';
  const s = { x0: 1, z0: 2, x1: alongX ? 3.6 : 1.9, z1: alongX ? 2.9 : 4.6, steps, rise: .19, toward };
  const model = buildStairFlight(s), mesh = model.parts[0], n = mesh.vertices.length / 2;
  assert.deepEqual(model, buildStairFlight(s));
  assert.equal(buildStairFlight(s, { floorHeight: 2 }).floorHeight, 2);
  assert.equal(buildStairFlight({ ...s, waist: .12 }).dimensions.waist, .12);
  assert(mesh.vertices.flat().every(Number.isFinite));
  const near = (a, b) => assert(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
  for (const [axis, min, max] of [[0,s.x0,s.x1],[1,s.z0,s.z1],[2,0,steps*s.rise]]) {
    near(Math.min(...mesh.vertices.map(v=>v[axis])), min);
    near(Math.max(...mesh.vertices.map(v=>v[axis])), max);
  }
  const profile = mesh.vertices.slice(0, n).map(v => [toward==='E' ? v[0]-s.x0 : toward==='W' ? s.x1-v[0] : toward==='S' ? v[1]-s.z0 : s.z1-v[1], v[2]]);
  const edges = profile.map((a,i)=>[a,profile[(i+1)%n]]);
  const treads = edges.filter(([a,b])=>Math.abs(a[1]-b[1])<1e-9&&a[1]>0);
  assert.equal(treads.length, steps);
  for(let i=1;i<=steps;i++) assert(treads.some(([a,b])=>Math.abs(a[1]-i*s.rise)<1e-9&&Math.abs(Math.abs(a[0]-b[0])-model.dimensions.going)<1e-9));
  const inclines = edges.filter(([a,b])=>Math.abs(a[0]-b[0])>1e-9&&Math.abs(a[1]-b[1])>1e-9);
  assert.equal(inclines.length, 1, 'Exactly one smooth inclined underside');
  const [a,b]=inclines[0];
  near((b[1]-a[1])/(b[0]-a[0]), s.rise/model.dimensions.going);
  near(steps*s.rise-b[1], .18);
  let volume=0;
  for(const face of mesh.faces)for(let i=1;i<face.length-1;i++){
    const [a,b,c]=[face[0],face[i],face[i+1]].map(j=>mesh.vertices[j]);
    volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  assert(volume>0, 'Normals enclose a positive solid');
}
console.log('Stair flight checks passed: exact treads, one planar underside, 180mm waist, four directions.');
