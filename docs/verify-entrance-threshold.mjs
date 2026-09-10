import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {houseFlooringModel} from './house-flooring.js';
const {HOUSE_INTERIOR:data}=createRequire(import.meta.url)('../house-interior.js');
const parts=houseFlooringModel(data).parts;
const covers=(x,z)=>parts.some(p=>Math.abs(p.position[0]-x)<p.size[0]/2&&Math.abs(p.position[1]-z)<p.size[1]/2);
assert(covers(9.70,14.72),'Interior entrance reveal retains vinyl');
assert(!covers(9.97,14.72),'Vinyl must not extend outside the entrance door');
for(const p of parts)if(p.position[1]+p.size[1]/2>13.97+1e-8&&p.position[1]-p.size[1]/2<15.35-1e-8)assert(p.position[0]+p.size[0]/2<=9.825+1e-8);
const checked=[];
for(const wall of data.extWalls.filter(w=>['N','S','E','W'].includes(w.face))){
  const alongX=wall.b[0]-wall.a[0]>wall.b[1]-wall.a[1],axis=alongX?0:1,cross=1-axis;
  for(const [index,opening]of wall.openings.entries()){
    if(opening.sill>0)continue;
    const centre=wall.a[axis]+opening.at+opening.w/2,mid=(wall.a[cross]+wall.b[cross])/2;
    const inward=['N','W'].includes(wall.face)?1:-1;
    const sample=offset=>alongX?[centre,mid+offset]:[mid+offset,centre];
    assert(!covers(...sample(-inward*.125)),`${wall.id}:${index} weather-side reveal must not have indoor vinyl`);
    assert(covers(...sample(inward*.125)),`${wall.id}:${index} indoor reveal retains its floor finish`);
    const start=Math.max(wall.a[axis],centre-(opening.reveal?.width||opening.w)/2),end=Math.min(wall.b[axis],centre+(opening.reveal?.width||opening.w)/2);
    for(const part of parts){
      if(part.position[axis]+part.size[axis]/2<=start+1e-8||part.position[axis]-part.size[axis]/2>=end-1e-8)continue;
      if(part.position[cross]+part.size[cross]/2<=wall.a[cross]||part.position[cross]-part.size[cross]/2>=wall.b[cross])continue;
      const weatherEdge=part.position[cross]-inward*part.size[cross]/2;
      assert(inward*(weatherEdge-mid)>=.05-1e-8,`${wall.id}:${index} full reveal width terminates at the indoor frame edge`);
    }
    checked.push(`${wall.id}:${index}`);
  }
}
assert.deepEqual(checked,['W1:0','W3:0','W3:1','W4:0','W4:1','W9:1','W9:2']);
console.log('Entrance threshold checks passed: vinyl ends at inside edge of frame, not exterior wall footprint.');
