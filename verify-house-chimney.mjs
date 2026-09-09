import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {createHouseChimney,houseFlue} from './house-chimney.js';
import {prepareLivingData} from './docs/living-interior.js';
const require=createRequire(import.meta.url),{HOUSE_INTERIOR:data}=require('./house-interior.js'),{HouseRoof}=require('./house-roof.js');
const floorY=2.465,roof=HouseRoof.describe({bbox:[10.48,7.18,21.28,26.43],atrium:[10.48,15.93,14.93,19.18],gable:[13.68,21.28],baseY:floorY});
const chimney=createHouseChimney(THREE,data,{floorY,roofHeight:roof.heightAt});
chimney.root.updateMatrixWorld(true);
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const flue=houseFlue(data),fitout=prepareLivingData(data).buildFireplace().parts.find(p=>p.name==='visible_flue');
near(fitout.position[0]+data.originPlot.x,16.705);near(fitout.position[1]+data.originPlot.z,19.77);
near(fitout.position[2]+fitout.height/2,6.95);
for(const mesh of chimney.root.children){
  near(mesh.position.x,16.705);near(mesh.position.z,19.77);
  near(mesh.geometry.parameters.radiusTop,.09);
  near(mesh.geometry.parameters.radiusBottom,fitout.radiusBottom);
}
const bounds=new THREE.Box3().setFromObject(chimney.root);
near(bounds.max.y,floorY+7.75);
assert(bounds.min.y>floorY+3.07,'Exterior chimney stays above ground-floor rooms');
assert(bounds.min.y<roof.heightAt(16.705,19.77),'Roof flue intersects the roof rather than floating above it');
const terminal=chimney.root.getObjectByName('Roof flue terminal'),terminalBounds=new THREE.Box3().setFromObject(terminal);
near(terminalBounds.min.y,floorY+fitout.position[2]+fitout.height/2);
const overlapBounds=new THREE.Box3().setFromObject(chimney.interiorOverlap);
near(overlapBounds.max.y,terminalBounds.min.y);
const shifted={...data,fireplace:{...data.fireplace,x0:data.fireplace.x0+1,x1:data.fireplace.x1+1}};
near(houseFlue(shifted).x,flue.x+1);
console.log('Roof chimney follows the fireplace, clears the hallway and joins the furnished flue');
