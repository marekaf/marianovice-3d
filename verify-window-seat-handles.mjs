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
const upper=HOUSE_INTERIOR.furniture.find(f=>f.label==='okno horní pás');
const wall=HOUSE_INTERIOR.extWalls.find(w=>w.id==='W8');
const window=HOUSE_INTERIOR.buildOpening(wall,wall.openings[0],0).opening;
assert(Math.abs(upper.y0-2.125)<1e-8,'Upper cabinet overlaps the bedroom frame by 20 mm');
assert(Math.abs(upper.y0+upper.h-2.5)<1e-8,'Upper cabinet retains the side cabinets\' top height');
assert(Math.abs(window.sill+window.height-upper.y0-.02)<1e-8,'Upper cabinet follows the actual window head');
