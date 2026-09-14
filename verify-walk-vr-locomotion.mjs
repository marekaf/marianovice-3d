import assert from 'node:assert/strict';
import * as THREE from 'three';
import {placeVRHead,rotateVRRig,createVRTeleportValidator} from './walk-vr-locomotion.js';

function close(actual,expected,message){
  assert.ok(actual.distanceTo(expected)<1e-9,`${message}: ${actual.toArray()} vs ${expected.toArray()}`);
}
for(const parentAngle of [0,.7]){
  const scene=new THREE.Scene(),parent=new THREE.Group(),rig=new THREE.Group(),head=new THREE.Object3D();
  scene.add(parent);parent.add(rig);rig.add(head);
  parent.position.set(4,2,-3);parent.rotation.y=parentAngle;
  rig.position.set(10,1,-5);rig.rotation.y=.9;
  head.position.set(.6,1.65,-.4);
  const targetFoot=new THREE.Vector3(20,3.2,15);
  placeVRHead(THREE,rig,head.getWorldPosition(new THREE.Vector3()),targetFoot);
  close(head.getWorldPosition(new THREE.Vector3()),new THREE.Vector3(20,4.85,15),'Teleport places the offset headset over the target floor');
  assert.ok(Math.abs(rig.getWorldPosition(new THREE.Vector3()).y-targetFoot.y)<1e-9);
  const before=head.getWorldPosition(new THREE.Vector3()),direction=head.getWorldDirection(new THREE.Vector3());
  for(const angle of [Math.PI/6,-Math.PI/2,Math.PI]){
    const beforeDirection=head.getWorldDirection(new THREE.Vector3());
    rotateVRRig(THREE,rig,before,angle);
    close(head.getWorldPosition(new THREE.Vector3()),before,'Snap turns preserve the actual roomscale headset position');
    close(head.getWorldDirection(new THREE.Vector3()),beforeDirection.applyAxisAngle(new THREE.Vector3(0,1,0),angle),'Snap turns rotate view direction');
    assert.ok(Math.abs(rig.getWorldPosition(new THREE.Vector3()).y-targetFoot.y)<1e-9,'Snap turns retain the rig floor height');
  }
  assert.ok(head.getWorldDirection(new THREE.Vector3()).distanceTo(direction)>.1);
}

const data={originPlot:{x:100,z:-20},outline:[[0,0],[8,0],[8,8],[5,8],[5,3],[3,3],[3,8],[0,8]],stairs:{x0:1,x1:2,z0:4,z1:6}};
const calls=[];
const valid=createVRTeleportValidator({data,floorY:2,canStandAt:(x,z,y)=>{calls.push([x,z,y]);return !(x>=106&&x<=107&&z>=-19&&z<=-18);}});
const point=(x,z,y=2)=>({x:x+100,y,z:z-20});
assert.equal(valid(point(1,1)),true,'Open ground floor permits teleport');
assert.deepEqual(calls.at(-1),[101,-19,3.7],'Collision checks use world coordinates and standing eye height');
assert.equal(valid(point(7,7)),true,'Both wings remain accessible');
assert.equal(valid(point(4,5)),false,'Courtyard within the bounding box is outside the concave house footprint');
assert.equal(valid(point(9,1)),false,'Exterior destinations are rejected');
assert.equal(valid(point(.1,1)),false,'Destination needs clearance from the outer wall');
assert.equal(valid(point(2.9,5)),false,'Destination needs clearance beside the courtyard');
assert.equal(valid(point(1.5,5)),false,'Stair flight is excluded');
assert.equal(valid(point(.9,5)),false,'Stair exclusion includes body clearance');
assert.equal(valid(point(6.5,1.5)),false,'Interior collision checks reject walls');
assert.equal(valid(point(1,1,2.07)),true,'Small floor mesh offsets are tolerated');
assert.equal(valid(point(1,1,2.09)),false,'Raised furniture cannot become a destination');
assert.equal(valid(point(1,1,4.8)),false,'Loft floors are excluded');
for(const bad of [null,{},point(NaN,1),point(1,Infinity),point(1,1,NaN)])assert.equal(valid(bad),false);
console.log('VR floor placement, roomscale snap turns and ground-floor teleport clearance verified');
