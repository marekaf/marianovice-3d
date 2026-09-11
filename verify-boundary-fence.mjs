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
const gate=boundary.gateModel.dims,start=gate.openingStart,u=gate.direction;
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
