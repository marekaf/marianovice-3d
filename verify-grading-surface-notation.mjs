import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {GradingSurfaceNotation:N}=require('./grading-surface-notation.js');
const garden={plot:{vertices:[[0,0],[6,0],[6,6],[0,6]]},elements:[],gradingBanks:[{id:'test',points:[[0,1],[6,1],[6,3],[0,3]],spotCrest:[3,3],spotFoot:[3,1],width:2}]};
const site={height:(x,z)=>Math.max(0,Math.min(2,z-1))*.4,baseHeight:()=>0};
const surface=N.create({garden,site});
assert.equal(surface.contours.length,0);
assert.equal(surface.strokes.length,12);
assert(surface.strokes.some(s=>s.short)&&surface.strokes.some(s=>!s.short));
const length=s=>Math.hypot(s.points[1][0]-s.points[0][0],s.points[1][1]-s.points[0][1]);
assert(surface.strokes.filter(s=>!s.short).every(s=>length(s)>1.8));
assert(surface.strokes.filter(s=>s.short).every(s=>length(s)<.9));
for(let i=1;i<surface.strokes.length;i++)assert(Math.abs(Math.abs(surface.strokes[i].points[0][0]-surface.strokes[i-1].points[0][0])-.5)<1e-8,'Comb stations have regular spacing');
assert(surface.strokes.every(s=>s.points[0][1]>2.9));
assert.equal(N.create({garden:{...garden,gradingBanks:[]},site:{height:(x,z)=>.4*z,baseHeight:(x,z)=>.4*z}}).strokes.length,0,'Unmodified natural terrain has no invented bank field');
function padFixture(shift){
  const p={kind:'rect',x:2+shift,y:3,w:2,d:2};
  const garden={plot:{vertices:[[-10,-10],[20,-10],[20,20],[-10,20]]},elements:[{id:'raisedBedsPad',parts:[p]}]};
  const site={baseHeight:()=>0,height:(x,z)=>Math.max(0,1-.5*Math.hypot(Math.max(p.x-x,0,x-p.x-p.w),Math.max(p.y-z,0,z-p.y-p.d)))};
  return N.create({garden,site});
}
const original=padFixture(0),moved=padFixture(4);
assert(original.strokes.length>10);
assert.equal(moved.strokes.length,original.strokes.length);
for(let i=0;i<original.strokes.length;i++)for(let j=0;j<2;j++)assert(Math.hypot(moved.strokes[i].points[j][0]-original.strokes[i].points[j][0]-4,moved.strokes[i].points[j][1]-original.strokes[i].points[j][1])<.051,'Moving the source pad moves its bank notation within the 5 cm sampling interval');
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js'),{SURVEY_TERRAIN}=require('./docs/survey-terrain.js');
const {GradingSite}=require('./grading-site.js'),{GradingZones}=require('./grading-zones.js');
const actual=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey:SURVEY_TERRAIN}).site;
const start=performance.now(),drawing=N.create({garden:GARDEN,site:actual,quantities:GradingZones.create(GARDEN)});
for(const id of ['boundary-north','boundary-east','pergola-north','terrace-0','terrace-1','drainage-0-3','south-facade-2','raisedBedsPad-1','raisedBedsPad-3'])assert(drawing.regions.find(r=>r.id===id)?.strokeCount>0,`${id} has actual rendered cross-sections`);
for(const source of ['greenhouse','sauna','saunaShelter','saunaPath','heatPumpService','north-facade','drivewayProfile','drivewayApron','benchPad','gateRunback','wicketLanding','firePit','Daily dining','Gathering connection','Pond approach','Productive access','Bed access','Greenhouse access'])assert(drawing.regions.some(r=>r.source===source),`${source} is assessed from its model geometry`);
assert(drawing.regions.filter(r=>r.source==='drivewayProfile').some(r=>r.strokeCount>0),'Southern driveway bank is represented');
for(const s of drawing.strokes){
  assert.equal(s.points.length,2,'Every bank stroke is a straight section');
  assert(drawing.regions.some(r=>r.id===s.region),'No unanchored fallback marks');
  let previous=Infinity;
  for(let i=0;i<=20;i++){
    const p=s.points[0].map((v,k)=>v+(s.points[1][k]-v)*i/20),h=actual.height(...p);
    assert(N.eligible(GARDEN,...p),'Sections avoid buildings and hardscape');
    assert(h<=previous+.02,'Actual section descends with at most 2 cm interpolation noise');previous=h;
  }
}
const landing=GARDEN.elements.find(e=>e.id==='saunaPath').parts.find(p=>p.kind==='rect');
assert(!N.eligible(GARDEN,landing.x+landing.w/2,landing.y+landing.d/2),'Sauna landing is a finished surface');
assert(drawing.strokes.filter(s=>s.source==='firePit').length>=3,'Actual firepit shoulders are grouped across the full feature');
for(const s of drawing.strokes.filter(s=>s.region==='pergola-north'))for(const p of s.points){
  for(const fence of actual.spec.fixedFences.segments){
    const [a,b]=[fence.start,fence.end];
    if(Math.abs(b[0]-a[0])<.001||p[0]<Math.min(a[0],b[0])||p[0]>Math.max(a[0],b[0]))continue;
    const z=a[1]+(p[0]-a[0])/(b[0]-a[0])*(b[1]-a[1]);
    if(z<actual.spec.gatheringPads[0].z0)assert(p[1]>=z-1e-8,'Northern pergola bank stops at the measured fence');
  }
}
const svg=N.svg({surface:drawing,px:x=>x*16,pz:z=>z*16});
assert.equal((svg.match(/data-surface-slope=/g)??[]).length,drawing.strokes.length);
assert.match(svg,/data-bank-hachure="terrain"/);
assert(!/data-surface-contour|NaN|Infinity/.test(svg));
console.log(`Feature banks: ${drawing.strokes.length} straight hatches from ${drawing.regions.length} assessed strips; source movement, natural-ground exclusion, catalog coverage and downhill checks passed in ${((performance.now()-start)/1000).toFixed(2)} s.`);
