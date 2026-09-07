import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {FurnitureModel}=require('./furniture-model.js');
const {HOUSE_INTERIOR}=require('./house-interior.js');
const cabinets=HOUSE_INTERIOR.furniture.filter(f=>f.kind==='cab'&&(f.label.startsWith('okno skříň')||f.label.startsWith('okenní lavice')||f.label.startsWith('hosté L skříň')));
assert.equal(cabinets.length,5);
for(const cabinet of cabinets){
  const model=FurnitureModel.build([cabinet]);
  assert.equal(cabinet.handle,'push');
  assert(!model.parts.some(p=>p.name.includes('_pull_')),'Handleless fronts must not generate handles');
}
console.log('Window-seat furniture and both guest closet arms have handleless fronts.');
