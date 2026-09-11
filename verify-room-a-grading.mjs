import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js');
const {TERRAIN}=require('./terrain.js');
const {GradingSite}=require('./grading-site.js');
const {PergolaModel}=require('./pergola-model.js');
const {RaisedBedsModel}=require('./raised-beds-model.js');
const {GreenhouseModel}=require('./greenhouse-model.js');
const {FirepitModel}=require('./firepit-model.js');
const {HiddenBenchModel}=require('./hidden-bench-model.js');
const {GardenRouteModel}=require('./garden-route-model.js');
const surveyData=existsSync(new URL('./docs/survey-terrain.js',import.meta.url))?require('./docs/survey-terrain.js').SURVEY_TERRAIN:null;
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey:surveyData});
const pergola=PergolaModel.build(GARDEN);
const beds=RaisedBedsModel.build(GARDEN,{surfaceHeight:site.routeHeight,groundHeight:site.height,court:site.spec.productiveCourt});
const greenhouse=GreenhouseModel.build(GARDEN,site.baseHeight,{floorHeight:site.spec.productiveCourt.greenhouseFinish});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
let maximumDiningBuildUp=0;
function verifyRouteSupport(route,x,z){
  const buildUp=site.routeHeight(x,z)-site.height(x,z);
  if(route.id==='Daily dining'||route.id==='Pond approach'){
    let minimum=route.bedding;
    if(route.id==='Pond approach'){
      near(route.startBedding,.02);
      const [a,b]=route.points,dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/Math.hypot(dx,dz)/1.2));
      minimum=route.startBedding+(route.bedding-route.startBedding)*t*t*(3-2*t);
    }
    assert(buildUp>=minimum-1e-7,`${route.id} finish must remain above its minimum bedding depth`);
    if(route.id==='Daily dining')maximumDiningBuildUp=Math.max(maximumDiningBuildUp,buildUp);
  }else near(buildUp,route.bedding);
}
const fire=FirepitModel.build(GARDEN,site.height);
near(pergola.floorHeight,2.015);
near(site.height(22,14),2.345);
near(site.routeHeight(22,14),2.465);
const fireFinish=pergola.floorHeight-.4;
near(fire.floorHeight+.008,fireFinish);
for(const v of fire.parts.find(p=>p.name==='gravel_apron').vertices.slice(65))near(v[2]+fire.floorHeight,fireFinish);
for(const route of site.spec.routeProfiles) {
  near(site.routeHeight(...route.points[0]),route.levels[0]);
  near(site.routeHeight(...route.points.at(-1)),route.levels.at(-1));
  for(let j=1;j<route.points.length;j++)for(let i=0;i<=20;i++) {
    const t=i/20,a=route.points[j-1],b=route.points[j],x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
    const depth=site.routeHeight(x,z)-site.height(x,z);
    verifyRouteSupport(route,x,z);
  }
}
const link=GARDEN.gardenRoutes.find(r=>r.id==='Gathering connection');
for(let i=0;i<128;i++)for(const radius of [.5,.9,1]) {
  const p=site.spec.pond,a=i*Math.PI/64,x=p.cx+Math.cos(a)*p.rx*radius,z=p.cz+Math.sin(a)*p.rz*radius;
  assert.ok(site.height(x,z)<=p.edge-p.depth*.5*(1+Math.cos(radius*Math.PI))+1e-7,'Gathering banks must not fill the pond basin');
}
assert(site.routeHeight(...link.points[0])>site.routeHeight(...link.points.at(-1)));
for(const p of site.spec.finishPads.filter(p=>p.x1<11))assert(site.height((p.x0+p.x1)/2,(p.z0+p.z1)/2)<=TERRAIN.houseFFLInternal-.04,'Soil stays below the terrace and sauna finish');
const bench=HiddenBenchModel.build(GARDEN,site.height);
for(const foot of bench.feet)for(const [x,z,y]of foot.bottomCorners){near(bench.floorHeight+y,site.height(x,z));assert(y<0,'Rigid bench rests above graded leveling pads');}
near(greenhouse.floorHeight,2.385);
for(const bed of beds.beds){
  const expected=2.865;
  near(bed.floorHeight,expected);
  const soil=beds.parts.find(part=>part.name===`${bed.id}_soil`);
  near(soil.position[2]+soil.size[2]/2+beds.floorHeight,expected+.53);
}
let minFill=Infinity,maxFill=-Infinity;
for(let x=25;x<=36.5;x+=.5)for(let z=1.5;z<=10.5;z+=.5) {
  const fill=site.height(x,z)-site.baseHeight(x,z);minFill=Math.min(minFill,fill);maxFill=Math.max(maxFill,fill);
  const h=site.height(x,z);near(h,site.height(x+1e-9,z));
}
console.log(JSON.stringify({gatheringFinished:pergola.floorHeight,houseFinished:site.spec.deckTop,gatheringFillRange:[minFill,maxFill],routeChecks:'pass'}));
assert.equal(site.spec.gatheringPads.length,2,'Only independent pergola and circular fire pads remain');
assert.equal(site.spec.gatheringPads[1].radius,2);
assert(maxFill<1.53305,'Northern gathering fill stays below the established earthworks limit');
const grades=site.spec.routeProfiles.map(route=>{
  let maximum=0,localMaximum=0;
  for(let i=1;i<route.points.length;i++){
    const [a,b]=[route.points[i-1],route.points[i]],distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
    maximum=Math.max(maximum,Math.abs(route.levels[i]-route.levels[i-1])/distance);
    let previous=site.routeHeight(...a);
    for(let j=1;j<=100;j++){
      const t=j/100,h=site.routeHeight(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);
      localMaximum=Math.max(localMaximum,Math.abs(h-previous)/(distance/100));previous=h;
      for(const side of [-route.width/2,route.width/2]){
        const x=a[0]+(b[0]-a[0])*t+side*(b[1]-a[1])/distance,z=a[1]+(b[1]-a[1])*t-side*(b[0]-a[0])/distance;
        const depth=site.routeHeight(x,z)-site.height(x,z);
        if(route.id==='Productive access')assert(Math.abs(depth-route.bedding)<.003);else verifyRouteSupport(route,x,z);
      }
    }
  }
  assert(maximum<.11,`${route.id} grade exceeds concept limit`);
  assert(localMaximum<.13,`${route.id} local transition exceeds 13% concept grade`);
  return {route:route.id,nominalMaximumGrade:maximum,localMaximumGrade:localMaximum};
});
let bankMaximum=0;
const firePad=site.spec.gatheringPads[1];
for(let z=firePad.cz+firePad.radius;z<site.spec.pond.cz-site.spec.pond.rz;z+=.025)bankMaximum=Math.max(bankMaximum,Math.abs(site.height(firePad.cx,z+.025)-site.height(firePad.cx,z))/.025);
assert(bankMaximum<.55,'Planted fire-to-pond bank must remain below the 55% concept grade');
console.log(JSON.stringify({grades,fireToPondBankMaximumGrade:bankMaximum,maximumDiningBuildUp,diningBuildUpStatus:'Sampled model clearance; not a specified construction depth'}));
const routeGeometry=GardenRouteModel.geometry(GARDEN.gardenRoutes,site.routeHeight);
let maxRouteError=0,worstRoutePoint;
for(let i=0;i<routeGeometry.positions.length;i+=3) {
  const [x,y,z]=routeGeometry.positions.slice(i,i+3),error=Math.abs(y-site.routeHeight(Math.fround(x),Math.fround(z)));
  if(error>maxRouteError){maxRouteError=error;worstRoutePoint=[x,y,z];}
}
assert.ok(maxRouteError<.002,JSON.stringify({maxRouteError,worstRoutePoint}));
const bendCenters=[[24.76,11.96],...site.spec.routeProfiles.flatMap(route=>route.points.slice(1,-1))];
for(const [cx,cz]of bendCenters)for(let i=-20;i<=20;i++) {
  const x=cx+i*.001,z=cz+i*.001;
  for(const [dx,dz] of [[1e-5,0],[-1e-5,0],[0,1e-5],[0,-1e-5]]) {
    assert.ok(Math.abs(site.routeHeight(x,z)-site.routeHeight(x+dx,z+dz))<.0001,'Route bend bisectors must stay continuous');
    assert.ok(Math.abs(site.height(x,z)-site.height(x+dx,z+dz))<.0001,'Route bedding must stay continuous');
  }
}
console.log(JSON.stringify({maxRouteError,routeVertices:routeGeometry.positions.length/3,bendContinuity:'pass'}));

