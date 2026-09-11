import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {houseFlooringModel} from './docs/house-flooring.js';

const {HOUSE_LOFT:loft}=createRequire(import.meta.url)('./house-interior.js');
const regions=loft.rooms.filter(room=>['2.01','2.02','2.02b'].includes(room.id));
const model=houseFlooringModel(loft,[],{regions});
const covers=(parts,x,z)=>parts.some(part=>Math.abs(part.position[0]-x)<part.size[0]/2&&Math.abs(part.position[1]-z)<part.size[1]/2);
for(const x of [7.66,7.725,7.79])for(const z of [14.23,14.6,14.97]){
  assert(covers(model.parts,x,z),`Vinyl continues across the P10 doorway at ${x}, ${z}`);
}
for(const [x,z]of [[7.6,14.6],[7.85,14.6]])assert(covers(model.parts,x,z),'Doorway vinyl meets both adjoining rooms');
for(const [x,z]of [[7.725,15.25],[7.725,13.5],[7.0,10.0],[4.9,2.8]]){
  assert(!covers(model.parts,x,z),'Doorway flooring does not fill solid partitions, stairwell, cathedral void or hatch');
}
const attic=houseFlooringModel(loft,[],{regions:loft.rooms.filter(room=>room.id==='2.03')});
assert(!covers(attic.parts,7.725,14.6),'Selecting the northern attic does not add an unrelated southern doorway');
console.log('Loft vinyl crosses the complete P10 doorway and meets both rooms; partitions and floor openings remain clear');
