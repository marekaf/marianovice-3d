import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildModel} from './model3d.js';
import {buildWalkingDoor,createWalkDoors} from './walk-doors.js';
globalThis.document={createElement(){return{getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};}};}};
const model={name:'target',floorHeight:0,materials:{door:{color:'#ffffff',roughness:.8}},lights:[],opening:{kind:'door'},
  parts:[{name:'target_leaf',type:'box',position:[0,0,1],size:[.8,.04,2],material:'door',category:'door'}],
  doorMotion:{pivot:[-.4,0,0],angle:Math.PI/2,movingParts:['target_leaf']}};
const target=buildWalkingDoor(THREE,model,buildModel);target.updateMatrixWorld(true);
const wall={id:'wall',a:[-2,.8],b:[2,1],h:2.52,openings:[]};
function aimed({walls=[],camera=[0,1.5,1.8],look=[0,1.5,0],recesses,doors=[target],floorY=0}={}){
  const view=new THREE.PerspectiveCamera();view.position.fromArray(camera);view.lookAt(...look);view.updateMatrixWorld(true);
  const data={originPlot:{x:0,z:0},clearH:2.52,extWalls:[],intWalls:walls,buildOpening:()=>null,wallRecesses:recesses};
  return createWalkDoors(THREE,{data,doors,floorY}).aimedDoor(view);
}
assert(aimed()===target);
assert(aimed({walls:[wall]})===null,'A solid partition occludes the target');
const opening={at:1.5,w:1,h:2};
assert(aimed({walls:[{...wall,openings:[opening]}],camera:[-.9,1.5,1.8]})===target,'Sight passes an aperture even when a body-radius probe would overlap its jamb');
assert(aimed({walls:[{...wall,openings:[{...opening,h:1.3}]}]})===null,'The header blocks a high sightline');
assert(aimed({walls:[{...wall,openings:[{...opening,sill:1.6,h:.4}]}]})===null,'The sill blocks a low sightline');
assert(aimed({walls:[{...wall,openings:[{...opening,sill:1.1,h:.9}]}],camera:[0,.6,1.8],look:[0,1.5,0]})===null,'Looking upward still intersects the raised sill');
assert(aimed({walls:[{...wall,openings:[{...opening,h:1.1}]}],camera:[0,1.8,1.8],look:[0,.8,0]})===null,'Looking downward still intersects the header');
assert(aimed({walls:[{...wall,openings:[{...opening,sill:.9,h:.3}]}],camera:[0,.6,1.8],look:[0,1.5,0]})===target,'Upward visibility uses the ray height at the opening, not camera height');
assert(aimed({walls:[{...wall,openings:[{...opening,sill:1.1,h:.2}]}],camera:[0,1.6,1.8],look:[0,.8,0]})===target,'Downward visibility uses the ray height at the opening, not camera height');
const narrow={at:1.9,w:.2,h:2,reveal:{width:1,depth0:.8,depth1:1}};
assert(aimed({walls:[{...wall,openings:[narrow]}],camera:[-.9,1.5,1.8]})===target,'A full-depth reveal widens the physical sight aperture');
assert(aimed({walls:[{...wall,openings:[{...narrow,reveal:{...narrow.reveal,depth0:.9}}]}],camera:[-.9,1.5,1.8]})===null,'Reveal widening never removes wall beyond its recorded depth');
assert(aimed({walls:[{...wall,profile:[[-2,.5],[2,.5]]}]})===target,'A sightline above a low wall stays clear');
assert(aimed({walls:[{...wall,profile:[[-2,.5],[0,2],[2,.5]]}]})===null,'The raised centre of a profiled wall occludes the target');
const glazed={...wall,profile:[[-2,2],[0,2.52],[2,2]],glazing:[{x0:-.5,x1:.5,sill:1,h:1}]};
assert(aimed({walls:[glazed]})===target,'A profiled wall preserves its rectangular glazing aperture');
assert(aimed({walls:[glazed],camera:[0,.8,1.8],look:[0,.8,0]})===null,'The wall beneath a profiled glazing aperture remains solid');
assert(aimed({walls:[wall],floorY:2.92})===target,'Loft wall coordinates do not occlude a ground-floor target');
assert(aimed({walls:[wall],recesses:()=>[{x0:-.5,x1:.5,z0:.8,z1:1,y0:0,y1:2}]})===target,'A physical wall recess clears its exact volume');
assert(aimed({walls:[wall],recesses:()=>[{x0:-.5,x1:.5,z0:.9,z1:1,y0:0,y1:2}]})===null,'A shallow recess does not erase the remaining wall depth');
const framed=buildWalkingDoor(THREE,{...model,parts:[...model.parts,{name:'fixed_frame',type:'box',position:[0,.4,1],size:[.1,.05,2],material:'door',category:'door'}]},buildModel);
framed.updateMatrixWorld(true);
assert(aimed({doors:[framed]})===null,'Fixed frame geometry in front of a leaf blocks targeting');
const closer=buildWalkingDoor(THREE,model,buildModel);closer.position.z=.4;closer.updateMatrixWorld(true);
assert(aimed({doors:[target,closer]})===closer,'The nearer physical leaf occludes a farther door');
console.log('Door sightlines: exact openings, sills, headers, profiles, recesses, frames and nearer leaves verified');
