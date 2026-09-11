import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const {GradingSite}=require('./grading-site.js');
const {GreenhouseModel}=require('./greenhouse-model.js'),{RaisedBedsModel}=require('./raised-beds-model.js');
const survey=existsSync(new URL('./docs/survey-terrain.js',import.meta.url))?require('./docs/survey-terrain.js').SURVEY_TERRAIN:undefined;
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey});
const close=(a,b,label)=>assert(Math.abs(a-b)<1e-8,label);
const court=site.spec.productiveCourt;
close(court.finish,TERRAIN.houseFFLInternal+.4,'Productive ground is 40 cm above the west terrace');
for(let x=court.x0;x<=court.x1+.001;x+=.2)for(let z=court.z0;z<=court.z1+.001;z+=.2)
  close(site.routeHeight(x,z),2.865,'Entire productive court has one level finish');
for(const x of [court.x0,court.x1,court.x0-court.blend,court.x1+court.blend])for(let z=9.5;z<=17;z+=.05)
  assert(Math.abs(site.height(x-1e-6,z)-site.height(x+1e-6,z))<1e-5,'Court and bank vertical seams remain continuous');
for(const z of [court.z0,court.z1,court.z0-court.blend,court.z1+court.blend])for(let x=.4;x<=6.6;x+=.05)
  assert(Math.abs(site.height(x,z-1e-6)-site.height(x,z+1e-6))<1e-5,'Court and bank horizontal seams remain continuous');
const builtGreenhouse=GreenhouseModel.build(GARDEN,site.baseHeight,{floorHeight:site.spec.productiveCourt.greenhouseFinish});
close(builtGreenhouse.floorHeight,2.385,'Greenhouse stays level at chosen finish');
const entrance=builtGreenhouse.parts.find(p=>p.name==='entrance_pad');
close(entrance.position[2]+entrance.size[2]/2+builtGreenhouse.floorHeight,site.routeHeight(entrance.position[0],entrance.position[1]),'Greenhouse entrance joins route');
const beds=RaisedBedsModel.build(GARDEN,{surfaceHeight:site.routeHeight,groundHeight:site.height,court:site.spec.productiveCourt});
for(const bed of beds.beds) {
  const expected=2.865;
  close(bed.floorHeight,expected,'Each bed has its own level base');
  const soil=beds.parts.find(p=>p.name===`${bed.id}_soil`);
  close(soil.position[2]+soil.size[2]/2+beds.floorHeight,bed.floorHeight+.53,'Soil remains level in its bed');
  for(const part of beds.parts.filter(p=>p.name.startsWith(bed.id+'_wall_')&&p.name.endsWith('_0')))for(const [x,z,y]of part.vertices.slice(0,4))
    close(y+beds.floorHeight,site.height(x,z)-.025,'Bottom slat course follows ground without floating');
  for(const plant of beds.plants.filter(p=>p.bedId===bed.id))close(plant.root[2]+beds.floorHeight,bed.floorHeight+.526,'Crops move with level soil');
}

assert.equal(beds.surfaceFootprint.kind,'rect');
for(const [key,value]of Object.entries({x:1.4,y:10.1,w:4.2,d:6.2}))close(beds.surfaceFootprint[key],value,'Continuous court surface footprint');
console.log('Level productive court, continuous banks, greenhouse route join and grounded bed components pass');
