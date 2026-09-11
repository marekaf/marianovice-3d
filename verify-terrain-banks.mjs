import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {runPythonJson} from './scripts/python-json.mjs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const {GradingSite}=require('./grading-site.js'),{SiteTerrain}=require('./site-terrain.js');
const survey=existsSync('docs/survey-terrain.js')?require('./docs/survey-terrain.js').SURVEY_TERRAIN:{points:[[-10,-10,4],[60,-10,1],[60,50,2],[-10,50,5]]};
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey});
const near=(actual,expected,label)=>assert(Math.abs(actual-expected)<1e-8,`${label}: ${actual} != ${expected}`);
if(existsSync('docs/survey-terrain.js')){
  const x=1.4,z=10.3,step=.025;
  const slopeJump=Math.abs(site.height(x+step,z)-2*site.height(x,z)+site.height(x-step,z))/step;
  assert(slopeJump<.15,'Bed-court bank crest eases into its level pad');
}
for(const mark of require('./grading-zones.js').GradingZones.create(GARDEN).levelMarks)near(site.height(...mark.position)+(mark.id==='raisedBeds'?.06:mark.id==='C'?.04:site.spec.drivewayProfile.surfaceOffset),TERRAIN.houseFFLInternal+mark.relativeLevel,'Map elevation marks match their actual finished surfaces');
for(const point of [[22,21],[25,24],[30,28],[33,28]])near(site.height(...point),site.spec.drivewayProfile.startLevel,'Level vehicle court');
for(const point of [[28,15],[28,17],[30,18]])near(site.height(...point),site.spec.drivewayProfile.startLevel,'Northern lawn plateau');
for(const z of [18,20,23])near(site.height(9,z),TERRAIN.houseFFLInternal-.3,'Lowered west strip');
for(const x of [17.2,17.7,18.2,20])near(site.height(x,27),site.spec.drivewayProfile.startLevel,'Heat-pump service spur');
near(site.spec.deckTop,TERRAIN.houseFFLInternal,'Terrace datum');
const bedCourt=GARDEN.elements.find(e=>e.id==='raisedBedsPad'),bedRect=bedCourt.parts.find(p=>p.kind==='rect');
const bedFootprints=GARDEN.elements.filter(e=>/^raisedBed[1-4]$/.test(e.id)).map(e=>e.parts.find(p=>p.kind==='rect'));
assert.equal(new Set(bedFootprints.map(r=>r.x)).size,2,'Preserve two bed columns');
assert.equal(new Set(bedFootprints.map(r=>r.y)).size,2,'Preserve two bed rows');
near(bedCourt.meta.grading.level+.06,TERRAIN.houseFFLInternal+.4,'Productive court finish stays 400 mm above west terrace');
assert(9.48-bedRect.x-bedRect.w>3.8,'Productive court stays more than 3.8 m from west terrace');
for(const element of GARDEN.elements.filter(e=>/^raisedBed[1-4]$/.test(e.id))){const r=element.parts.find(p=>p.kind==='rect');assert(9.48-r.x-r.w>4.4,'Every bed stays more than 4.4 m from west terrace');}
for(const x of [bedRect.x,bedRect.x+bedRect.w/2,bedRect.x+bedRect.w])for(const z of [bedRect.y,bedRect.y+bedRect.d/2,bedRect.y+bedRect.d])near(site.height(x,z),bedCourt.meta.grading.level,'Productive court is level across its footprint');
for(const z of [6.73,6.9,7.18]) {
  near(site.height(10.48,z)+.07,TERRAIN.houseFFLInternal,'North gravel western finish');
  near(site.height(21.28,z)+.07,TERRAIN.houseFFLInternal-.5,'North gravel eastern finish');
}
for(const id of ['north-fall','south-fall']) {
  const region=site.spec.regionalGrades.find(r=>r.id===id);
  near(region.fallX*(region.x1-region.x0),-.5,'House-side west to east fall');
}
const withoutApron=structuredClone(site.spec);
delete withoutApron.drivewayApron;
const previous=(x,z)=>SiteTerrain.height(withoutApron,x,z);
const waterSource=GARDEN.elements.find(e=>e.id==='waterSource').parts.find(p=>p.kind==='circle');
const waterPoint=[waterSource.cx,waterSource.cy];
if(existsSync('docs/survey-terrain.js')) {
  assert(site.height(...waterPoint)-previous(...waterPoint)>.2,'Water-source approach must fill the former low patch by at least 20 cm');
  near(site.height(...waterPoint),site.height(waterPoint[0],28.5),'Water-source approach continues the driveway longitudinal level');
}
for(let x=34.13;x<=43;x+=.25)for(let z=19;z<=29;z+=.25)assert(site.height(x,z)>=previous(x,z)-1e-9,'Driveway apron only fills existing low ground');
for(let i=0;i<GARDEN.plot.vertices.length;i++)for(let j=0;j<=200;j++) {
  const a=GARDEN.plot.vertices[i],b=GARDEN.plot.vertices[(i+1)%GARDEN.plot.vertices.length],t=j/200;
  const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
  near(site.height(x,z),previous(x,z),'Water-source apron preserves existing boundary and gate grading');
}
function maximum(fn,[x0,x1,z0,z1]) {
  let max=0;
  for(let x=x0;x<=x1;x+=.1)for(let z=z0;z<=z1;z+=.1) {
    const pond=site.spec.pond;
    if(((x-pond.cx)/pond.rx)**2+((z-pond.cz)/pond.rz)**2<1.05**2)continue;
    const h=fn(x,z);
    for(const [dx,dz] of [[1e-7,0],[0,1e-7]])assert(Math.abs(fn(x+dx,z+dz)-h)<1e-4,'Regional grading must remain continuous');
    max=Math.max(max,Math.hypot(fn(x+.02,z)-fn(x-.02,z),fn(x,z+.02)-fn(x,z-.02))/.04);
  }
  return max*100;
}
const measurements=[['north',[10,40,1,5]],['lower',[35,43,2,18]],['productive',[0,9,7,23]],['south',[8,23,27.5,31]],['east terrace',[23.58,27,12.5,18.5]],['water-source approach',[34.13,42.5,21,27.89]]].map(([name,bounds])=>({name,maximumPercent:maximum(site.height,bounds)}));
if(existsSync('docs/survey-terrain.js'))for(const value of measurements)assert(value.maximumPercent<=50,`${value.name} earth banks must remain within the 1:2 concept envelope`);
for(const segment of site.spec.fixedFences?.segments??[])for(let i=0;i<=100;i++){const t=i/100,x=segment.start[0]+(segment.end[0]-segment.start[0])*t,z=segment.start[1]+(segment.end[1]-segment.start[1])*t;near(site.height(x,z),site.baseHeight(x,z),'Every measured built-fence foot preserves existing ground');}
for(const bank of GARDEN.gradingBanks) {
  assert(bank.points.length>=4 && bank.maxSlope<=.48 && bank.designSlope===.4);
  const edge=bank.id==='north'?0:1,a=GARDEN.plot.vertices[edge],b=GARDEN.plot.vertices[edge+1];
  for(let i=0;i<=100;i++){const t=i/100,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;if(x>=34.13&&z<=19.38)near(site.height(x,z),site.baseHeight(x,z),'Unmown bank foot preserves existing fence terrain');}
}
assert(site.spec.bankReview.some(r=>r.id==='north-fill'));
console.log(JSON.stringify({vehicleCourt:'level',westStrip:'300 mm below terrace',heatPump:'level spur',measurements}));

if(site.spec.fixedFences?.segments.length) {
  const points=site.spec.fixedFences.segments.flatMap(segment=>Array.from({length:101},(_,i)=>segment.start.map((v,axis)=>v+(segment.end[axis]-v)*i/100)));
  for(let x=0;x<44;x+=2)for(let z=0;z<31;z+=2)points.push([x,z]);
  const result=runPythonJson('import json,sys; from blender.site_terrain import height; d=json.load(sys.stdin); print(json.dumps([height(d["spec"],*p) for p in d["points"]]))',{spec:site.spec,points});
  let maximumError=0;points.forEach((p,i)=>{const error=Math.abs(result[i]-site.height(...p));maximumError=Math.max(maximumError,error);assert(error<1e-10,'Measured fixed-fence grading agrees in both renderers');});
  console.log(JSON.stringify({fixedFenceParitySamples:points.length,maximumError}));
}
