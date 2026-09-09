import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const {GradingSite}=require('./grading-site.js');
const {SiteTerrain}=require('./site-terrain.js');
const {GreenhouseModel}=require('./greenhouse-model.js'),{RaisedBedsModel}=require('./raised-beds-model.js');
const survey=existsSync(new URL('./docs/survey-terrain.js',import.meta.url))?require('./docs/survey-terrain.js').SURVEY_TERRAIN:undefined;
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey});
const close=(a,b,label)=>assert(Math.abs(a-b)<1e-8,label);
for(const [x,finish] of [[3.2,2.725],[4.7,2.725],[5.2,2.725],[6.2,2.645731707317073],[6.7,2.645731707317073],[7.2,2.645731707317073],[9.48,2.465],[9.98,2.465]])
  close(site.routeHeight(x,13),finish,'Coordinated productive route finish');
for(const x of [4.2,4.7,5.2,6.2,6.7,7.2])for(const z of [9.9,11,13,15.5])
  close(site.routeHeight(x,z),site.routeHeight(x,13),'North-running aisles have no crossfall or longitudinal steps');
close((site.routeHeight(5.3,13)-site.routeHeight(6.1,13))/.8,.26/3.28,'Approach grade approximately 7.93%');
close(site.routeHeight(6.7,9.8),2.645731707317073,'Northern bed approach meets aisle');
console.log('Productive court finishes and flat aisles pass');
const old=structuredClone(site.spec);delete old.productiveCourt;
const greenhouse=GreenhouseModel.build(GARDEN,site.baseHeight);
const oldBeds=RaisedBedsModel.build(GARDEN);
const rect=p=>({x0:p.x,z0:p.y,x1:p.x+p.w,z1:p.y+p.d,level:p.level});
old.levelPads.push(...[greenhouse.groundPatch,oldBeds.groundPatch].map(p=>({...rect(p),blend:2.4})));
old.protectedPads.push(...[greenhouse.groundPatch,oldBeds.groundPatch].map(p=>({...rect(p),blend:.3})));
const before=(x,z)=>SiteTerrain.height(old,x,z);
for(const pad of [...site.spec.finishPads,...site.spec.protectedPads])for(let i=0;i<=10;i++)for(let j=0;j<=10;j++) {
  const x=pad.x0+(pad.x1-pad.x0)*i/10,z=pad.z0+(pad.z1-pad.z0)*j/10;
  close(site.height(x,z),before(x,z),'Fixed nonproductive pad unchanged');
}
for(let i=0;i<GARDEN.plot.vertices.length;i++)for(let j=0;j<=300;j++) {
  const a=GARDEN.plot.vertices[i],b=GARDEN.plot.vertices[(i+1)%GARDEN.plot.vertices.length],t=j/300;
  const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
  close(site.height(x,z),before(x,z),'Plot boundary unchanged');
}
for(const route of GARDEN.gardenRoutes.filter(r=>!site.spec.productiveCourt.routes.some(p=>p.id===r.id)))for(let i=1;i<route.points.length;i++) {
  const a=route.points[i-1],b=route.points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.05);
  for(let j=0;j<=steps;j++){const x=a[0]+(b[0]-a[0])*j/steps,z=a[1]+(b[1]-a[1])*j/steps;close(site.height(x,z),before(x,z),'Other routes retain ground');}
}
for(const x of [-.2,2.2,4.2,5.2,6.2,7.2,8.8,9.48,9.88])for(let z=6.9;z<=18.5;z+=.05)
  assert(Math.abs(site.height(x-1e-6,z)-site.height(x+1e-6,z))<1e-5,'Court and influence vertical seams continuous');
for(const z of [6.9,7.5,9.3,9.9,16.1,18.5])for(let x=-.2;x<=9.88;x+=.05)
  assert(Math.abs(site.height(x,z-1e-6)-site.height(x,z+1e-6))<1e-5,'Court and influence horizontal seams continuous');
const builtGreenhouse=GreenhouseModel.build(GARDEN,site.baseHeight,{floorHeight:site.spec.productiveCourt.greenhouseFinish});
close(builtGreenhouse.floorHeight,2.725,'Greenhouse stays level at chosen finish');
const entrance=builtGreenhouse.parts.find(p=>p.name==='entrance_pad');
close(entrance.position[2]+entrance.size[2]/2+builtGreenhouse.floorHeight,site.routeHeight(3.2,12.3),'Greenhouse entrance joins route');
const beds=RaisedBedsModel.build(GARDEN,{surfaceHeight:site.routeHeight,groundHeight:site.height,court:site.spec.productiveCourt});
for(const bed of beds.beds) {
  const expected=bed.rect.x===5.2?2.725:2.645731707317073;
  close(bed.floorHeight,expected,'Each bed has its own level base');
  const soil=beds.parts.find(p=>p.name===`${bed.id}_soil`);
  close(soil.position[2]+soil.size[2]/2+beds.floorHeight,bed.floorHeight+.53,'Soil remains level in its bed');
  for(const part of beds.parts.filter(p=>p.name.startsWith(bed.id+'_wall_')&&p.name.endsWith('_0')))for(const [x,z,y]of part.vertices.slice(0,4))
    close(y+beds.floorHeight,site.height(x,z)-.025,'Bottom slat course follows ground without floating');
  for(const plant of beds.plants.filter(p=>p.bedId===bed.id))close(plant.root[2]+beds.floorHeight,bed.floorHeight+.526,'Crops move with level soil');
}
close(site.routeHeight(3.2,10.7),2.725,'Compost-front court surface connects at greenhouse finish');
assert.equal(beds.surfaceFootprint.kind,'rect');
for(const [key,value]of Object.entries({x:2.2,y:9.9,w:7.28,d:6.2}))close(beds.surfaceFootprint[key],value,'Continuous court surface footprint');
console.log('Measured-ground court boundaries, fixed pads, route joins and level bed footings pass');
