import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createWalkLevels} from './walk-levels.js';
const {HOUSE_INTERIOR:data,HOUSE_LOFT:loftData}=createRequire(import.meta.url)('./house-interior.js');
const floorY=2.465,origin=data.originPlot;
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const position=(x,z)=>({x:x+origin.x,y:floorY+1.7,z:z+origin.z});
const levels=createWalkLevels({data,loftData,floorY,groundHeight:()=>floorY,canStandAt:()=>true,headroomAt:()=>Infinity});
const p=position(5.5,13.5);levels.reset(p);
function move(levels,p,x,z){const oldX=p.x,oldZ=p.z;p.x=origin.x+x;p.z=origin.z+z;levels.constrain(p,oldX,oldZ);}
move(levels,p,5.8,13.5);
assert.equal(levels.state.surface,'stairs');close(p.y,floorY+1.7+2.92/14+.0025);
move(levels,p,8.8,13.5);
assert.equal(levels.state.surface,'loft');close(p.y,7.08875);
move(levels,p,5.5,13.5);
assert.equal(levels.state.surface,'ground');close(p.y,4.165);
levels.reset(p);move(levels,p,8.8,13.5);
move(levels,p,8.8,11);
assert(p.z-origin.z>=12.98-1e-8,'Loft movement cannot cross the cathedral edge');
move(levels,p,8.8,13.5);move(levels,p,12,13.5);
assert(p.x-origin.x<=9.92+1e-8,'The walker radius stays inside the eastern outline');
const ground=position(8.8,14.8);levels.reset(ground);
move(levels,ground,8.9,14.8);assert.equal(levels.state.surface,'ground');close(ground.y,4.165);
const stepper=position(5.5,13.5);levels.reset(stepper);
for(let index=0;index<13;index++){
  move(levels,stepper,5.805+index*.21,13.5);
  assert.equal(levels.state.stairIndex,index);
  close(levels.state.footY-floorY,(index+1)*2.92/14+.0025);
}
const onFlight={...stepper};move(levels,stepper,8.325,14.3);
assert(stepper.z-origin.z<=13.77+1e-8,'The body stays inside stair width');
assert.equal(levels.state.surface,'stairs');close(stepper.y,onFlight.y);
const side=position(7,14.3);levels.reset(side);move(levels,side,7,13.5);
assert.equal(levels.state.surface,'ground');close(side.y,4.165);
assert(side.z-origin.z>=13.95,'Ground walkers cannot mount a high tread from its side');
const highEnd=position(8.8,13.5);levels.reset(highEnd);move(levels,highEnd,8.2,13.5);
assert.equal(levels.state.surface,'ground');assert(highEnd.x-origin.x>=8.43);
let block=false,ceiling=Infinity;
const checked=createWalkLevels({data,loftData,floorY,groundHeight:()=>floorY,
  canStandAt:(x,z,eyeY)=>!block||eyeY<=floorY+1.71,headroomAt:()=>ceiling});
const blocked=position(5.5,13.5);checked.reset(blocked);block=true;
move(checked,blocked,6.5,13.5);assert.equal(checked.state.surface,'ground');assert(blocked.x-origin.x<5.7);close(blocked.y,4.165);
block=false;ceiling=floorY+1.9;
move(checked,blocked,6.5,13.5);assert.equal(checked.state.surface,'ground');close(blocked.y,4.165);
ceiling=Infinity;move(checked,blocked,8.8,13.5);assert.equal(checked.state.surface,'loft');
checked.reset(blocked);assert.equal(checked.state.surface,'ground');close(blocked.y,4.165);
const outside=position(-2,-2),terrain=createWalkLevels({data,loftData,floorY,groundHeight:(x,z)=>x/10,
  canStandAt:()=>true,headroomAt:()=>Infinity});
terrain.reset(outside);move(terrain,outside,-1,-2);close(outside.y,outside.x/10+1.7);
const holeLevels=createWalkLevels({data,loftData:{...loftData,floorHoles:[...loftData.floorHoles,{x0:8.6,x1:9.4,z0:14.5,z1:15.1}]},floorY,
  groundHeight:()=>floorY,canStandAt:()=>true,headroomAt:()=>Infinity});
const atHole=position(5.5,13.5);holeLevels.reset(atHole);move(holeLevels,atHole,8.8,13.5);move(holeLevels,atHole,8.8,15);
assert(atHole.z-origin.z<=14.32+1e-8,'Hatch-sized floor holes retain a full body-radius margin');
assert.equal(holeLevels.state.surface,'loft');
let headChecks=0;
const envelope=createWalkLevels({data,loftData,floorY,groundHeight:()=>floorY,canStandAt:()=>true,
  headroomAt:(x,z)=>{headChecks++;return z-origin.z>13.6?floorY+1.9:Infinity;}});
const head=position(5.5,13.5);envelope.reset(head);
envelope.constrain(head,head.x,head.z);assert.equal(headChecks,0,'Idle walking does not raycast the roof');
move(envelope,head,6,13.5);assert.equal(envelope.state.surface,'ground','Headroom includes the body radius, not just its center');
console.log('Level-aware walking: 13 treads, landing, descent, support boundaries, body checks and ground resets verified');
