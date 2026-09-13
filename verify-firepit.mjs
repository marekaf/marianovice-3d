import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMeshHeightQuery} from './mesh-height-query.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { TERRAIN } = require('./terrain.js');
const { FirepitModel } = require('./firepit-model.js');
const sampledModel=FirepitModel.build(GARDEN,(x,z)=>2+.002*x*x+.03*z);
for(const part of sampledModel.parts)for(const vertex of part.vertices??[])
  assert.ok(vertex.every(Number.isFinite),`${part.name} must support sampled ground`);
const model = FirepitModel.build(GARDEN, TERRAIN.plane);
const parts = new Map(model.parts.map(part => [part.name, part]));
const circles = GARDEN.elements.find(element => element.id === 'firePit').parts.filter(part => part.kind === 'circle');
const seating = circles[0], pit = circles[1];
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 0.001, message || `${a} != ${b}`);
const surfaceOffset=GARDEN.elements.find(e=>e.id==='firePit').meta?.grading?.surfaceOffset??0;
const localGround = (x, y) => TERRAIN.basePlaneHeight(x, y)+surfaceOffset - model.floorHeight;

assert.equal(parts.size, model.parts.length, 'Part names must be unique');
assert.deepEqual(model, FirepitModel.build(GARDEN, TERRAIN.plane), 'Geometry must be deterministic');
near(model.firecenter[0], pit.cx);
near(model.firecenter[1], pit.cy);
near(model.floorHeight, TERRAIN.basePlaneHeight(pit.cx, pit.cy)+surfaceOffset);
assert.equal(model.groundPatch, undefined, 'Fire pit must preserve natural ground slope');
near(model.pit.outerRadius, pit.r);
near(model.pit.outerRadius, 0.5);
near(seating.r, 2);
assert.equal(model.categoryVisibility.fire, false, 'Fire must be off initially');
assert.ok(model.lights.length > 0 && model.lights.every(light => light.category === 'fire'),
  'Fire lighting must hide with the fire geometry');
const burningParts = model.parts.filter(part => /^(flame|coal)_/.test(part.name));
assert.ok(burningParts.length > 0 && burningParts.every(part => part.category === 'fire'),
  'Flames and glowing coals must hide with the fire lighting');
assert.equal(model.benches.length, 3, 'Three solid oak seats stand opposite the house');
const house=GARDEN.elements.find(e=>e.id==='house').meta.bbox;
near(model.approach.angle,Math.atan2((house[1]+house[3])/2-pit.cy,(house[0]+house[2])/2-pit.cx)*180/Math.PI);
assert.ok(model.approach.width >= 50, 'Keep the southwest approach open');
assert.ok(model.pit.ashHeight < model.pit.wallHeight, 'Ash must sit inside the steel ring');
assert.equal(model.pit.finish, 'corten');
near(model.pit.innerRadius, .496);
assert.equal(model.materials.corten.finish, 'corten');
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
  const block=parts.get(bench.id+'_block');
  assert(block&&block.material.startsWith('oak'));
  assert.equal(model.materials[block.material].grain,Math.abs(tangent[0])>=Math.abs(tangent[1])?'x':'y');
  assert(!model.parts.some(p=>p.name.startsWith(bench.id+'_leg')||p.name.startsWith(bench.id+'_seat')));
  near(bench.length,1.2);near(bench.depth,.42);
  for(const vertex of block.vertices.slice(bench.contacts.length))near(vertex[2],bench.seatHeight,'Solid oak seat top is flat');
  for(const bottom of bench.contacts)near(bottom[2],localGround(bottom[0],bottom[1])+.008,'Oak block rests on rendered gravel');

}

assert.ok(!model.parts.some(part => part.name.startsWith('ring_course_')));
const shell = parts.get('corten_ring');
assert.equal(shell.type, 'lathe');
assert.equal(shell.material, 'corten');
near(Math.max(...shell.profile.map(p => p[0])), .5);
near(Math.min(...shell.profile.map(p => p[0])), .496);
near(Math.max(...shell.profile.map(p => p[1])), .27);
for (let i = 0; i < 128; i++) {
  const a = i * Math.PI / 64;
  assert.ok(Math.min(...shell.profile.map(p => p[1])) <= localGround(pit.cx + Math.cos(a) * .5, pit.cy + Math.sin(a) * .5),
    'Rigid steel ring must meet the ground around its full circumference');
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
    `${log.name}: firewood intersects the steel ring`);
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
  && approachY >= rect.y && approachY <= rect.y + rect.d), 'Entrance towards pergola must exclude external planting');
const pointSegmentDistance=(p,a,b)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
};
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function ribbonClearance(a,b,polygon) {
  const inside=p=>polygon.every((v,i)=>cross(v,polygon[(i+1)%polygon.length],p)>=-1e-9)
    ||polygon.every((v,i)=>cross(v,polygon[(i+1)%polygon.length],p)<=1e-9);
  if(inside(a)||inside(b))return 0;
  let distance=Infinity;
  for(let i=0;i<polygon.length;i++){
    const c=polygon[i],d=polygon[(i+1)%polygon.length];
    if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
    distance=Math.min(distance,pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
  }
  return distance;
}
for(const route of GARDEN.gardenRoutes.filter(route=>['Gathering connection','Pond walk'].includes(route.id))){
  for(const seat of model.parts.filter(part=>/^bench_\d+_block$/.test(part.name))){
    const bench=model.benches.find(b=>seat.name===b.id+'_block'),angle=bench.angle*Math.PI/180;
    const footprint=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[bench.center[0]-Math.sin(angle)*u*bench.length/2+Math.cos(angle)*v*bench.depth/2,bench.center[1]+Math.cos(angle)*u*bench.length/2+Math.sin(angle)*v*bench.depth/2]);
    for(let i=1;i<route.points.length;i++)assert(ribbonClearance(route.points[i-1],route.points[i],footprint)>=route.width/2,
      `${route.id}: full walking width intersects ${seat.name}`);
  }
  const end=route.points.at(-1),previous=route.points.at(-2),dx=end[0]-previous[0],dy=end[1]-previous[1],length=Math.hypot(dx,dy);
  for(const offset of[-route.width/2,route.width/2])assert(Math.hypot(end[0]-dy/length*offset-seating.cx,end[1]+dx/length*offset-seating.cy)<=seating.r,
    `${route.id}: full joining edge must enter the seating apron`);
}
for(const subject of [model,sampledModel]){
  const apron=subject.parts.find(p=>p.name==='gravel_apron'),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(apron.vertices.flatMap(v=>[v[0],v[2],v[1]]),3));
  geometry.setIndex(apron.faces.flatMap(face=>Array.from({length:face.length-2},(_,i)=>[face[0],face[i+1],face[i+2]]).flat()));
  const heightAt=createMeshHeightQuery(geometry);
  for(const bench of subject.benches){
    for(const vertex of bench.contacts){
      const actual=heightAt(vertex[0],vertex[1]);assert(actual!==null);
      assert(Math.abs(vertex[2]-actual)<1e-5,'Oak bottom follows actual triangulated gravel, including sampled terrain');
      assert(bench.seatHeight-vertex[2]>.2,'Oak remains a solid positive-height block on varying terrain');
    }
    const block=subject.parts.find(p=>p.name===bench.id+'_block');
    for(const vertex of block.vertices)assert(Math.hypot(vertex[0]-pit.cx,vertex[1]-pit.cy)<=seating.r);
  }
}
console.log(`Firepit: ${model.parts.length} parts; fixed footprint, hollow ring, supported logs, grounded benches and access pass`);
