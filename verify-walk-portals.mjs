import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {buildModel} from './model3d.js';
import {buildWalkingDoor,createWalkDoors} from './walk-doors.js';
const {HOUSE_INTERIOR:data}=createRequire(import.meta.url)('./house-interior.js');
globalThis.document={createElement(){return{getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
for(const [id,index,travel]of [['W7',0,1.6075],['W9',1,2.5425]]){
  const wall=data.extWalls.find(w=>w.id===id),model=data.buildOpening(wall,wall.openings[index],index);
  assert.equal(model.doorMotion?.kind,'slide','Sliding portals need translational motion');
  assert(Math.abs(model.doorMotion.offset[2]-travel)<1e-8);
  assert(model.doorMotion.movingParts.includes(`${model.name}_north_glass`));
  assert(model.doorMotion.movingParts.includes(`${model.name}_handle_grip`));
  assert(!model.parts.some(p=>p.name===`${model.name}_mullion`));
  const group=buildWalkingDoor(THREE,model,buildModel);
  group.position.set(data.originPlot.x,2.465,data.originPlot.z);group.updateMatrixWorld(true);
  const controller=createWalkDoors(THREE,{data,doors:[group],floorY:2.465});
  const moving=group.userData.walkDoor;
  const glass=model.parts.find(p=>p.name===`${model.name}_north_glass`);
  const center=group.localToWorld(new THREE.Vector3(glass.position[0],1.7,glass.position[1]));
  const fixed=model.parts.find(p=>p.name===`${model.name}_south_glass`);
  const fixedCenter=group.localToWorld(new THREE.Vector3(fixed.position[0],1.7,fixed.position[1]));
  const bounds=new THREE.Box3().setFromObject(group.userData.categories.openings);
  assert(!controller.canStandAt(center.x,center.z),'Closed moving glass blocks passage');
  const camera=new THREE.PerspectiveCamera();camera.position.copy(center).add(new THREE.Vector3(1.2,0,0));camera.lookAt(center);camera.updateMatrixWorld(true);
  assert.equal(controller.aimedDoor(camera),group);
  assert(controller.toggle(group,camera));
  assert.equal(moving.pivot.rotation.y,0,'A sliding leaf must never rotate');
  assert(Math.abs(moving.pivot.position.z-travel)<1e-8);
  assert.deepEqual(new THREE.Box3().setFromObject(group.userData.categories.openings),bounds);
  assert(controller.canStandAt(center.x,center.z),'Open moving half permits passage');
  assert(!controller.canStandAt(fixedCenter.x,fixedCenter.z),'Fixed glazed half remains solid');
  for(const sign of [-1,1]){
    const position=center.clone();position.x+=sign*.8;
    controller.constrain(position,center.x-sign*.8,center.z);
    assert(Math.abs(position.x-center.x-sign*.8)<1e-7,'Passage works in both directions');
  }
  camera.position.copy(center);
  assert(!controller.toggle(group,camera),'A portal cannot slide closed through the walker');
  camera.position.x+=1.2;
  assert(controller.toggle(group,camera));
  assert.equal(moving.pivot.position.z,0);
  assert(!controller.canStandAt(center.x,center.z));
}
console.log('Sliding portals: correct travel, rigid sash, fixed glazing, passage and safe closing pass');
