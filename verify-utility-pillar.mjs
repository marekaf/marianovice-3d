import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js');
const Pillar=require('./utility-pillar-model.js');
const local=Pillar.build({center:[0,0],direction:[1,0],floorHeight:0});
const bounds=part=>[0,1,2].map(axis=>[Math.min(...part.vertices.map(v=>v[axis])),Math.max(...part.vertices.map(v=>v[axis]))]);
assert.deepEqual(bounds(local.parts.find(p=>p.name==='weather_cap')),[[-.575,.575],[-.25,.25],[1.8,1.84]]);
const gate=GARDEN.elements.find(e=>e.id==='gate').parts.find(p=>p.kind==='line');
const length=Math.hypot(gate.x2-gate.x1,gate.y2-gate.y1);
const direction=[(gate.x2-gate.x1)/length,(gate.y2-gate.y1)/length];
const [ux,uz]=direction;
const corner=GARDEN.plot.vertices[4],other=GARDEN.plot.vertices[5],southLength=Math.hypot(other[0]-corner[0],other[1]-corner[1]);
const south=[(other[0]-corner[0])/southLength,(other[1]-corner[1])/southLength];
const center=corner.map((v,i)=>v+south[i]*.28);
const model=Pillar.build({center,direction:[south[1],-south[0]],floorHeight:1.3});
assert.equal(model.floorHeight,1.3);
assert.ok(center[0]>41&&center[1]>33&&center[1]<34.38);
assert.ok(model.notes.some(n=>n.includes('provisional')));
for(const part of model.parts){
  assert.ok(part.vertices.flat().every(Number.isFinite));
  assert.ok(model.materials[part.material]);
  for(const [x,z]of part.vertices){
    const t=(x-gate.x1)*ux+(z-gate.y1)*uz;
    assert.ok(t>5.315,'Cabinet and foundation must clear the independent wicket post base');
  }
}
assert.equal(Math.max(...model.parts.flatMap(p=>p.vertices.map(v=>v[2]))),1.84);
const cabinet=model.parts.find(p=>p.name==='block_joint_core');
assert.ok(cabinet,'Grey block enclosure must replace the paired cabinet');
const upper=model.parts.find(p=>p.name==='upper_supply_door');
const lower=model.parts.find(p=>p.name==='lower_supply_door');
assert.ok(upper&&lower,'Photo has two vertically stacked white doors');
assert.ok(Math.min(...upper.vertices.map(v=>v[2]))>Math.max(...lower.vertices.map(v=>v[2])));
assert.ok(model.parts.filter(p=>p.name.startsWith('block_course_')).length>=27);
const sides=cabinet.vertices.map(([x,z])=>(x-corner[0])*south[1]-(z-corner[1])*south[0]);
assert.ok(Math.abs(Math.min(...sides)+Math.max(...sides))<1e-8,'Shared cabinet must straddle the neighbour boundary equally');
console.log('SE meter pillar: placement, wicket clearance, geometry and provisional dimensions pass');
