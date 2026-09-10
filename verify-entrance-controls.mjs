import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildEntranceInterior} from './docs/entrance-interior.js';
const {HOUSE_INTERIOR:data}=createRequire(import.meta.url)('./house-interior.js');
const result=buildEntranceInterior(data),parts=result.model.parts;
const controls=parts.filter(p=>p.name.startsWith('entrance_key_')||p.name.startsWith('entrance_intercom_'));
assert(controls.length>10);
for(const part of controls){
 const [x,z,y]=part.position,[w,d,h]=part.size;
 assert(z-d/2>result.seat.z0&&z+d/2<result.seat.z1,`${part.name}: inside the furniture niche, north of the entrance`);
 assert(x+w/2<=result.seat.x1+1e-9&&x-w/2>result.seat.x1-.1,`${part.name}: mounts on the niche right side panel`);
 assert(y-h/2>.9&&y+h/2<1.6);
}
for(const name of ['entrance_key_rail','entrance_intercom_body']){
 const part=parts.find(p=>p.name===name);
 assert(Math.abs(part.position[0]+part.size[0]/2-result.seat.x1)<1e-9,`${name}: flush against the panel`);
}
assert.equal(result.intercom.centerHeight,1.4);
assert(result.presets.entranceControls.target[2]<data.stairs.z1);
console.log('Entrance controls: mounted inside furniture niche on the north side of the door.');
