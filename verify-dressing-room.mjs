import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildDressingRoom} from './docs/dressing-model.js';
const {HOUSE_INTERIOR:data}=createRequire(import.meta.url)('./house-interior.js');
const before=JSON.stringify(data),model=buildDressingRoom(data);
const cabinets=data.furniture.filter(f=>f.room==='1.11'&&f.kind==='cab');
assert.equal(cabinets.length,2);
const close=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-8,message);
for(const [i,cabinet]of cabinets.entries()){
  const prefix=`dressing_${i}_`,parts=model.parts.filter(p=>p.name.startsWith(prefix));
  const fronts=kind=>parts.filter(p=>p.name.startsWith(`${prefix}${kind}`));
  const upper=fronts('upper_door_'),bottom=fronts('bottom_drawer_front_');
  const left=fronts('left_drawer_front_'),right=fronts('right_drawer_front_');
  assert.equal(upper.length,4,'Each unit has four closed top cupboard doors');
  assert.equal(bottom.length,4,'Each unit has four bottom drawers');
  assert.equal(left.length,2,'Left insert has two drawers');
  assert.equal(right.length,6,'Right insert has six drawers');
  close(parts.find(p=>p.name===`${prefix}top`).position[2]+parts.find(p=>p.name===`${prefix}top`).size[2]/2,2.5,'Drawing height is 2500 mm');
  function elevationBounds(part){
    const [x,z,y]=part.position,[d,w,h]=part.size;
    const u=cabinet.front==='E'?cabinet.z1-z:z-cabinet.z0;
    return {u0:u-w/2,u1:u+w/2,y0:y-h/2,y1:y+h/2,x0:x-d/2,x1:x+d/2};
  }
  for(const part of [...upper,...bottom,...left,...right]){
    const b=elevationBounds(part);
    assert(b.u0>=0&&b.u1<=1.7&&b.x0>=cabinet.x0-1e-8&&b.x1<=cabinet.x1+1e-8,'Front stays within the unchanged cabinet footprint');
    assert.equal(part.material,'white');
  }
  for(const part of upper){const b=elevationBounds(part);assert(b.y0>=1.9&&b.y1<=2.5);}
  for(const part of bottom){const b=elevationBounds(part);assert(b.y0>=.018&&b.y1<=.518);}
  for(const part of [...left,...right]){const b=elevationBounds(part);assert(b.y0>=.518&&b.y1<=.968);}
  for(const [fronts,nominalWidth,nominalHeight]of [[upper,.425,.600],[bottom,.823,.250],[left,.518,.225],[right,.4115,.150]]){
    for(const part of fronts){
      assert(part.size[1]<=nominalWidth&&part.size[1]>=nominalWidth-.005,'Front width follows the drawing with only seam deductions');
      assert(part.size[2]<=nominalHeight&&part.size[2]>=nominalHeight-.005,'Front height follows the drawing with only seam deductions');
    }
  }
  for(const part of left){const b=elevationBounds(part);assert(b.u0>.30&&b.u1<.851,'Left insert sits against the divider, leaving the outside long-hanging strip');}
  for(const part of right){const b=elevationBounds(part);assert(b.u0>.849&&b.u1<=1.7,'Six-drawer insert occupies the right bay');}
  for(const suffix of ['rail_0','rail_1'])close(parts.find(p=>p.name===prefix+suffix).position[2],1.740,'Rails follow the 160 mm offset below the upper cupboards');
  assert(!parts.some(p=>p.name.includes('lower_shelf')||p.name.includes('handle')),'No generic open lower shelves or invented handles');
}
assert.equal(JSON.stringify(data),before,'Dressing fitout does not move source cabinets or electrical coordinates');
console.log('Dressing room: 2500 mm units, closed top cupboards, twelve drawers and open hanging areas');
