import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {GardenRouteModel}=require('./garden-route-model.js');
const {GARDEN}=require('./layout.js');
const test=[{points:[[0,0],[5,0],[5,5]],width:1.2}];
assert.equal(GardenRouteModel.distance(test,2,0),-.6);
assert.ok(Math.abs(GardenRouteModel.distance(test,2,1)-.4)<1e-9);
const result=GardenRouteModel.geometry(GARDEN.gardenRoutes,(x,z)=>2+x*.02+z*.01);
assert.ok(result.positions.length>1000);
for(let i=0;i<result.positions.length;i+=3) {
  const [x,y,z]=result.positions.slice(i,i+3);
  assert.ok(Number.isFinite(x+y+z));
  assert.ok(Math.abs(y-(2+x*.02+z*.01))<1e-9);
  assert.ok(GardenRouteModel.distance(GARDEN.gardenRoutes,x,z)<.012);
}
assert.deepEqual(GardenRouteModel.geometry(GARDEN.gardenRoutes,(x,z)=>2+x*.02+z*.01),result);
console.log(`Garden routes: ${result.positions.length/3} rooted vertices, bounded union, deterministic generation pass`);
