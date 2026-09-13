import * as THREE from "three";
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {entranceLanding} from './entrance-landing.js';
const {HOUSE_INTERIOR:house}=createRequire(import.meta.url)('./house-interior.js');
const entry=house.exteriorOpenings().find(e=>e.model.opening.kind==='entrance');
const landing=entranceLanding(entry,house.originPlot,20.58,2.465,1.965);
assert(Math.abs(landing.x0-20.2575)<1e-9);
assert.equal(landing.x1,20.58);
assert(Math.abs(landing.z0-21.1275)<1e-9);
assert(Math.abs(landing.z1-22.5525)<1e-9);
assert.equal(landing.y,2.465);
assert.equal(landing.bottom,1.965);
const threshold=entry.model.parts.find(p=>p.name.endsWith('_threshold'));
assert(Math.abs(landing.x0-(house.originPlot.x+threshold.position[0]+threshold.size[0]/2))<1e-9,'Landing meets the physical threshold edge');
for(let z=landing.z0+.001;z<landing.z1;z+=.01)assert(z>=19.4&&z<=22.6,'Full door aperture meets the stair width');
assert.equal(landing.x1,20.58,'Landing meets the first tread without moving the stair run');
const mesh=new THREE.Mesh(new THREE.BoxGeometry(landing.x1-landing.x0,landing.y-landing.bottom,landing.z1-landing.z0));
mesh.position.set((landing.x0+landing.x1)/2,(landing.y+landing.bottom)/2,(landing.z0+landing.z1)/2);mesh.updateMatrixWorld(true);
for(let x=landing.x0+.005;x<landing.x1;x+=.01)for(let z=landing.z0+.005;z<landing.z1;z+=.01){
  const hit=new THREE.Raycaster(new THREE.Vector3(x,landing.y+1,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
  assert(hit&&Math.abs(hit.point.y-landing.y)<1e-7,"Physical landing covers the entire reveal at FFL");
}
console.log('Entrance reveal landing joins measured frame and existing stairs at house floor level');
