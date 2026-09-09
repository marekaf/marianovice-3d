import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
const require=createRequire(import.meta.url);
const {HOUSE_INTERIOR:data}=require('./house-interior.js');
const model=data.exteriorInterior();
const material=new THREE.MeshStandardMaterial();
const meshFor=part=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(part.size[0],part.size[2],part.size[1]),material);
  mesh.position.set(part.position[0],part.position[2],part.position[1]);mesh.updateMatrixWorld();return mesh;
};
const wallMeshes=wall=>model.parts.filter(p=>p.name.startsWith(`backing_${wall.id}_`)).map(meshFor);
for(const wall of data.extWalls){
  const meshes=wallMeshes(wall);
  assert(meshes.length>0,`${wall.id} has physical room-side backing in the garden viewer`);
  const side=wall.face==='court'?{W5:'S',W6:'N',W7:'W',W11:'S'}[wall.id]:wall.face;
  const cross=['N','S'].includes(side)?1:0,along=1-cross,inward=['N','W'].includes(side)?1:-1;
  const face=inward===1?wall.b[cross]:wall.a[cross];
  for(const y of[1.7,2.45])for(let coordinate=wall.a[along]+.025;coordinate<wall.b[along]-.025;coordinate+=.05){
    const origin=[0,y,0],direction=[0,0,0];
    origin[cross===0?0:2]=face+inward*.1;origin[along===0?0:2]=coordinate;direction[cross===0?0:2]=-inward;
    const hits=new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction),0,.11).intersectObjects(meshes);
    const aperture=wall.openings.some(o=>{const width=o.reveal?.width||o.w,start=wall.a[along]+o.at+(o.w-width)/2;return coordinate>start&&coordinate<start+width&&y>(o.sill||0)&&y<(o.sill||0)+o.h;});
    assert.equal(hits.length>0,!aperture,`${wall.id} room-side wall/opening at ${coordinate.toFixed(3)}, height ${y}`);
    if(hits.length)assert(Math.abs(hits[0].distance-.1)<1e-5,'Room-side finished wall position is unchanged');
  }
}
const addedIds=new Set(data.extWalls.map(w=>w.id));
for(const part of model.parts.filter(part=>addedIds.has(part.name.match(/^backing_(W\d+)_/)?.[1]))){
  const min=part.position.map((v,i)=>v-part.size[i]/2),max=part.position.map((v,i)=>v+part.size[i]/2);
  for(let i=0;i<data.outline.length;i++){
    const a=data.outline[i],b=data.outline[(i+1)%data.outline.length],cross=a[0]===b[0]?0:1,along=1-cross;
    if(Math.min(max[along],Math.max(a[along],b[along]))<=Math.max(min[along],Math.min(a[along],b[along])))continue;
    assert(Math.abs(min[cross]-a[cross])>.001&&Math.abs(max[cross]-a[cross])>.001,'Added backing does not z-fight with the exterior shell');
  }
}
const originalParts=model.parts.filter(part=>!addedIds.has(part.name.match(/^backing_(W\d+)_/)?.[1]));
const originalModel={...model,parts:originalParts};
assert.equal(createHash('sha256').update(JSON.stringify(originalModel)).digest('hex'),'1eedd69b81acd57ba3fb584c74f650135b88799347ce59e23f2374462235c837','Existing internal walls, reveals, doors, floors, ceilings and terrain cutouts remain unchanged');
const gardenModel=data.exteriorInterior(3.07);
for(const id of ['W5','W6','W7','W9']){
  const wall=data.extWalls.find(w=>w.id===id),meshes=gardenModel.parts.filter(p=>p.name.startsWith(`backing_${id}_`)).map(meshFor);
  const cross=['W5','W6'].includes(id)?1:0,inward=['W6','W7'].includes(id)?1:-1,face=inward===1?wall.b[cross]:wall.a[cross];
  const origin=[(wall.a[0]+wall.b[0])/2,2.8,(wall.a[1]+wall.b[1])/2],direction=[0,0,0];
  origin[cross===0?0:2]=face+inward*.1;direction[cross===0?0:2]=-inward;
  assert(new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction),0,.11).intersectObjects(meshes).length>0,'Open-ceiling rooms retain their external wall above the interior ceiling datum');
}
const exteriorIds=new Set(data.extWalls.map(w=>w.id));
const interiorParts=m=>m.parts.filter(p=>!exteriorIds.has(p.name.match(/^backing_(W\d+)_/)?.[1]));
assert.deepEqual(interiorParts(gardenModel),interiorParts(model),'Exterior wall height does not change internal partitions or fit-out');
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
assert(html.includes('localHouseData.exteriorInterior?.(wallH)'),'Garden backing follows the actual exterior wall height');
console.log('Garden house exterior-wall backing verified');
