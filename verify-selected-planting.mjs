import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import fs from 'node:fs';
import vm from 'node:vm';
import {createMeshHeightQuery} from './mesh-height-query.js';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js');
const {GardenRouteModel}=require('./garden-route-model.js');
const {SelectedPlanting}=require('./selected-planting.js');
const {PlantingProfiles}=require('./planting-profiles.js');
const TreeModel=vm.runInNewContext(fs.readFileSync(new URL('./tree-model.js',import.meta.url),'utf8')+';TreeModel');
const pergola=GARDEN.elements.find(e=>e.id==='pergola');
const rect=pergola.parts.find(p=>p.kind==='rect');
const roses=SelectedPlanting.createRoses(THREE,pergola);
assert.equal(roses.userData.species,'Rosa — climbing cultivars');
assert.equal(roses.userData.trainedPosts,4);assert.equal(roses.userData.trainedBeams,2);
let stems=0,flowers=0;
roses.traverse(m=>{if(m.name==='Rose stems')stems+=m.geometry.attributes.position.count;if(m.name==='Rose flowers')flowers+=m.count;});
assert.ok(stems>200);assert.ok(flowers>60);
const bounds=new THREE.Box3().setFromObject(roses);
assert.ok(bounds.min.x>=rect.x&&bounds.max.x<=rect.x+rect.w);
assert.ok(bounds.min.z>=rect.y&&bounds.max.z<=rect.y+rect.d);
assert.ok(bounds.max.y>pergola.meta.grading.level+2.3);
const maple=GARDEN.elements.find(e=>e.id==='specimenMaple');assert.ok(maple);
const anchor=maple.parts.find(p=>p.kind==='circle');
assert.deepEqual([anchor.cx,anchor.cy],[32.3,14]);
const routeData=GardenRouteModel.geometry(GARDEN.gardenRoutes,()=>0);
const routeGeometry=new THREE.BufferGeometry();routeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(routeData.positions,3));
const routeHeight=createMeshHeightQuery(routeGeometry);
assert.notEqual(routeHeight(38.5,12),null,'Regression: the former trunk location is physically on the rounded route');
let pocketRays=0;for(let dx=-.7;dx<=.7001;dx+=.05)for(let dz=-.7;dz<=.7001;dz+=.05)if(Math.hypot(dx,dz)<=.7){assert.equal(routeHeight(anchor.cx+dx,anchor.cy+dz),null);pocketRays++;}
assert.ok(pocketRays>500);
assert.throws(()=>SelectedPlanting.createMaple(THREE,TreeModel,maple,()=>1.5,()=>true),/planting pocket/);
const tree=SelectedPlanting.createMaple(THREE,TreeModel,maple,()=>1.5);
assert.equal(tree.userData.species,'Acer × freemanii');
assert.equal(tree.userData.treeForm,'broad');assert.equal(tree.userData.height,5);
const tb=new THREE.Box3().setFromObject(tree);
assert.ok(Math.hypot(Math.max(anchor.cx-tb.min.x,tb.max.x-anchor.cx),Math.max(anchor.cy-tb.min.z,tb.max.z-anchor.cy))<=2.00001);
assert.ok(tb.min.z>7.18+1.9,'Canopy stays south of bedroom east viewing corridor');
const pond=GARDEN.elements.find(e=>e.id==='pond').parts.find(p=>p.kind==='ellipse');
assert.ok(Math.hypot((anchor.cx-pond.cx)/(pond.rx+2),(anchor.cy-pond.cy)/(pond.ry+2))>1);
for(const id of ['quietGardenBorder','eastGatheringBorder','orchardMeadow']){
 const zone=GARDEN.elements.find(e=>e.id===id);assert.ok(zone.meta.selectedFlowers);
 const colors=new Set();for(let x=0;x<12;x+=.25){const p=PlantingProfiles.selectedDaisy(zone.meta.selectedFlowers,x,17);if(p){assert.equal(p.profile,'daisy');colors.add(p.color);}}
 assert.equal(colors.size,3);
}
assert.equal(GARDEN.elements.find(e=>e.id==='quietGardenBorder').meta.purpose,'cutting-bed');
console.log('Selected planting: trained rose geometry, bounded specimen maple and three-colour daisy communities pass');
