import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{HOUSE_INTERIOR:data}=require('./house-interior.js');
const {FurnitureModel}=require('./furniture-model.js');
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const stub=data.intWalls.find(w=>w.id==='W18');
close(stub.a[0],5.70);close(stub.b[0],5.75);close(stub.b[0]-stub.a[0],.05);
const stubParts=data.exteriorInterior().parts.filter(p=>p.name.startsWith('backing_W18_'));
assert.equal(stubParts.length,1);close(stubParts[0].size[0],.05);
close(stubParts[0].position[0]-stubParts[0].size[0]/2,5.70);
close(stubParts[0].position[0]+stubParts[0].size[0]/2,5.75);
const tall=data.furniture.find(f=>f.label.startsWith('kuchyň tall'));
const upper=data.furniture.find(f=>f.label.startsWith('kuchyň uppers'));
assert.deepEqual(tall.modules,[.019,.670,.019]);
assert.deepEqual(upper.modules,[.6,.6,.6,.6,.6]);
close(tall.x0,5.75);close(tall.x1,6.458);close(upper.x0,6.458);close(upper.x1,9.458);
close(upper.x1-tall.x0,3.708);close(data.extWalls.find(w=>w.id==='W9').a[0]-upper.x1,.192);
close(upper.y0,1.45);close(upper.h,1.05);
const model=FurnitureModel.build([upper]);
const fronts=model.parts.filter(p=>p.name.includes('_front_S_')&&!p.name.includes('_inner_'));
assert.equal(fronts.length,5);
for(const [index,front]of fronts.entries()){
  close(front.position[0],6.458+.6*(index+.5));
  close(front.size[0],.59);
}
close(Math.max(...model.parts.filter(p=>p.type==='box').map(p=>p.position[0]+p.size[0]/2)),9.458);
const base=data.furniture.find(f=>f.label.startsWith('kuchyň base run'));
const filler=data.furniture.find(f=>f.label==='kuchyň roh filler E');
assert.deepEqual(base.modules,[.6,.6,.6,.6,.262]);
close(base.x0,tall.x1);close(base.x1,9.12);close(filler.x0,base.x1);close(filler.x1,9.15);
assert.deepEqual(filler.modules,[.03]);close(base.worktop.x0,6.458);close(base.worktop.x1,9.65);
assert.deepEqual(data.intWalls.find(w=>w.id==='W13').b,[5.85,4.20]);
assert.deepEqual(data.extWalls.find(w=>w.id==='W9').a,[9.65,4.20]);
for(const [label,center,width]of [['dřez Blanco PLEON 5',7.358,.52],['varná deska Siemens',8.558,.56]]){
  const f=data.furniture.find(f=>f.label===label);close((f.x0+f.x1)/2,center);close(f.x1-f.x0,width);
}
console.log('Kitchen wall stub, five600mm uppers and lower module alignment verified');
