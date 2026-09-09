import assert from 'node:assert/strict';
import * as THREE from 'three';
import {capRoofWall} from './docs/roof-wall-cap.js';
const slope=Math.tan(5*Math.PI/180),intercept=3.025-.227/Math.cos(5*Math.PI/180)-9.33*slope;
const profile={slope,intercept,maxHeight:3.07};
const mesh=new THREE.Mesh(new THREE.BoxGeometry(8,.8,.45),Array.from({length:6},()=>new THREE.MeshBasicMaterial()));
mesh.position.set(14,2.67,8);
const materials=mesh.material;
mesh.updateMatrixWorld(true);
const before=new THREE.Raycaster(new THREE.Vector3(10.25,5,8),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
assert(before.point.y>slope*10.25+intercept+.15,'The original 3.07 m cap protrudes through the documented roof');
capRoofWall(THREE,mesh,profile);
assert.equal(mesh.userData.roofWallCap,true);
assert.equal(mesh.material,materials);
assert.deepEqual([...new Set(mesh.geometry.groups.map(g=>g.materialIndex))],[0,1,2,3,4,5]);
const p=mesh.geometry.attributes.position,world=new THREE.Vector3();
let lower=0,flat=0,seam=0;
for(let i=0;i<p.count;i++){
  world.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
  assert(world.y<=Math.min(3.07,slope*world.x+intercept)+1e-6);
  if(Math.abs(world.y-2.27)<1e-6)lower++;
  if(world.x>13&&Math.abs(world.y-3.07)<1e-6)flat++;
  if(Math.abs(world.x-(3.07-intercept)/slope)<1e-5)seam++;
}
assert(lower&&flat&&seam,'Opening heads remain fixed, eastern cap remains flat, and crossover is explicit');
assert.equal(mesh.geometry.attributes.uv.count,p.count);
for(let x=10.05;x<17.99;x+=.037){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,5,8),new THREE.Vector3(0,-1,0)).intersectObject(mesh);
  assert(hits.length,'Splitting and capping must not leave a hole in the wall top');
  assert(Math.abs(hits[0].point.y-Math.min(3.07,slope*x+intercept))<1e-6,'The actual top surface follows the roof then remains level');
}
const low=new THREE.Mesh(new THREE.BoxGeometry(.45,2.27,1));
low.position.set(10.7,1.135,10);
const original=low.geometry;
capRoofWall(THREE,low,profile);
assert.equal(low.geometry,original,'Geometry beneath the roof, including opening surfaces, is untouched');
const shifted=new THREE.Mesh(new THREE.BoxGeometry(.45,.8,1));
shifted.position.set(.225,2.67,1);
capRoofWall(THREE,shifted,{...profile,intercept:intercept+2.465,maxHeight:5.535},{offset:[10.48,2.465,7.18]});
for(let i=0;i<shifted.geometry.attributes.position.count;i++){
  world.fromBufferAttribute(shifted.geometry.attributes.position,i).applyMatrix4(shifted.matrixWorld).add(new THREE.Vector3(10.48,2.465,7.18));
  assert(world.y<=slope*world.x+intercept+2.465+1e-6,'Unattached local walls use the same world roof datum');
}
console.log('Roof wall cap: physical profile, crossover, materials, UVs and opening heights pass');
