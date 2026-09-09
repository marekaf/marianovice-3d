import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildNightstands} from './docs/nightstand-model.js';
import {ELECTRICAL_POINTS} from './docs/electrical-points.js';
const {HOUSE_INTERIOR:data}=createRequire(import.meta.url)('./house-interior.js');
const fixtures=data.furniture.filter(f=>['1.12','1.04'].includes(f.room)&&f.label.startsWith('noční stolek'));
const model=buildNightstands(data);
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
close(model.parts.find(p=>p.name===`nightstand_${fixtures.findIndex(f=>f.room==='1.04')}_top`).size[0],.4);
for(const [i,f]of fixtures.entries()){
  const parts=model.parts.filter(p=>p.name.startsWith(`nightstand_${i}_`)),main=f.room==='1.12';
  const top=parts.find(p=>p.name.endsWith('_top'));
  close(top.size[0],main?.6:.4);
  close(top.size[1],main?.4:.3);
  const fronts=parts.filter(p=>p.name.includes('_drawer_front_'));
  assert.equal(fronts.length,main?1:2);
  close(Math.max(...parts.map(p=>p.position[1]+p.size[1]/2))-Math.min(...parts.map(p=>p.position[1]-p.size[1]/2)),main?.418:.318);
  assert(parts.every(p=>p.size.every(n=>n>0)&&p.position.every(Number.isFinite)));
  assert(fronts.every(p=>p.material==='cashmere'));
  const shelf=parts.find(p=>p.name.endsWith('_divider'));
  close(shelf.position[2],.325);
  const back=parts.find(p=>p.name.endsWith('_back'));
  for(const drawer of parts.filter(p=>/_drawer_(base|side)_/.test(p.name))){
    assert(drawer.position.some((v,a)=>Math.abs(v-back.position[a])>=(drawer.size[a]+back.size[a])/2-1e-9),'Drawer must clear the back panel');
  }
  const outlet=ELECTRICAL_POINTS.find(p=>p.kind==='power'&&p.room===f.room&&p.position&&p.position[0]>=f.x0-.001&&p.position[0]<=f.x1+.001);
  assert(outlet,'Fixed bedside outlet exists');
  if(main){
    assert(outlet.position[0]-.111>=f.x0+.018&&outlet.position[0]+.111<=f.x1-.018,'Three-gang frame clears niche sides');
    assert(outlet.position[1]-.04>=shelf.position[2]+shelf.size[2]/2&&outlet.position[1]+.04<=top.position[2]-top.size[2]/2,'Socket frame fits the open niche');
    const x=(f.x0+f.x1)/2,z=f.front==='N'?f.z1-.009:f.z0+.009;
    assert(!parts.some(p=>p.position.every((v,a)=>Math.abs(v-[x,z,.41][a])<p.size[a]/2)),'Socket niche has no back panel');
  }else{
    const highest=Math.max(...parts.map(p=>p.position[2]+p.size[2]/2));
    close(highest,.51);
    assert(outlet.position[1]-.04-highest>=.15-1e-9,'Guest socket frame remains above both drawers');
  }
}
assert.deepEqual(fixtures.filter(f=>f.room==='1.04').map(f=>[f.x0,f.x1,f.z0,f.z1]),[[.7,1.1,18.45,18.75],[2.9,3.3,18.45,18.75]]);
const bed=data.furniture.find(f=>f.kind==='bed'&&f.room==='1.04');
assert.deepEqual([bed.x0,bed.x1,bed.z0,bed.z1],[1.1,2.9,16.75,18.75]);
console.log('Bedroom and guest nightstand drawing dimensions verified');
