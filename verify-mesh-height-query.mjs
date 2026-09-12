import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMeshHeightQuery} from './mesh-height-query.js';

const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),ray=new THREE.Raycaster();
let samples=0;
for(const indexed of [true,false]) {
  let geometry=new THREE.PlaneGeometry(8,6,13,11).rotateX(-Math.PI/2);
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++)positions.setY(i,Math.sin(positions.getX(i))*.7+Math.cos(positions.getZ(i))*.4);
  if(!indexed)geometry=geometry.toNonIndexed();
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(1.3,2.7,-.6);mesh.rotation.set(.1,.23,-.07);mesh.scale.set(1.2,.8,.9);mesh.updateMatrixWorld();
  const query=createMeshHeightQuery(mesh),explicit=createMeshHeightQuery(geometry,{matrix:mesh.matrixWorld,cellSize:.7});
  for(let x=-5;x<=7;x+=.19)for(let z=-5;z<=5;z+=.23) {
    ray.set(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(mesh,false)[0],actual=query(x,z);
    if(hit){assert.notEqual(actual,null);assert(Math.abs(actual-hit.point.y)<1e-9);}
    else assert.equal(actual,null);
    assert.equal(explicit(x,z),actual);samples++;
  }
}
const stacked=new THREE.BufferGeometry();
stacked.setAttribute('position',new THREE.Float32BufferAttribute([0,1,0,2,1,0,0,1,2,0,3,0,2,3,0,0,3,2,0,0,0,0,5,0,0,0,2],3));
const query=createMeshHeightQuery(stacked);
assert.equal(query(.5,.5),3);
assert.equal(query(0,0),3);
assert.equal(query(1,1),3);
assert.equal(query(2,2),null);
for(const indexed of [false,true]) {
  if(indexed)stacked.setIndex([0,1,2,3,4,5,6,7,8]);
  stacked.setDrawRange(0,3);
  assert.equal(createMeshHeightQuery(stacked)(.5,.5),1);
  stacked.setDrawRange(3,3);
  assert.equal(createMeshHeightQuery(stacked)(.5,.5),3);
}
assert.throws(()=>createMeshHeightQuery(stacked,{cellSize:0}),RangeError);
console.log(JSON.stringify({meshHeightSamples:samples,indexedAndTransformed:true,overlappingAndVerticalFaces:true}));
