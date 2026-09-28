import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{GARDEN}=require('./layout.js'),{CotoneasterModel}=require('./cotoneaster-model.js'),{GardenRouteModel}=require('./garden-route-model.js');
const original=JSON.stringify(GARDEN);
const {GradingZones}=require('./grading-zones.js');
const zone=GradingZones.create(GARDEN).zones.find(z=>z.id==='L'),points=zone.polygons.flat();
const bounds=[Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[1]))];
const edgeDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
const covers=GARDEN.elements.flatMap(e=>e.meta?.accessCover?[e.meta.accessCover]:e.id==='waterSource'?e.parts.filter(p=>p.kind==='circle').map(p=>({x:p.cx,z:p.cy})):[]);
let plantableArea=0;
for(let x=bounds[0]+.025;x<bounds[1];x+=.05)for(let y=bounds[2]+.025;y<bounds[3];y+=.05){
 if(CotoneasterModel.contains(zone.polygons,x,y)&&zone.boundaries.every(([a,b])=>edgeDistance(x,y,a,b)>.3)&&GardenRouteModel.distance(GARDEN.gardenRoutes,x,y)>.3&&!covers.some(c=>Math.hypot(x-c.x,y-c.z)<.98))plantableArea+=.0025;
}
assert(plantableArea>0);
for(const height of [(x,y)=>2+.48*x-.2*y,(x,y)=>2+.05*Math.sin(x*3)+.4*y]){
 const model=CotoneasterModel.build(GARDEN,height);
assert.deepEqual(CotoneasterModel.build(GARDEN,height,{grading:GradingZones.create(GARDEN)}),model,'Shared grading zones build the same bank');
 assert.equal(model.species,'Cotoneaster');assert.equal(model.zoneId,'L');
 const density=model.anchors.length/plantableArea;
 assert(Math.abs(density*.6*.6-1)<.15,'Bank planting retains a 60 cm grid density after edge and access clearances');
 for(let i=0;i<model.anchors.length;i++)for(let j=i+1;j<model.anchors.length;j++)assert(Math.hypot(model.anchors[i][0]-model.anchors[j][0],model.anchors[i][1]-model.anchors[j][1])>=.6-1e-8,'Roots retain at least 60 cm spacing');
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
