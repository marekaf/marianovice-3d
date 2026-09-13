import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js');
const {TERRAIN}=require('./terrain.js');
const {SurveySurface}=require('./survey-surface.js');
const {BoundaryFenceModel}=require('./boundary-fence-model.js');
const {compileFenceSurvey}=require('./generate-fence-survey.js');
const {FENCE_SURVEY}=require('./docs/fence-survey.js');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
if(fs.existsSync('../marianovice/project/site-geometry.json')){
  const raw=fs.readFileSync('../marianovice/project/site-geometry.json');
  assert.equal(digest(raw),FENCE_SURVEY.source.sha256);
  assert.deepEqual(compileFenceSurvey(JSON.parse(raw),digest(raw)).segments,FENCE_SURVEY.segments);
}
assert.equal(FENCE_SURVEY.segments.length,14);
assert.equal(FENCE_SURVEY.excludedSegments.length,1);
const existing=SurveySurface.create(require('./docs/survey-terrain.js').SURVEY_TERRAIN.points,TERRAIN.plane).height;
let boundary=BoundaryFenceModel.build({garden:GARDEN,survey:FENCE_SURVEY,heightAt:existing});
assert.deepEqual(boundary.segments.filter(s=>s.measured).map(({sourceIndex,start,end})=>({sourceIndex,start,end})),FENCE_SURVEY.segments);
assert.equal(boundary.gateModel.dims.opening,4);
const closure=boundary.segments.find(s=>!s.measured&&Math.hypot(s.end[0]-s.start[0],s.end[1]-s.start[1])<1);
assert.deepEqual(closure.start,FENCE_SURVEY.segments[0].end,'Gate closure continues from the end of the measured stub');
const closureModel=boundary.models[boundary.segments.indexOf(closure)];
assert(!closureModel.parts.some(part=>part.type==='cylinder'),'Measured corner and gate post already support the closure');
assert(boundary.gateModel.dims.railOffset>.18,'Moving gate clears the existing east fence');
const {GateModel}=require('./gate-model.js');
const {direction:gateDirection,openingStart:gateOrigin,railOffset}=boundary.gateModel.dims;
const moving=GateModel.build({openingStart:gateOrigin,direction:gateDirection,railOffset,open:0}).parts.filter(p=>p.category==='sliding');
const envelopes=moving.map(part=>{
  if(part.type==='beam')return {points:[part.start,part.end],radius:Math.hypot(part.width,part.depth)/2};
  if(part.vertices)return {points:part.vertices,radius:0};
  const points=part.groups.flatMap(group=>group.positions.flatMap(position=>group.vertices.map(vertex=>vertex.map((v,i)=>v+position[i]))));
  const local=points.map(p=>[(p[0]-gateOrigin[0])*gateDirection[0]+(p[1]-gateOrigin[1])*gateDirection[1],-(p[0]-gateOrigin[0])*gateDirection[1]+(p[1]-gateOrigin[1])*gateDirection[0]]);
  const limits=[0,1].map(i=>local.reduce(([min,max],p)=>[Math.min(min,p[i]),Math.max(max,p[i])],[Infinity,-Infinity]));
  return {points:limits[0].flatMap(x=>limits[1].map(y=>[gateOrigin[0]+gateDirection[0]*x-gateDirection[1]*y,gateOrigin[1]+gateDirection[1]*x+gateDirection[0]*y])),radius:0};
});
let minimumGateGap=Infinity;
for(let step=0;step<=100;step++)for(const envelope of envelopes)for(const point of envelope.points){
  const p=point.slice(0,2).map((v,i)=>v-4.1*step/100*gateDirection[i]);
  for(const {start:a,end:b} of FENCE_SURVEY.segments){
    const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
    minimumGateGap=Math.min(minimumGateGap,Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)-envelope.radius-.025);
  }
}
assert(minimumGateGap>=.05,`Moving leaf and tail require 50mm from built fence: ${minimumGateGap}`);
console.log(JSON.stringify({railOffset,minimumGateGap,gateStates:101}));
const westEnd=FENCE_SURVEY.segments.at(-1).end;
const southSpan=boundary.segments.find(s=>!s.measured&&Math.hypot(s.end[0]-s.start[0],s.end[1]-s.start[1])>20);
assert.deepEqual(southSpan.end,westEnd,'South fence joins the measured west endpoint without a cadastral dogleg');
const cornerPosts=boundary.models.flatMap(model=>model.parts.filter(part=>part.type==='cylinder')).filter(part=>Math.hypot(part.position[0]-westEnd[0],part.position[1]-westEnd[1])<.5);
assert.equal(cornerPosts.length,1,'The southwest junction has one shared corner post');
const gate=boundary.gateModel.dims,start=gate.openingStart,u=gate.direction;
const afterWicket=start.map((v,i)=>v+u[i]*5.35);
assert(!boundary.segments.some(s=>Math.hypot(s.start[0]-afterWicket[0],s.start[1]-afterWicket[1])<1e-7),'The cabinet-facing gap beyond the wicket remains free of added wire panels');
for(const s of boundary.segments){
  const p=s.start,q=s.end;
  for(let i=0;i<=100;i++){
    const x=p[0]+(q[0]-p[0])*i/100-start[0],z=p[1]+(q[1]-p[1])*i/100-start[1];
    const along=x*u[0]+z*u[1],across=-x*u[1]+z*u[0];
    assert.ok(!(along>.001&&along<3.999&&Math.abs(across)<.1),'Fence crosses vehicle opening');
  }
}
for(const m of boundary.models)for(const p of m.parts.filter(p=>p.type==='cylinder'))assert.ok(Math.abs(p.position[2]+p.height/2-existing(...p.position.slice(0,2))-2)<1e-9);
for(const model of boundary.models)for(const part of model.parts)assert.ok(!/\.\d{10,}$/.test(part.name),'Blender numeric name suffix exceeds integer range');
const before=digest(JSON.stringify(boundary.models));
boundary=null;
const changed=structuredClone(GARDEN);
for(const e of changed.elements)if(e.id!=='gate'){
  e.elevation=100;
  if(e.meta)e.meta={...e.meta,groundElevation:100,deckTop:100};
}
const after=BoundaryFenceModel.build({garden:changed,survey:FENCE_SURVEY,heightAt:existing});
assert.equal(digest(JSON.stringify(after.models)),before,'Landscape grading changes fixed fence coordinates');
if(fs.existsSync('../marianovice/project/site-geometry.json'))assert.equal(digest(fs.readFileSync('../marianovice/project/site-geometry.json')),FENCE_SURVEY.source.sha256);
for(const path of ['index.html','generate-blender-json.js'])assert.match(fs.readFileSync(path,'utf8'),/BoundaryFenceModel\.build\(\{[^}]*heightAt:\s*existingGround/);
console.log('Boundary fence: measured coordinates, fixed survey bases, nominal tops, grading independence, open 4 m gate and unchanged source hash passed');
