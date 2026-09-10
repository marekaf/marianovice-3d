import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import { prepareUtilityJoinery, buildUtilityJoinery } from './utility-joinery.js';

const require=createRequire(import.meta.url);
const {FurnitureModel}=require('../furniture-model.js');
const {HOUSE_INTERIOR}=require('../house-interior.js');
const source = { kind:'cab',room:'1.02',x0:7.35,x1:7.95,z0:16.744,z1:18.8,h:.9,worktop:.038 };
const prepared = prepareUtilityJoinery(source);
assert.equal(source.kind,'cab');
assert.equal(prepared.kind,'utilityJoinery');
assert.equal(prepared.cmat,'greenMatt');
assert.equal(prepared.imat,'whiteBoard');
assert.equal(prepared.h+prepared.worktop,.9);
const cabinets=HOUSE_INTERIOR.furniture.filter(f=>f.kind==='cab'&&f.room==='1.02'&&!f.worktop);
assert(cabinets.length>0);
for(const cabinet of cabinets){
  const parts=FurnitureModel.build([prepareUtilityJoinery(cabinet)]).parts;
  assert(parts.some(p=>p.name.includes('_front_')),'Utility cabinet keeps its fronts');
  assert(!parts.some(p=>p.name.includes('_pull_')),'Utility cabinet fronts must be handleless');
}
const model=buildUtilityJoinery({furniture:[prepared]});
assert.equal(model.dimensions.sinkWidth,.51);
assert.equal(model.dimensions.sinkDepth,.51);
assert.equal(model.parts.filter(p=>p.name.match(/^utility_sink_door_/)).length,2);
assert.equal(model.parts.filter(p=>p.name.endsWith('_door_glass')).length,2);
for(const p of model.parts.filter(p=>p.type==='box')) {
  assert(p.size.every(v=>v>0),p.name);
  assert(p.position[0]-p.size[0]/2>=source.x0-.00001,p.name);
  assert(p.position[0]+p.size[0]/2<=source.x1+.00001,p.name);
  assert(p.position[1]-p.size[1]/2>=source.z0-.00001,p.name);
  assert(p.position[1]+p.size[1]/2<=source.z1+.00001,p.name);
}
const [sx,sz]=model.dimensions.sinkCenter;
for(const p of model.parts.filter(p=>p.name.startsWith('utility_top_'))) {
  const crosses=p.position[0]-p.size[0]/2<sx+.22&&p.position[0]+p.size[0]/2>sx-.22&&p.position[1]-p.size[1]/2<sz+.22&&p.position[1]+p.size[1]/2>sz-.22;
  assert(!crosses,`${p.name} blocks sink cavity`);
}
console.log(`Utility joinery: ${model.parts.length} parts; 510mm sink, open cutout, two laundry fronts, 900mm finished top verified`);
