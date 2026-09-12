import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {runPythonJson} from './scripts/python-json.mjs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js'),{GradingSite}=require('./grading-site.js');
const survey=existsSync('docs/survey-terrain.js')?require('./docs/survey-terrain.js').SURVEY_TERRAIN:undefined;
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey});
const garage=GARDEN.elements.find(e=>e.id==='garage').parts.find(p=>p.kind==='rect');
const checks=[];let maximumSlope=0;
for(let ix=0;ix<=80;ix++)for(let iz=0;iz<=96;iz++){
  const x=garage.x+garage.w-.5+ix*.025,z=garage.y-.8+iz*.025;
  const value=site.height(x,z),gradient=Math.hypot(site.height(x+.01,z)-site.height(x-.01,z),site.height(x,z+.01)-site.height(x,z-.01))/.02;
  maximumSlope=Math.max(maximumSlope,gradient);
  assert(gradient<=.5,`Garage corner earth bank exceeds50% at ${x},${z}: ${gradient}`);
  for(const [dx,dz]of[[1e-7,0],[0,1e-7]])assert(Math.abs(site.height(x+dx,z+dz)-value)<1e-6,'Garage bank has no height discontinuity');
  checks.push([x,z]);
}
for(let iz=0;iz<=20;iz++){
  const z=garage.y-.1+iz*.025;let previous=Infinity;
  for(let ix=0;ix<=20;ix++){
    const x=garage.x+garage.w+ix*.025,value=site.height(x,z);
    assert(value<=previous+1e-9,'East garage bank descends without a new ridge');previous=value;
  }
}
for(let ix=0;ix<=12;ix++)for(let iz=0;iz<=12;iz++){
  const x=garage.x+garage.w*ix/12,z=garage.y+garage.d*iz/12;
  assert(Math.abs(site.height(x,z)-site.spec.drivewayProfile.startLevel)<1e-9,'Garage footprint keeps its existing flat datum');checks.push([x,z]);
}
for(const segment of site.spec.fixedFences?.segments??[])for(let i=0;i<=40;i++){
  const x=segment.start[0]+(segment.end[0]-segment.start[0])*i/40,z=segment.start[1]+(segment.end[1]-segment.start[1])*i/40;
  assert(Math.abs(site.height(x,z)-site.baseHeight(x,z))<1e-9,'Built fence ground stays fixed');checks.push([x,z]);
}
const result=runPythonJson('import json,sys; from blender.site_terrain import height; data=json.load(sys.stdin); print(json.dumps([height(data["spec"],x,z) for x,z in data["points"]]))',{spec:site.spec,points:checks});
for(let i=0;i<checks.length;i++)assert(Math.abs(result[i]-site.height(...checks[i]))<1e-9,'Garage bank matches in browser and Blender');
console.log(JSON.stringify({maximumSlope,paritySamples:checks.length}));
