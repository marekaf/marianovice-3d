import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{GARDEN}=require('./layout.js'),{CotoneasterModel}=require('./cotoneaster-model.js'),{GardenRouteModel}=require('./garden-route-model.js');
const original=JSON.stringify(GARDEN);
for(const height of [(x,y)=>2+.48*x-.2*y,(x,y)=>2+.05*Math.sin(x*3)+.4*y]){
 const model=CotoneasterModel.build(GARDEN,height);
 assert.equal(model.species,'Cotoneaster');assert.equal(model.zoneId,'L');
 assert(model.anchors.length>150&&model.anchors.length<300);
 for(const p of model.contacts)assert(Math.abs(p[2]-height(p[0],p[1])-.008)<1e-10);
 for(const part of model.parts){
  assert(part.vertices.length>1000);assert(part.faces.length>1000);
  for(const p of part.vertices){
   assert(p.every(Number.isFinite));assert(CotoneasterModel.contains(model.polygons,p[0],p[1]),'Cover stays inside the clipped L bank');
   assert(GardenRouteModel.distance(GARDEN.gardenRoutes,p[0],p[1])>.12,'Cover leaves walking routes clear');
   const above=p[2]-height(p[0],p[1]);assert(above>.002&&above<.17,'Leaves and branches follow steep and curved ground');
  }
  for(const face of part.faces)assert(face.every(i=>Number.isInteger(i)&&i>=0&&i<part.vertices.length));
 }
 assert(!model.species.includes('cultivar'));
}
assert.equal(JSON.stringify(GARDEN),original,'Planting does not alter terrain, fence, or layout inputs');
console.log('Cotoneaster: clipped bank cover, creeping stems, steep-ground contact and route clearances pass');
