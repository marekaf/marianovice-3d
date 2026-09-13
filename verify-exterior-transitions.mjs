import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {houseFlooringModel} from './docs/house-flooring.js';
const {HOUSE_INTERIOR:house}=createRequire(import.meta.url)('./house-interior.js');
const floors=houseFlooringModel(house).parts;
const covers=(x,z)=>floors.some(p=>Math.abs(x-p.position[0])<p.size[0]/2&&Math.abs(z-p.position[1])<p.size[1]/2);
const checked=[];
for(const wall of house.extWalls)for(const [index,opening] of wall.openings.entries()) {
  const model=house.buildOpening(wall,opening,index),spec=model?.opening;
  if(!spec)continue;
  const axis=wall.b[0]-wall.a[0]>wall.b[1]-wall.a[1]?0:1,cross=1-axis;
  const inward=['E','S'].includes(wall.face)?-1:1;
  const boundary=inward===1?wall.a[cross]:wall.b[cross];
  const frame=model.parts.find(p=>p.name.endsWith(spec.kind==='entrance'?'_threshold':'_frame_sill'));
  if(spec.kind==='window') {
    const finish=model.parts.find(p=>p.name.endsWith(spec.sill>0?'_exterior_sill':'_exterior_threshold'));
    assert(finish,`${wall.id}:${index} needs an exterior reveal finish`);
    const weather=finish.position[cross]-inward*finish.size[cross]/2;
    const inside=finish.position[cross]+inward*finish.size[cross]/2;
    assert(Math.abs(weather-boundary)<1e-9,`${wall.id}:${index} finish reaches facade`);
    assert(Math.abs(inside-(frame.position[cross]-inward*frame.size[cross]/2))<1e-9,`${wall.id}:${index} finish meets frame`);
    assert.notEqual(finish.material,'floorWood');
    assert(Math.abs(finish.position[2]+finish.size[2]/2-spec.sill-.001)<1e-9,`${wall.id}:${index} exterior finish clears existing slab or sill backing`);
  }
  if(spec.sill>0)continue;
  const inner=frame.position[cross]+inward*frame.size[cross]/2;
  const point=offset=>axis===0?[spec.center,inner+inward*offset]:[inner+inward*offset,spec.center];
  assert(covers(...point(.01)),`${wall.id}:${index} keeps interior finish against frame`);
  assert(!covers(...point(-.01)),`${wall.id}:${index} indoor flooring stops at frame`);
  checked.push(`${wall.id}:${index}`);
}
assert.deepEqual(checked,['W1:0','W3:0','W3:1','W4:0','W4:1','W7:0','W9:1','W9:2']);
assert(floors.every(p=>p.position[2]===.0025&&p.size[2]===.0025),'Interior finish elevations remain unchanged');
console.log('All exterior window and portal reveals close to facade; interior flooring stops at actual frames');

const {HousePlinth}=createRequire(import.meta.url)('./house-plinth.js');
const plinth=HousePlinth.build(house,2.465,()=>1.925),meshes=plinth.parts.map(p=>{
  const [x,z,y]=p.position,[w,d,h]=p.size;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  mesh.position.set(x,y,z);mesh.updateMatrixWorld();return mesh;
});
const sight=new THREE.Raycaster(new THREE.Vector3(15.03,2.515,6.8),new THREE.Vector3(0,0,1),0,1);
assert.equal(sight.intersectObjects(meshes).length,0,'Physical plinth must not obstruct the north floor-level window');
sight.ray.origin.x=14;
assert(sight.intersectObjects(meshes).length>0,'Adjacent plinth retains its approved height');
const down=new THREE.Raycaster(new THREE.Vector3(15.03,3,7.155),new THREE.Vector3(0,-1,0));
assert(Math.abs(down.intersectObjects(meshes)[0].point.y-2.465)<1e-6,'Plinth remains below the window threshold');
assert(readFileSync(new URL('./unreal/export.mjs',import.meta.url),'utf8').includes("roots.push({name:'house_plinth',object:plinth})"),'House export includes the physically cut browser plinth');
assert(readFileSync(new URL('./blender/poc.py',import.meta.url),'utf8').includes('GARDEN["housePlinth"]["parts"]'),'Blender consumes the same plinth geometry');
