import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {FurnitureModel}=require('./furniture-model.js');
const {HOUSE_INTERIOR}=require('./house-interior.js');
for(const room of ['1.10','1.03']){
  const mirror=HOUSE_INTERIOR.furniture.find(f=>f.room===room&&f.mat==='mirror');
  const width=room==='1.10'?mirror.x1-mirror.x0:mirror.z1-mirror.z0;
  assert(Math.abs(width-(room==='1.10'?1.6:1))<1e-9);
  assert.equal(mirror.h,.8);
  assert.equal(mirror.y0,1.2);
  assert.equal(mirror.y0+mirror.h,2);
  const basin=HOUSE_INTERIOR.furniture.find(f=>f.room===room&&f.type==='basin');
  assert.equal(basin.tap?.mount,'wall',`${room}: basin tap must mount to the wall`);
  const model=FurnitureModel.build([basin]);
  const spout=model.parts.find(p=>p.name==='fixture_0_wall_tap_spout');
  const outlet=model.parts.find(p=>p.name==='fixture_0_wall_tap_outlet');
  const plate=model.parts.find(p=>p.name==='fixture_0_wall_tap_spout_plate');
  assert(spout&&outlet&&plate);
  assert(!model.parts.some(p=>p.name==='fixture_0_tap_stem'));
  const axis=room==='1.10'?1:0;
  assert.equal(spout.axis,axis===1?'y':'x');
  assert(Math.abs(spout.position[axis]+spout.height/2-basin.tap.wallAt)<1e-9);
  assert(Math.abs(plate.position[axis]+plate.height/2-basin.tap.wallAt)<1e-9);
  assert(outlet.position[0]>basin.x0&&outlet.position[0]<basin.x1);
  assert(outlet.position[1]>basin.z0&&outlet.position[1]<basin.z1);
  assert(outlet.position[2]-outlet.height/2>basin.y0+basin.h+.05);
  assert.equal(spout.material,'graphite');
}
console.log('Both bathroom taps mount to walls and discharge above the basins.');
