import assert from 'node:assert/strict';
import {buildCoronaBed} from './corona-bed-model.js';
const model=buildCoronaBed();
const part=name=>model.parts.find(p=>p.name===name);
const bounds=p=>p.position.map((v,i)=>[v-p.size[i]/2,v+p.size[i]/2]);
assert.equal(model.dimensions.width,2.1);
assert.equal(model.dimensions.frameTop,.48);
assert(Math.abs(model.dimensions.mattressTop-.68)<1e-9);
assert.deepEqual(part('mattress').size,[2,2,.25]);
assert(Math.abs(bounds(part('mattress'))[2][0]-.43)<1e-9);
assert(Math.abs(bounds(part('corona_headboard'))[2][1]-1.2)<1e-9);
assert.equal(model.parts.filter(p=>p.name.startsWith('industry_leg_')).length,4);
assert.equal(model.parts.filter(p=>p.name.startsWith('head_pad_')).length,8);
assert.equal(model.parts.filter(p=>p.name.startsWith('slat_')).length,48);
for(const p of model.parts){
  assert(p.position.every(Number.isFinite));
  assert(p.size.every(v=>Number.isFinite(v)&&v>0));
  assert(model.materials[p.material]);
  assert(bounds(p)[2][0]>=-1e-9,p.name);
}
console.log('CORONA: 200×200×25cm mattress, 5cm recess, 48cm frame, 68cm sleeping height, 120cm headboard and four legs pass');
