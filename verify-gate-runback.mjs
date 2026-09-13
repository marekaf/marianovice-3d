import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url),{GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js'),{GradingSite}=require('./grading-site.js'),{FENCE_SURVEY}=require('./docs/fence-survey.js'),{GateRunbackModel}=require('./gate-runback-model.js');
const survey=fs.existsSync(new URL('./docs/survey-terrain.js',import.meta.url))?require('./docs/survey-terrain.js').SURVEY_TERRAIN:undefined;
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey}),strip=site.spec.gateRunback;
const [a,b]=[FENCE_SURVEY.segments[1].start,FENCE_SURVEY.segments[1].end],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
const inward=p=>-(dx*(p[1]-a[1])-dz*(p[0]-a[0]))/length;
for(const point of strip.points)assert(inward(point)>=.06-1e-9,'Runback support must stay inside the measured east fence');
const model=GateRunbackModel.build(strip,site.baseHeight);
for(const part of model.parts)for(const point of part.vertices){assert(point.every(Number.isFinite));assert(inward(point)>=.059,'Concrete and gravel must not project through the measured fence');}
const surface=model.parts.find(part=>part.name==='gate-runback-gravel');
for(const point of surface.vertices.slice(strip.points.length))assert.equal(point[2],strip.finishedLevel);
assert.equal(strip.width,.8);assert.equal(strip.from,-5.8);assert.equal(strip.to,.2);
console.log('Gate runback: level gravel and retained support remain inside the measured fence');
