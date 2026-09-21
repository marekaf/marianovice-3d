import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {GradingSurfaceNotation:N}=require('./grading-surface-notation.js');
const garden={plot:{vertices:[[0,0],[6,0],[6,6],[0,6]]},elements:[{id:'house',parts:[{kind:'rect',x:2,y:2,w:2,d:2}]}]};
const site={height:(x,z)=>.3*x+.2*z};
const surface=N.create({garden,site,quantities:{zones:[]}});
assert(surface.contours.length>10&&surface.strokes.length>10);
for(const contour of surface.contours){
  assert(Math.abs(contour.level/.5-Math.round(contour.level/.5))<1e-8);
  for(const p of contour.points){assert(N.eligible(garden,...p));assert(Math.abs(site.height(...p)-contour.level)<1e-8);}
}
for(const stroke of surface.strokes)for(let i=0;i<stroke.points.length;i++){
  assert(N.eligible(garden,...stroke.points[i]));
  if(i)assert(site.height(...stroke.points[i])<site.height(...stroke.points[i-1]));
}
assert(!N.eligible(garden,3,3));
assert(!N.eligible(garden,-1,3));
assert.match(N.svg({surface,px:x=>x*10,pz:z=>z*10}),/data-surface-contour=/);
assert.match(N.svg({surface,px:x=>x*10,pz:z=>z*10}),/data-surface-slope=/);
console.log('Surface notation synthetic plane, exclusion and downhill checks passed.');
const offset=N.create({garden,site,quantities:{zones:[]},datum:.137});
for(const c of offset.contours)assert(Math.abs((c.level-.137)/.5-Math.round((c.level-.137)/.5))<1e-8);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const {SURVEY_TERRAIN}=require('./docs/survey-terrain.js');
const {GradingSite}=require('./grading-site.js'),{GradingZones}=require('./grading-zones.js');
const actual=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey:SURVEY_TERRAIN}).site;
const quantities=GradingZones.create(GARDEN);
const start=performance.now();
const drawing=N.create({garden:GARDEN,site:actual,quantities,datum:TERRAIN.houseFFLInternal});
assert.equal(drawing.contourInterval,.5);
assert(drawing.strokes.length>=60&&drawing.strokes.length<=100,'Site arrows stay sparse enough for the printed map');
let largestResidual=0;
for(const contour of drawing.contours)for(let i=0;i<=10;i++){
  const p=contour.points[0].map((v,axis)=>v+(contour.points[1][axis]-v)*i/10);
  assert(N.eligible(GARDEN,...p));
  const residual=Math.abs(actual.height(...p)-contour.level);
  largestResidual=Math.max(largestResidual,residual);
  assert(residual<=.025,`Actual model contour residual exceeds 25 mm at ${p}`);
}
const rendered=N.svg({surface:drawing,px:x=>x*16,pz:z=>z*16});
assert.equal((rendered.match(/data-surface-slope=/g)??[]).length,drawing.strokes.length,'Every tested sparse arrow is rendered');
assert.equal((rendered.match(/data-surface-contour=/g)??[]).length,drawing.contours.length,'Every tested contour segment is rendered');
const buckets=new Map(),key=(x,z)=>`${Math.floor(x/2)},${Math.floor(z/2)}`;
for(const line of [...drawing.contours,...drawing.strokes])for(const p of line.points){
  assert(N.eligible(GARDEN,...p));
  const k=key(...p);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(p);
}
for(const stroke of drawing.strokes)for(let i=1;i<stroke.points.length;i++)assert(actual.height(...stroke.points[i])<actual.height(...stroke.points[i-1]),'actual strokes descend at every trace step');
const covered=(x,z)=>{
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const p of buckets.get(key(x+dx*2,z+dz*2))??[])if(Math.hypot(p[0]-x,p[1]-z)<=2)return true;
  return false;
};
let probes=0;const misses=[];
function probe(x,z){
  if(!N.eligible(GARDEN,x,z))return;
  const d=.018,h=actual.height(x,z),differences=[];
  for(const [dx,dz] of [[d,0],[-d,0],[0,d],[0,-d]])if(N.eligible(GARDEN,x+dx,z+dz))differences.push(Math.abs(actual.height(x+dx,z+dz)-h)/d);
  if(Math.max(...differences)<.0055)return;
  probes++;if(!covered(x,z))misses.push([x,z]);
}
for(let x=-2.123;x<43.75;x+=.29)for(let z=-.763;z<34.38;z+=.29)probe(x,z);
const plot=GARDEN.plot.vertices;
for(let i=0;i<plot.length;i++){
  const a=plot[i],b=plot[(i+1)%plot.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  for(let distance=.13;distance<length;distance+=.29){
    const x=a[0]+dx*distance/length,z=a[1]+dz*distance/length;
    for(const inset of [.04,.13,.28]){probe(x-dz/length*inset,z+dx/length*inset);probe(x+dz/length*inset,z-dx/length*inset);}
  }
}
assert.equal(misses.length,0,`Sloped outdoors missing notation within 2 m: ${JSON.stringify(misses.slice(0,10))}`);
for(const id of ['C','E','G','H','I','J','L','N','O','P'])assert(drawing.strokes.some(s=>s.zone===id),`Outdoor zone ${id} receives measured slope notation`);
for(const id of ['A','B','D','F','K','M'])assert(!drawing.strokes.some(s=>s.zone===id),`Finished or building zone ${id} is excluded`);
console.log(`Actual site: ${drawing.contours.length} contour segments, ${drawing.strokes.length} rendered arrows, ${probes} independent slope probes covered within 2 m, maximum contour residual ${(largestResidual*1000).toFixed(1)} mm; ${((performance.now()-start)/1000).toFixed(2)} s.`);
