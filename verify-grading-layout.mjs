import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js');
const {TERRAIN}=require('./terrain.js');
const {GreenhouseModel}=require('./greenhouse-model.js');
const {PergolaModel}=require('./pergola-model.js');
const element=id=>GARDEN.elements.find(e=>e.id===id);
const rect=id=>element(id).parts.find(p=>p.kind==='rect');
const west=rect('westTerrace'),strip=rect('westDrainageStrip'),court=rect('raisedBedsPad');
assert.equal(west.w,1);
assert(strip.w>=.5&&strip.w<=1);
assert(Math.abs(strip.x+strip.w-west.x)<1e-8);
assert(court.x+court.w<strip.x,'Productive court leaves room for the lowered strip and access');
assert.equal(element('westDrainageStrip').meta.grading.relativeLevel,-.3);
const greenhouse=rect('greenhouse');
assert.equal(greenhouse.w*greenhouse.d,4);
const model=GreenhouseModel.build(GARDEN,()=>100);
assert(Math.abs(model.floorHeight-(TERRAIN.houseFFLInternal-.08))<1e-8,'Greenhouse floor allows the bank to the higher bed ground');
const pergola=rect('pergola');
assert(pergola.x<25,'Pergola moves closer to the house');
assert(pergola.y+pergola.d+.25<8.42,'Pergola roof clears the full bedroom window sightline to the east');
const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
let roofClearance=Infinity;
let fenceSegments=[];
try{fenceSegments=require('./docs/fence-survey.js').FENCE_SURVEY.segments;}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
for(const part of PergolaModel.build(GARDEN).parts.filter(p=>p.type==='box'&&p.category==='roof'))for(const x of [part.position[0]-part.size[0]/2,part.position[0]+part.size[0]/2])for(const y of [part.position[1]-part.size[1]/2,part.position[1]+part.size[1]/2]){
  for(const segment of fenceSegments)roofClearance=Math.min(roofClearance,distance([x,y],segment.start,segment.end));
}
if(fenceSegments.length)assert(Math.abs(roofClearance-2)<1e-7,'Actual pergola roof is two metres from the surveyed fence');
const nearPost=PergolaModel.build(GARDEN).parts.find(p=>p.name==='post_2');
assert(Math.abs(Math.hypot(nearPost.position[0]-nearPost.size[0]/2-21.28,nearPost.position[1]+nearPost.size[1]/2-7.18)-2)<1e-7,'House corner to nearest post face is two metres');
const drive=element('driveway'),apron=drive.meta.apron,garage=rect('garage');
assert.equal(apron.d,4);
assert(Math.abs(apron.y-garage.y-garage.d)<1e-8,'Level four-metre apron starts at the garage frontage');
const drivewayPoints=drive.parts.find(p=>p.kind==='polygon').points;
for(const y of [apron.y,apron.y+apron.d])assert(drivewayPoints.some(p=>Math.abs(p[0]-garage.x-garage.w)<1e-8&&Math.abs(p[1]-y)<1e-8),'Straight driveway connects to both apron corners at the garage east end');
console.log('Grading layout: lowered west strip, smaller coordinated greenhouse, relocated beds and clear bedroom sightline pass');
