import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {runPythonJson} from './scripts/python-json.mjs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js'),{GradingSite}=require('./grading-site.js');
const survey=existsSync('docs/survey-terrain.js')?require('./docs/survey-terrain.js').SURVEY_TERRAIN:undefined;
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey});
const strip=GARDEN.elements.find(e=>e.id==='westDrainageStrip').parts.find(p=>p.kind==='rect');
const level=TERRAIN.houseFFLInternal-.3,checks=[];
for(let ix=0;ix<=15;ix++)for(let iz=0;iz<=385;iz++){
  const x=strip.x+strip.w*ix/15,z=strip.y+strip.d*iz/385;
  assert(Math.abs(site.height(x,z)-(level-.004*(Math.min(z,28.3)-strip.y)))<1e-8,`Full lowered strip at ${x},${z}: ${site.height(x,z)} instead of the draining plane`);
  checks.push([x,z]);
}
const trace=[[10.48,6.805],[9.105,6.805],[9.105,7.18],[9.105,28.675],[10.48,28.675]];
let last=Infinity;
for(let i=1;i<trace.length;i++)for(let j=0;j<=100;j++){
  const a=trace[i-1],b=trace[i],x=a[0]+(b[0]-a[0])*j/100,z=a[1]+(b[1]-a[1])*j/100,h=site.height(x,z);
  assert(h<=last+1e-8,'Continuous inlet-to-outlet trace never rises');last=h;checks.push([x,z]);
}
assert(last<level-.09,'Outlet lies below the western collector');
for(let x=9.48;x<=10.48;x+=.025)for(let z=27.45;z<=28.3;z+=.025){
  const rise=Math.abs(site.height(x,z+.001)-site.height(x,z-.001))/.002;
  assert(rise<=.451,'South return blends into the retained facade bank');checks.push([x,z]);
}
let peak=0;
for(let x=5.65;x<=strip.x+.001;x+=.05)for(let z=7.18;z<=17;z+=.05){
  const slope=Math.hypot(site.height(x+.01,z)-site.height(x-.01,z),site.height(x,z+.01)-site.height(x,z-.01))/.02;
  peak=Math.max(peak,slope);
  assert(slope<=.5,`Bank joining the strip exceeds50% at ${x},${z}: ${slope}`);
  checks.push([x,z]);
}
const route=GARDEN.gardenRoutes.find(r=>r.id==='Productive access');
for(const obstacle of GARDEN.elements.filter(e=>/^raisedBed[1-4]$/.test(e.id)||e.id==='greenhouse')){
  const p=obstacle.parts.find(p=>p.kind==='rect');
  for(let i=1;i<route.points.length;i++){
    const a=route.points[i-1],b=route.points[i];
    const distance=t=>Math.hypot(Math.max(p.x-a[0]-(b[0]-a[0])*t,0,a[0]+(b[0]-a[0])*t-p.x-p.w),Math.max(p.y-a[1]-(b[1]-a[1])*t,0,a[1]+(b[1]-a[1])*t-p.y-p.d));
    let lo=0,hi=1;
    for(let j=0;j<80;j++){const l=(2*lo+hi)/3,r=(lo+2*hi)/3;if(distance(l)<distance(r))hi=r;else lo=l;}
    assert(Math.min(distance(0),distance(1),distance((lo+hi)/2))>=route.width/2-1e-8,`Full route width clears ${obstacle.id}`);
  }
}
let previous=-Infinity;
for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(let j=0;j<=Math.ceil(length/.025);j++){
    const t=j/Math.ceil(length/.025),x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,finish=site.routeHeight(x,z);
    assert(finish>=previous-1e-8,'Productive route descends monotonically from beds towards sauna');previous=finish;
    for(const side of [-.5,0,.5]){
      const px=x-(b[1]-a[1])/length*route.width*side,pz=z+(b[0]-a[0])/length*route.width*side;
      assert(site.routeHeight(px,pz)-site.height(px,pz)>=.06-1e-8,'Full route width retains bedding');checks.push([px,pz]);
    }
  }
}
const result=runPythonJson('import json,sys\nfrom blender.site_terrain import height\ndata=json.load(sys.stdin)\nprint(json.dumps([height(data["spec"],x,z) for x,z in data["points"]]))',{spec:site.spec,points:checks});
for(let i=0;i<checks.length;i++)assert(Math.abs(result[i]-site.height(...checks[i]))<1e-9,'Python and browser terrain agree');
console.log(JSON.stringify({stripSamples:16*386,maximumBankSlope:peak,paritySamples:checks.length}));

const crossing=GARDEN.elements.find(e=>e.id==='westDrainageStrip').meta.grading.coveredCrossings.find(p=>p.routeId==='Quiet garden approach');
for(const side of [.001,.25,.5,.75,.999]){
  let previous=-Infinity;
  for(let i=0;i<=100;i++){
    const x=crossing.x+crossing.w*i/100,z=crossing.y+crossing.d*side,finish=site.routeHeight(x,z);
    const distance=Math.max(0,9.48-x),t=Math.min(1,distance/.6),blend=t*t*(3-2*t);
    const expected=TERRAIN.houseFFLInternal+(-.28)*blend;
    assert(Math.abs(finish-expected)<1e-8,'Covered crossing keeps its terrace approach independently of channel soil');
    assert(finish>=previous-1e-8,'Covered crossing rises continuously toward the terrace');previous=finish;
    assert(finish-site.height(x,z)>.05,'Covered crossing clears the draining channel');
  }
}

const {createMeshHeightQuery}=await import('./mesh-height-query.js');
const THREE=require('three'),{GardenRouteModel}=require('./garden-route-model.js');
const meshData=GardenRouteModel.geometry(GARDEN.gardenRoutes,site.routeHeight,.12,GardenRouteModel.surfaceExclusions(GARDEN));
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(meshData.positions,3));
const query=createMeshHeightQuery(geometry);let meshError=0;
for(const side of [.001,.25,.5,.75,.999])for(let i=1;i<100;i++){
  const x=crossing.x+crossing.w*i/100,z=crossing.y+crossing.d*side,actual=query(x,z);
  assert(actual!==null,'Covered crossing has continuous rendered ribbon');
  meshError=Math.max(meshError,Math.abs(actual-site.routeHeight(x,z)));
}
assert(meshError<.002,'Covered crossing mesh follows its preserved curved approach within2mm');
console.log(JSON.stringify({coveredCrossingMeshSamples:495,meshError}));
