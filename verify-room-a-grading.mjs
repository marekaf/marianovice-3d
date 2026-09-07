import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js');
const {TERRAIN}=require('./terrain.js');
const {SiteTerrain}=require('./site-terrain.js');
const {GarageModel}=require('./garage-model.js');
const {PergolaModel}=require('./pergola-model.js');
const {RaisedBedsModel}=require('./raised-beds-model.js');
const {GreenhouseModel}=require('./greenhouse-model.js');
const {FirepitModel}=require('./firepit-model.js');
const {HiddenBenchModel}=require('./hidden-bench-model.js');
const {GardenRouteModel}=require('./garden-route-model.js');
const {SurveySurface}=require('./survey-surface.js');
const surveyData=existsSync(new URL('./docs/survey-terrain.js',import.meta.url))?require('./docs/survey-terrain.js').SURVEY_TERRAIN:null;
const pergola=PergolaModel.build(GARDEN),beds=RaisedBedsModel.build(GARDEN);
const greenhouse=GreenhouseModel.build(GARDEN,TERRAIN.plane);
const site=SiteTerrain.create(GARDEN,TERRAIN.plane,{
  garage:GarageModel.groundPatch(GARDEN,TERRAIN.houseFFLInternal-.5),pergola:pergola.groundPatch,
  raisedBeds:beds.groundPatch,greenhouse:greenhouse.groundPatch,
},{houseFFL:TERRAIN.houseFFLInternal,surveySurface:surveyData?SurveySurface.create(surveyData.points,TERRAIN.plane).data:undefined});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const fire=FirepitModel.build(GARDEN,site.height);
near(fire.floorHeight+.008,pergola.floorHeight);
for(const v of fire.parts.find(p=>p.name==='gravel_apron').vertices.slice(65))near(v[2]+fire.floorHeight,pergola.floorHeight);
for(const route of site.spec.routeProfiles) {
  near(site.routeHeight(...route.points[0]),TERRAIN.houseFFLInternal);
  near(site.routeHeight(...route.points.at(-1)),pergola.floorHeight);
  for(let j=1;j<route.points.length;j++)for(let i=0;i<=20;i++) {
    const t=i/20,a=route.points[j-1],b=route.points[j],x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
    near(site.routeHeight(x,z)-site.height(x,z),.04);
  }
}
const link=GARDEN.gardenRoutes.find(r=>r.id==='Gathering connection');
for(let i=0;i<128;i++)for(const radius of [.5,.9,1]) {
  const p=site.spec.pond,a=i*Math.PI/64,x=p.cx+Math.cos(a)*p.rx*radius,z=p.cz+Math.sin(a)*p.rz*radius;
  assert.ok(site.height(x,z)<=p.edge-p.depth*.5*(1+Math.cos(radius*Math.PI))+1e-7,'Gathering banks must not fill the pond basin');
}
for(const p of link.points)near(site.routeHeight(...p),pergola.floorHeight);
for(const p of site.spec.finishPads.filter(p=>p.x1<11))near(site.height((p.x0+p.x1)/2,(p.z0+p.z1)/2),TERRAIN.houseFFLInternal-.12);
const bench=HiddenBenchModel.build(GARDEN,site.height);
near(bench.floorHeight,site.height(bench.footprint.x+bench.footprint.w/2,bench.footprint.y+bench.footprint.d/2));
for(const pad of [beds.groundPatch,greenhouse.groundPatch])near(site.height(pad.x+pad.w/2,pad.y+pad.d/2),pad.level);
let minFill=Infinity,maxFill=-Infinity;
for(let x=25;x<=36.5;x+=.5)for(let z=6.8;z<=10.5;z+=.5) {
  const fill=site.height(x,z)-site.baseHeight(x,z);minFill=Math.min(minFill,fill);maxFill=Math.max(maxFill,fill);
  const h=site.height(x,z);near(h,site.height(x+1e-9,z));
}
console.log(JSON.stringify({gatheringFinished:pergola.floorHeight,houseFinished:site.spec.deckTop,gatheringFillRange:[minFill,maxFill],routeChecks:'pass'}));
const routeGeometry=GardenRouteModel.geometry(GARDEN.gardenRoutes,site.routeHeight);
let maxRouteError=0,worstRoutePoint;
for(let i=0;i<routeGeometry.positions.length;i+=3) {
  const [x,y,z]=routeGeometry.positions.slice(i,i+3),error=Math.abs(y-site.routeHeight(Math.fround(x),Math.fround(z)));
  if(error>maxRouteError){maxRouteError=error;worstRoutePoint=[x,y,z];}
}
assert.ok(maxRouteError<.002,JSON.stringify({maxRouteError,worstRoutePoint}));
for(let i=-20;i<=20;i++) {
  const x=24.76+i*.001,z=11.96+i*.001;
  for(const [dx,dz] of [[1e-5,0],[-1e-5,0],[0,1e-5],[0,-1e-5]]) {
    assert.ok(Math.abs(site.routeHeight(x,z)-site.routeHeight(x+dx,z+dz))<.0001,'Route bend bisectors must stay continuous');
    assert.ok(Math.abs(site.height(x,z)-site.height(x+dx,z+dz))<.0001,'Route bedding must stay continuous');
  }
}
console.log(JSON.stringify({maxRouteError,routeVertices:routeGeometry.positions.length/3,bendContinuity:'pass'}));
