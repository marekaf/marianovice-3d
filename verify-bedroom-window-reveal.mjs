import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {buildModel} from './model3d.js';
import {prepareLivingData} from './docs/living-interior.js';

const {HOUSE_INTERIOR:data}=createRequire(import.meta.url)('./house-interior.js');
const before=JSON.stringify(data),prepared=prepareLivingData(data);
assert(!prepared.furniture.some(f=>f.label==='lavice polstr'),'The short cushion is replaced by the reveal model.');
const {buildBedroomWindowReveal}=await import('./docs/bedroom-window-reveal.js');
const model=buildBedroomWindowReveal(data);
const min=(p,axis)=>p.position[axis]-p.size[axis]/2,max=(p,axis)=>p.position[axis]+p.size[axis]/2;
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const boards=model.parts.filter(p=>p.material==='cashmere');
assert.equal(boards.length,4);
for(const board of boards){
  close(min(board,0),10.35);close(max(board,0),10.535);
  assert(min(board,1)>=1.2&&max(board,1)<=3.2,'Liners stay within the window width.');
  assert(min(board,2)>=.395&&max(board,2)<=2.145,'Liners stay within the window height.');
}
const cushion=model.parts.find(p=>p.name==='bedroom_window_cushion');
close(min(cushion,0),9.97);close(max(cushion,0),10.515);
close(min(cushion,2),.42);close(max(cushion,2),.48);
for(const cabinet of prepared.furniture.filter(f=>f.room==='1.12'&&f.kind==='cab')){
  close(cabinet.x1,10.35);
}
globalThis.document={createElement(){return{getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
const group=buildModel(THREE,model);group.updateMatrixWorld(true);
for(const [origin,direction,expected]of [
  [[10.44,1.2,2.2],[0,0,-1],1.22],
  [[10.44,1.2,2.2],[0,0,1],3.18],
  [[10.44,1.2,2.2],[0,1,0],2.125],
  [[10.52,1.2,2.2],[0,-1,0],.42],
]){
  const hits=new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction)).intersectObject(group,true);
  assert(hits[0],'Every exposed reveal face has a board.');
  const axis=direction[1]?1:2;
  assert(Math.abs(hits[0].point.getComponent(axis)-expected)<1e-6,'Reveal surfaces align with the cabinet opening.');
}
const moved={...data,extWalls:data.extWalls.map(w=>w.id==='W8'?{...w,b:[w.b[0]+.1,w.b[1]]}:w)};
for(const board of buildBedroomWindowReveal(moved).parts.filter(p=>p.material==='cashmere'))close(max(board,0),10.585);
assert.equal(JSON.stringify(data),before);
console.log('Bedroom reveal: four boards reach the frame, the seat is supported, and cabinet bodies stay outside the wall.');