const saunaAccess=GardenRouteModel.geometry(GARDEN.gardenRoutes.filter(r=>['Productive access','Wellness access'].includes(r.id)),site.routeHeight,.12,GardenRouteModel.surfaceExclusions(GARDEN));
for(let i=0;i<saunaAccess.positions.length;i+=9){
  const triangle=[0,3,6].map(offset=>saunaAccess.positions.slice(i+offset,i+offset+3));
  for(const [x,y,z] of triangle){assert(y>=TERRAIN.houseFFLInternal-1e-6&&y<=beds.floorHeight+1e-6,'Sauna access has no hill above either endpoint');assert(site.height(x,z)<=y,'Terrain must not protrude through the sauna walkway');}
}
console.log(JSON.stringify({saunaAccessVertices:saunaAccess.positions.length/3,bedToSauna:'flat then monotonic descent, including full width and rounded joins'}));

const descends=points=>{let previous=Infinity;for(const [x,z] of points){const value=site.routeHeight(x,z);assert(value<=previous+1e-8,'Every full-width trajectory descends or stays level toward sauna');previous=value;}};
for(let side=-.5;side<=.5;side+=.025){
  descends(Array.from({length:401},(_,i)=>[5.6+2.4*i/400,13.2+side]));
  descends(Array.from({length:401},(_,i)=>[8+side,13.2-7.5*i/400]));
}
for(let radius=0;radius<=.5;radius+=.025)for(const outer of [false,true])descends(Array.from({length:101},(_,i)=>{const a=i/100*Math.PI/2;return outer?[8+radius*Math.sin(a),13.2+radius*Math.cos(a)]:[8-radius*Math.cos(a),13.2-radius*Math.sin(a)];}));
assert(site.routeHeight(8,13.2)<beds.floorHeight-.1,'Connector descends immediately outside court instead of extending a raised platform to its bend');
