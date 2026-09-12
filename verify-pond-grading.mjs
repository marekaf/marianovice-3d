import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {runPythonJson} from './scripts/python-json.mjs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const {GradingSite}=require('./grading-site.js');
const survey=existsSync('docs/survey-terrain.js')?require('./docs/survey-terrain.js').SURVEY_TERRAIN:{points:[[-10,-10,4],[60,-10,1],[60,50,2],[-10,50,5]]};
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey});
const level=site.spec.drivewayProfile.startLevel,pond=site.spec.pond;
const route=GARDEN.gardenRoutes.find(r=>r.id==='Pond walk');
const routeDistance=(x,z)=>Math.min(...route.points.slice(1).map((b,i)=>{
  const a=route.points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}));
let samples=0;
const points=[];
for(let x=30;x<=34.13;x+=.05)for(let z=12;z<=16;z+=.05){
  if(routeDistance(x,z)<route.width/2+.2)continue;
  assert(Math.abs(site.height(x,z)-level)<1e-8,`Pond bank must leave C level at ${x}, ${z}`);
  samples++;
  points.push([x,z]);
}
for(let x=31.7;x<=34.13;x+=.05)for(let z=10.75;z<=11.85;z+=.05)assert(Math.abs(site.routeHeight(x,z)-(level+.04))<1e-8,'Pond approach reaches C at the common finished level');
for(let i=0;i<720;i++){
  const angle=i*Math.PI/360,x=pond.cx+pond.rx*Math.cos(angle),z=pond.cz+pond.rz*Math.sin(angle);
  assert(Math.abs(site.height(x,z)-level)<1e-8,'Complete pond rim meets proposed filled ground');
  points.push([x,z]);
}
assert(Math.abs(site.height(pond.cx,pond.cz)-(level-pond.depth))<1e-8,'Pond keeps its basin depth');
assert.deepEqual([pond.cx,pond.cz,pond.rx,pond.rz],[35.6,14,1.2,.8],'Pond footprint remains fixed');
for(let x=33.9;x<=39;x+=.025)for(const z of [11.3,17.21,17.8,18.39])points.push([x,z]);
const heights=runPythonJson('import json,sys; from blender.site_terrain import height; d=json.load(sys.stdin); print(json.dumps([height(d["spec"],*p) for p in d["points"]]))',{spec:site.spec,points});
points.forEach((p,i)=>assert(Math.abs(heights[i]-site.height(...p))<1e-10,'Pond and C agree in both terrain renderers'));
console.log(`Pond grading: ${samples} C samples level, complete rim supported and basin footprint preserved`);
