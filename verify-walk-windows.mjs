import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {buildModel} from './model3d.js';
import {buildWalkingDoor,createWalkDoors} from './walk-doors.js';
const {HOUSE_INTERIOR:data}=createRequire(import.meta.url)('./house-interior.js');
globalThis.document={createElement(){return{getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
const expected=[['W3',0,'north'],['W3',1,'south'],['W4',0,'north'],['W4',1,'south']];
for(const [wallId,index,hand]of expected){
  const wall=data.extWalls.find(w=>w.id===wallId),model=data.buildOpening(wall,wall.openings[index],index);
  assert(model.doorMotion,`${wallId}:${index} full-height sash must be operable`);
  assert.equal(model.doorMotion.angle,(hand==='north'?1:-1)*Math.PI/2);
  const moving=new Set(model.doorMotion.movingParts);
  for(const part of model.parts){
    const shouldMove=part.name.includes(`_${hand}_`)||/_(handle_|sash_hinge_)/.test(part.name);
    assert.equal(moving.has(part.name),shouldMove,`${part.name} has the correct rigid assembly`);
  }
  const group=buildWalkingDoor(THREE,model,buildModel);
  group.position.set(data.originPlot.x,2.465,data.originPlot.z);group.updateMatrixWorld(true);
  const door=group.userData.walkDoor,glass=model.parts.find(p=>p.name.endsWith(`_${hand}_glass`));
  const center=group.localToWorld(new THREE.Vector3(glass.position[0],1.7,glass.position[1]));
  const fixed=group.userData.categories.openings,fixedBounds=new THREE.Box3().setFromObject(fixed);
  const controller=createWalkDoors(THREE,{data,doors:[group],floorY:2.465}),camera=new THREE.PerspectiveCamera();
  assert(!controller.canStandAt(center.x,center.z),'Closed glass blocks passage');
  camera.position.copy(center).add(new THREE.Vector3(-1.3,0,0));
  assert(controller.toggle(group,camera),'Window opens with walker outside its inward swing');
  const openGlass=new THREE.Vector3(glass.position[0],glass.position[2],glass.position[1]).sub(new THREE.Vector3(...model.doorMotion.pivot));
  door.pivot.localToWorld(openGlass);
  assert(openGlass.x>center.x+.2,'Both hinge hands swing inward towards the room, east of the frame');
  assert.deepEqual(new THREE.Box3().setFromObject(fixed),fixedBounds,'Outer frame, mullion and fixed pane do not move');
  assert(controller.canStandAt(center.x,center.z),'Moving-half passage opens');
  const other=model.parts.find(p=>p.name.endsWith(`_${hand==='north'?'south':'north'}_glass`));
  const fixedCenter=group.localToWorld(new THREE.Vector3(other.position[0],1.7,other.position[1]));
  assert(!controller.canStandAt(fixedCenter.x,fixedCenter.z),'Fixed half remains impassable');
  for(const sign of[-1,1]){
    const position=center.clone().add(new THREE.Vector3(sign*.5,0,0));
    controller.constrain(position,center.x-sign*.5,center.z);
    assert(Math.abs(position.x-center.x-sign*.5)<1e-6,'Open sash permits passage in both directions');
  }
  camera.position.copy(center);
  assert(!controller.toggle(group,camera),'Closing cannot sweep through the walker');
  camera.position.copy(center).add(new THREE.Vector3(-1.3,0,0));
  assert(controller.toggle(group,camera));
  const position=center.clone().add(new THREE.Vector3(.6,0,0));
  controller.constrain(position,center.x-.6,center.z);
  assert(position.x<center.x,'Walker cannot tunnel through closed sash');
}
for(const wall of data.extWalls)for(const [i,opening]of wall.openings.entries()){
  const model=data.buildOpening(wall,opening,i);
  if(model?.opening.kind==='window'&&!model.opening.lowThreshold&&!model.opening.sliding)assert(!model.doorMotion,'Elevated windows remain non-operable');
}
console.log('Walk windows: four inward sashes, fixed panes, bidirectional passage and safe closing pass');
