import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js');
const {TERRAIN}=require('./terrain.js');
const {GreenhouseModel}=require('./greenhouse-model.js');
const {PergolaModel}=require('./pergola-model.js');
const {GradingZones}=require('./grading-zones.js');
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
const fire=element('firePit'),circle=fire.parts.find(p=>p.kind==='circle');
const zoneC=GradingZones.create(GARDEN).zones.find(zone=>zone.id==='C');
const contains=(polygon,x,z)=>{
  const sides=polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length];return (b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]);});
  return sides.every(value=>value>=-1e-8)||sides.every(value=>value<=1e-8);
};
for(let i=0;i<360;i++){
  const angle=i*Math.PI/180,x=circle.cx+circle.r*Math.cos(angle),z=circle.cy+circle.r*Math.sin(angle);
  assert(zoneC.polygons.some(p=>contains(p,x,z)),'Entire firepit seating circle belongs to zone C');
}
const fireFinish=fire.meta.grading.level+fire.meta.grading.surfaceOffset+.008;
assert(Math.abs(fireFinish-(TERRAIN.houseFFLInternal-.5))<1e-8,'Firepit apron shares the C finished level');
if(existsSync(new URL('./docs/survey-terrain.js',import.meta.url))){
  const {site}=require('./grading-site.js').GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey:require('./docs/survey-terrain.js').SURVEY_TERRAIN});
  for(let radius=0;radius<=circle.r+.001;radius+=.1)for(let i=0;i<72;i++){
    const angle=i*Math.PI/36,x=circle.cx+radius*Math.cos(angle),z=circle.cy+radius*Math.sin(angle);
    assert(Math.abs(site.height(x,z)-fire.meta.grading.level)<1e-8,'Ground beneath the full firepit apron is level');
  }
}
console.log('Grading layout: lowered west strip, smaller coordinated greenhouse, relocated beds and clear bedroom sightline pass');
