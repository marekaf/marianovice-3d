import assert from 'node:assert/strict';
import * as THREE from 'three';
import {levelCircularGround,levelCircularGroundAsync} from './circular-pad-ground.js';

const pad={cx:.13,cz:.17,radius:2,level:1.865};
const height=(x,z)=>pad.level+Math.min(.06,Math.max(0,Math.hypot(x-pad.cx,z-pad.cz)-pad.radius)*.4);
const source=new THREE.PlaneGeometry(10,10,10,10).rotateX(-Math.PI/2);
const vertices=source.attributes.position;
for(let i=0;i<vertices.count;i++)vertices.setY(i,height(vertices.getX(i),vertices.getZ(i)));
const ground=new THREE.Mesh(levelCircularGround(THREE,source,[pad],height),new THREE.MeshBasicMaterial());
const ray=new THREE.Raycaster();
let samples=0,maximumError=0;
for(let ring=0;ring<=20;ring++)for(let i=0;i<72;i++){
  const angle=i*Math.PI/36,radius=pad.radius*.9999*ring/20;
  ray.set(new THREE.Vector3(pad.cx+radius*Math.cos(angle),10,pad.cz+radius*Math.sin(angle)),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObject(ground)[0];
  assert(hit,'Circular pad ground has no holes');
  maximumError=Math.max(maximumError,Math.abs(hit.point.y-pad.level));samples++;
}
assert(maximumError<1e-4,`Actual circular ground remains level through boundary triangles: ${maximumError}`);
for(const value of ground.geometry.attributes.uv.array)assert(Number.isFinite(value),'Clipped ground retains valid texture coordinates');
const again=new THREE.PlaneGeometry(10,10,10,10).rotateX(-Math.PI/2);
for(let i=0;i<again.attributes.position.count;i++)again.attributes.position.setY(i,height(again.attributes.position.getX(i),again.attributes.position.getZ(i)));
const batched=await levelCircularGroundAsync(THREE,again,[pad],async(xs,zs)=>Float64Array.from(xs,(x,i)=>height(x,zs[i])));
for(const name of ['position','uv','normal'])assert.deepEqual(Array.from(batched.attributes[name].array),Array.from(ground.geometry.attributes[name].array),`Batched ${name} matches`);
assert.deepEqual(Array.from(batched.index.array),Array.from(ground.geometry.index.array));
console.log(JSON.stringify({circularGroundSamples:samples,maximumError,batched:true}));
