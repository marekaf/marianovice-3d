import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js');
const {GateModel}=require('./gate-model.js');
const {drivewayStudy,renderDrivewayCheckSVG}=require('./drivewaycheck.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const study=drivewayStudy(GARDEN);
assert.equal(study.gate.dims.wicketOpening,1);
near(Math.hypot(...study.wicketStart.map((v,i)=>v-study.wicketEnd[i])),1);
const gateLine=GARDEN.elements.find(e=>e.id==='gate').parts.find(p=>p.kind==='line');
const driveway=GARDEN.elements.find(e=>e.id==='driveway'),outline=driveway.parts.find(p=>p.kind==='polygon').points;
const {apron}=driveway.meta;
assert.equal(apron.d,4);
for(const end of [[gateLine.x1,gateLine.y1],[gateLine.x2,gateLine.y2]])assert(outline.some(p=>Math.hypot(p[0]-end[0],p[1]-end[1])<1e-8),'Paving ends at the actual gate opening');
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const samePoint=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8;
const edgeExists=(a,b)=>outline.some((p,i)=>samePoint(p,a)&&samePoint(outline[(i+1)%outline.length],b));
assert(edgeExists([apron.x+apron.w,apron.y],[gateLine.x1,gateLine.y1]),"North driveway edge connects directly from garage frontage to gate");
assert(edgeExists([gateLine.x2,gateLine.y2],[apron.x+apron.w,apron.y+apron.d]),"South driveway edge connects directly from gate to apron");
near(Math.hypot(gateLine.x2-gateLine.x1,gateLine.y2-gateLine.y1),4);
for(const p of outline){
  let inside=false,boundaryDistance=Infinity;
  for(let i=0;i<GARDEN.plot.vertices.length;i++){
    const a=GARDEN.plot.vertices[i],b=GARDEN.plot.vertices[(i+1)%GARDEN.plot.vertices.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
    boundaryDistance=Math.min(boundaryDistance,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<a[0]+dx*(p[1]-a[1])/dy)inside=!inside;
  }
  assert(inside||boundaryDistance<1e-7,'Driveway stays within the plot');
}
const {GradingZones}=require('./grading-zones.js'),garage=GARDEN.elements.find(e=>e.id==='garage').parts[0];
const garagePolygon=[[garage.x,garage.y],[garage.x+garage.w,garage.y],[garage.x+garage.w,garage.y+garage.d],[garage.x,garage.y+garage.d]];
const overlap=GradingZones.triangles(outline).reduce((sum,triangle)=>sum+GradingZones.area(GradingZones.split(triangle,garagePolygon).inside),0);
assert(overlap<1e-7,'Paving does not overlap the garage footprint');
console.log("Driveway: direct straight edges, four-metre gate and apron, clear plot and garage boundaries");
const model=GateModel.build({openingStart:[gateLine.x1,gateLine.y1],direction:[gateLine.x2-gateLine.x1,gateLine.y2-gateLine.y1]});
assert.deepEqual(study.wicketHinge,model.dims.wicketHinge);
const outer=model.parts.find(p=>p.name==='gate_post_2');
const project=p=>(p[0]-gateLine.x1)*model.dims.direction[0]+(p[1]-gateLine.y1)*model.dims.direction[1];
near(project(study.wicketEnd),Math.min(...outer.vertices.map(project)));
const alternate=structuredClone(GARDEN);
const moved=alternate.elements.find(e=>e.id==='gate').parts.find(p=>p.kind==='line');
for(const key of ['x1','x2'])moved[key]+=2;
for(const key of ['y1','y2'])moved[key]-=3;
alternate.elements.find(e=>e.id==='carport').parts.find(p=>p.kind==='rect').w+=.5;
alternate.vehicles.find(v=>v.bay==='carport').w+=.2;
const changed=drivewayStudy(alternate);
near(changed.wicketStart[0],study.wicketStart[0]+2);
near(changed.wicketEnd[1],study.wicketEnd[1]-3);
near(changed.bays.carport.rect.w,study.bays.carport.rect.w+.5);
near(changed.bays.carport.gaps[0],study.bays.carport.gaps[0]-.1);
const svg=renderDrivewayCheckSVG(GARDEN);
assert.match(svg,/branka 1\.0 m/);
assert.match(svg,/Bez simulace vlečných křivek vozidel/);
assert.doesNotMatch(svg,/wicket 0\.9|Every car reverses|both fit|Drive in and out forward|one-sweep turn fits/);
assert.equal(readFileSync(new URL('./zahrada-driveway-check.svg',import.meta.url),'utf8'),svg);
console.log('Driveway study: shared gate geometry, derived bay clearances and generated SVG verified.');
const validator=readFileSync(new URL('./validate-layout.js',import.meta.url),'utf8');
function validateFootprint(points){
  let exitCode;
  const garden={plot:{vertices:[[0,0],[10,0],[10,10],[0,10]]},elements:[{id:'driveway',parts:[{kind:'polygon',points}]}]};
  vm.runInNewContext(validator,{__dirname:'.',require:id=>id==='./layout.js'?{GARDEN:garden}:id==='fs'?{readFileSync:()=>''}:require(id),console:{log(){}},process:{exit:code=>{exitCode=code;}}});
  return exitCode;
}
assert.equal(validateFootprint([[6,2],[10,2],[10,6],[6,6]]),0,'Paving may terminate on the parcel boundary at a gate');
assert.equal(validateFootprint([[6,2],[10.001,2],[10.001,6],[6,6]]),1,'Paving one millimetre outside the parcel must still fail');
console.log('Layout boundary validation: exact gate contact accepted, one-millimetre escape rejected');
