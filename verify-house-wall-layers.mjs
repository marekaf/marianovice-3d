import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
const require=createRequire(import.meta.url),{HOUSE_INTERIOR:data}=require('./house-interior.js');
const {HouseWallLayers}=require('./house-wall-layers.js');
const wall=data.extWalls.find(w=>w.id==='W1');
const cells=HouseWallLayers.split(data,wall,{x0:1,x1:2,z0:0,z1:.45,y0:0,y1:2.52});
assert.equal(cells.length,2);
const eps=cells.find(c=>c.layer==='eps'),masonry=cells.find(c=>c.layer==='masonry');
assert.equal(eps.z0,0);assert.equal(eps.z1,.2);
assert.equal(masonry.z0,.2);assert.equal(masonry.z1,.45);
const returnWall=data.extWalls.find(w=>w.id==='W6');
const returnCells=HouseWallLayers.split(data,returnWall,{x0:1,x1:2,z0:11.99,z1:12.45,y0:0,y1:2.52});
const returnCore=returnCells.find(c=>c.layer==='masonry');
assert(Math.abs(returnCore.z1-returnCore.z0-.26)<1e-9,'The nonstandard atrium envelope is preserved, not forced to the typical 250 mm core');
for(const [id,point,layer]of[['W1',[.1,.3],'eps'],['W1',[10.7,.3],'eps'],['W1',[.3,.3],'masonry'],
  ['W2',[.1,19],'eps'],['W2',[10.7,19],'eps'],['W2',[.3,19],'masonry'],['W5',[2,8.65],'eps'],['W6',[2,12.09],'eps']]){
  const w=data.extWalls.find(w=>w.id===id),pieces=HouseWallLayers.split(data,w,{x0:w.a[0],x1:w.b[0],z0:w.a[1],z1:w.b[1],y0:0,y1:2.52});
  assert.equal(pieces.find(c=>point[0]>c.x0&&point[0]<c.x1&&point[1]>c.z0&&point[1]<c.z1)?.layer,layer,'EPS wraps the actual external corners and atrium returns');
}
for(const w of data.extWalls){
  const rect={x0:w.a[0],x1:w.b[0],z0:w.a[1],z1:w.b[1],y0:0,y1:2.52},pieces=HouseWallLayers.split(data,w,rect);
  const area=pieces.reduce((sum,c)=>sum+(c.x1-c.x0)*(c.z1-c.z0),0);
  assert(Math.abs(area-(rect.x1-rect.x0)*(rect.z1-rect.z0))<1e-9,'Layer volumes fill the original wall without changing its footprint');
  for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){
    const a=pieces[i],b=pieces[j];
    assert(Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)<1e-9||Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0)<1e-9,'Layer volumes never overlap');
  }
  if(['W7','W11'].includes(w.id))assert(pieces.every(c=>c.layer===null),'Narrow returns have no assumed uniform EPS layer');
}
assert.equal(HouseWallLayers.split({...data,wallLayerModel:undefined},wall,{x0:0,x1:1,z0:0,z1:.45,y0:0,y1:1})[0].layer,null,'Unmapped buildings and gables retain their existing geometry');
const meshFor=part=>{
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.vertices.flatMap(([x,z,y])=>[x,y,z]),3));
  geometry.setIndex(part.faces.flatMap(face=>face.slice(1,-1).flatMap((_,i)=>[face[0],face[i+2],face[i+1]])));
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.name=part.material;return mesh;
};
for(const cell of cells){
  const parts=HouseWallLayers.modelParts('sample',cell),meshes=parts.map(meshFor),x=(cell.x0+cell.x1)/2,z=(cell.z0+cell.z1)/2;
  const top=new THREE.Raycaster(new THREE.Vector3(x,3,z),new THREE.Vector3(0,-1,0)).intersectObjects(meshes);
  assert(top.length>0,'Closed layer volume has a top face');
  assert.equal(top[0].object.name,cell.layer==='eps'?'wallEPS':'wallMasonry','Horizontal section exposes the layer material');
  const bottom=new THREE.Raycaster(new THREE.Vector3(x,-1,z),new THREE.Vector3(0,1,0)).intersectObjects(meshes);
  assert(bottom.length>0&&bottom.every(h=>h.object.name==='wall'),'Closed layer volume has an outward-facing finished bottom');
  const side=new THREE.Raycaster(new THREE.Vector3(x,1,cell.z1+.1),new THREE.Vector3(0,0,-1),0,.11).intersectObjects(meshes);
  assert(side.length>0&&side.every(h=>h.object.name==='wall'),'Normal vertical faces keep the finished wall material');
}
assert.equal(HouseWallLayers.basis.actualMasonrySubstitution,.24);
const backing=data.exteriorInterior(3.07);
const lowerTops=backing.parts.filter(p=>p.wallLayer&&p.name.endsWith('_top')&&p.vertices.every(v=>v[2]<3.07-1e-8));
assert(lowerTops.length>0,'Window sill geometry is present in the exercised model');
assert(lowerTops.every(p=>p.material==='wall'),'Window sill and reveal tops remain finished, not exposed EPS or masonry');
assert(backing.parts.filter(p=>['wallEPS','wallMasonry'].includes(p.material)).every(p=>p.vertices.every(v=>Math.abs(v[2]-3.07)<1e-8)),'Only the upper wall section exposes construction layers');
console.log('Nominal house wall layers verified');
