import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const surveys=[undefined];
if(existsSync(new URL('./docs/survey-terrain.js',import.meta.url)))surveys.push(require('./docs/survey-terrain.js').SURVEY_TERRAIN);
for(const survey of surveys){
const {site}=require('./grading-site.js').GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey});
const route=GARDEN.gardenRoutes.find(r=>r.id==='Pond walk'),points=route.points.slice(3);
assert.deepEqual(points[0],[38.7,17.8],'Pond grading starts at the south garden junction');
const profile=site.spec.routeProfiles.find(r=>r.id==='Pond approach');
assert.deepEqual(profile.points[0],points[0]);
assert.equal(profile.startBedding,.02);
assert.equal(profile.bedding,.1);
const fire=GARDEN.elements.find(e=>e.id==='firePit'),apron=fire.parts.find(p=>p.kind==='circle');
const finish=fire.meta.grading.level+fire.meta.grading.surfaceOffset+.008;
assert(Math.abs(site.routeHeight(...points.at(-1))-finish)<1e-9,'Pond approach must meet the fire apron without a step');
let maximumGrade=0,minimumSupport=Infinity;
for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
  for(let s=.01;s<length-.01;s+=.02){
    const x=a[0]+ux*s,z=a[1]+uz*s;
    maximumGrade=Math.max(maximumGrade,Math.abs(site.routeHeight(x+ux*.005,z+uz*.005)-site.routeHeight(x-ux*.005,z-uz*.005))/.01);
    for(const offset of[-.59,0,.59]){
      const px=x-uz*offset,pz=z+ux*offset,support=site.routeHeight(px,pz)-site.height(px,pz);
      minimumSupport=Math.min(minimumSupport,support);
      if(i>1||s>1.8)assert(support>=.095,'Beyond the existing path transition the full bedding depth remains supported');
    }
  }
}
assert(maximumGrade<=.10,`Pond approach exceeds 10% center grade: ${maximumGrade}`);
assert(minimumSupport>=.0199,`Pond route needs continuous bedding from the existing mineral path: ${minimumSupport}`);
for(let x=points[0][0]-1;x<points[0][0];x+=.005)for(const offset of [-.59,0,.59]){
  const z=points[0][1]+offset;
  const grade=Math.abs(site.routeHeight(x+.005,z)-site.routeHeight(x,z))/.005;
  assert(grade<=.10,`Existing path transition exceeds 10%: ${grade}`);
}
assert(Math.hypot(points.at(-1)[0]-apron.cx,points.at(-1)[1]-apron.cy)<apron.r);
for(let i=0;i<128;i++)for(const radius of[.5,.9,1]){
  const p=site.spec.pond,a=i*Math.PI/64,x=p.cx+Math.cos(a)*p.rx*radius,z=p.cz+Math.sin(a)*p.rz*radius;
  assert(site.height(x,z)<=p.edge-p.depth*.5*(1+Math.cos(radius*Math.PI))+1e-7,'Pond approach must not fill the basin');
}
console.log(JSON.stringify({maximumGrade,minimumSupport,fireApronFinish:finish}));
}
