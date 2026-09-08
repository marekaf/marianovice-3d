import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const {GradingSite}=require('./grading-site.js'),{SiteTerrain}=require('./site-terrain.js');
const survey=existsSync('docs/survey-terrain.js')?require('./docs/survey-terrain.js').SURVEY_TERRAIN:{points:[[-10,-10,4],[60,-10,1],[60,50,2],[-10,50,5]]};
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey});
const previous=structuredClone(site.spec);
previous.cutRects[0].blend=2.2;
Object.assign(previous.postCuts[1],{z1:28.5,blend:1.2});
Object.assign(previous.postCuts[2],{z1:29.5,blend:1.5});
previous.routeProfiles.forEach(route=>{delete route.bankBlend;delete route.bankApron;});
const old=(x,z)=>SiteTerrain.height(previous,x,z);
for(const pad of [...site.spec.finishPads,...site.spec.protectedPads])for(let i=0;i<=4;i++)for(let j=0;j<=4;j++) {
  const x=pad.x0+(pad.x1-pad.x0)*i/4,z=pad.z0+(pad.z1-pad.z0)*j/4;
  assert(Math.abs(site.height(x,z)-old(x,z))<1e-9,'Platform cores must retain their existing ground levels');
}
for(let i=0;i<GARDEN.plot.vertices.length;i++)for(let j=0;j<=200;j++) {
  const a=GARDEN.plot.vertices[i],b=GARDEN.plot.vertices[(i+1)%GARDEN.plot.vertices.length],t=j/200;
  const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
  assert(Math.abs(site.height(x,z)-old(x,z))<1e-9,'Do not transfer grading changes to the boundary');
}
for(let x=10.48;x<=21.28;x+=.2)for(let z=26.43;z<=27.43;z+=.2)assert(Math.abs(site.height(x,z)-old(x,z))<1e-9,'Keep the southern one-metre strip');
function maximum(fn,[x0,x1,z0,z1]) {
  let max=0;
  for(let x=x0;x<=x1;x+=.1)for(let z=z0;z<=z1;z+=.1)max=Math.max(max,Math.hypot(fn(x+.02,z)-fn(x-.02,z),fn(x,z+.02)-fn(x,z-.02))/.04);
  return max*100;
}
const measurements=[['south',[4,23,25,31.5]],['southwest',[4,9,18,29]],['east shoulder',[20,23,27.43,31.5]],['gathering shoulder',[29,35,8,13]]].map(([name,bounds])=>({name,before:maximum(old,bounds),after:maximum(site.height,bounds)}));
if(existsSync('docs/survey-terrain.js'))for(const value of measurements)assert(value.after<value.before,`${value.name} must improve without shifting levels`);
assert(site.spec.bankReview.some(r=>r.id==='productive-west'));
console.log(JSON.stringify({platforms:'unchanged',boundaries:'unchanged',measurements}));
