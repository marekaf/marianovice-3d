import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {GradingSurfaceNotation:N}=require('./grading-surface-notation.js');
const garden={plot:{vertices:[[0,0],[6,0],[6,6],[0,6]]},elements:[{id:'house',parts:[{kind:'rect',x:2,y:4,w:2,d:1}]}]};
const site={height:(x,z)=>Math.max(0,Math.min(2,z-1))*.4};
const surface=N.create({garden,site,quantities:{zones:[]}});
assert.equal(surface.contours.length,0);
assert(surface.strokes.length>10);
assert(surface.strokes.some(s=>s.short)&&surface.strokes.some(s=>!s.short));
const length=s=>s.points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-s.points[i][0],p[1]-s.points[i][1]),0);
assert(surface.strokes.some(s=>!s.short&&length(s)>1.8),'Long bank strokes span crest to foot');
assert(surface.strokes.filter(s=>s.short).every(s=>length(s)<1),'Short strokes use less than half the bank width');
assert(surface.strokes.every(s=>s.points[0][1]>2.9),'Comb teeth attach to the uphill shoulder');
function checkGeometry(drawing,garden,site){
  const segments=new Map();
  for(const stroke of drawing.strokes)for(let i=0;i<stroke.points.length;i++){
    assert(N.eligible(garden,...stroke.points[i]));
    if(i){
      assert(site.height(...stroke.points[i])<site.height(...stroke.points[i-1]));
      const a=stroke.points[i-1],b=stroke.points[i],rx=b[0]-a[0],ry=b[1]-a[1];
      for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const entry of segments.get(`${Math.floor(a[0]/.5)+dx},${Math.floor(a[1]/.5)+dz}`)??[]){
        if(entry.stroke===stroke)continue;
        const [c,d]=entry.points,sx=d[0]-c[0],sy=d[1]-c[1],cross=rx*sy-ry*sx;
        if(Math.abs(cross)<1e-12)continue;
        const t=((c[0]-a[0])*sy-(c[1]-a[1])*sx)/cross,u=((c[0]-a[0])*ry-(c[1]-a[1])*rx)/cross;
        assert(!(t>1e-7&&t<1-1e-7&&u>1e-7&&u<1-1e-7),'Different downhill hachures do not cross');
      }
      const key=`${Math.floor(a[0]/.5)},${Math.floor(a[1]/.5)}`;
      if(!segments.has(key))segments.set(key,[]);segments.get(key).push({points:[a,b],stroke});
    }
  }
  const svg=N.svg({surface:drawing,px:x=>x*16,pz:z=>z*16});
  assert.match(svg,/data-bank-hachure="terrain"/);
  assert(!svg.includes('data-surface-contour'));
  assert.equal((svg.match(/data-surface-slope=/g)??[]).length,drawing.strokes.length);
  assert(!/NaN|Infinity/.test(svg));
}
checkGeometry(surface,garden,site);
assert(!N.eligible(garden,3,4.5));
assert(!N.eligible(garden,-1,3));
assert.equal(N.create({garden,site:{height:()=>0}}).strokes.length,0,'Flat ground stays unhatched');
const longPlane=N.create({garden:{plot:{vertices:[[0,0],[3,0],[3,24],[0,24]]},elements:[]},site:{height:(x,z)=>z*.4}});
assert(longPlane.strokes.some(s=>length(s)>9.9),'Constant-plane fixture reaches the trace limit');
for(const edge of longPlane.edges){
  if(edge.kind==='toe')assert(edge.points.every(p=>p[1]<.1),'A capped trace cannot fabricate a toe line inside a constant slope');
  if(edge.kind==='crest')assert(edge.points.every(p=>p[1]>23.9),'Coverage seeds cannot fabricate a crest inside a constant slope');
}
console.log('Bank notation: attached long/short combs, downhill direction and masked geometry passed.');
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js'),{SURVEY_TERRAIN}=require('./docs/survey-terrain.js');
const {GradingSite}=require('./grading-site.js'),{GradingZones}=require('./grading-zones.js');
const actual=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey:SURVEY_TERRAIN}).site;
const quantities=GradingZones.create(GARDEN),start=performance.now();
const drawing=N.create({garden:GARDEN,site:actual,quantities,datum:TERRAIN.houseFFLInternal});
checkGeometry(drawing,GARDEN,actual);
const falseToe=[8.039734673636687,17.2552884482572];
assert(!drawing.edges.some(e=>e.kind==='toe'&&e.points.some(p=>Math.hypot(p[0]-falseToe[0],p[1]-falseToe[1])<1e-7)),'The known capped trace endpoint is not rendered as a toe');
for(const edge of drawing.edges)for(const point of edge.points){
  assert(drawing.strokes.some(s=>(edge.kind==='toe'?s.toe:s.points[0])===point&&['low-gradient','boundary'].includes(s[`${edge.kind}Termination`])),'Every edge endpoint retains genuine slope-break or boundary provenance');
}
const buckets=new Map(),key=(x,z)=>`${Math.floor(x)},${Math.floor(z)}`;
for(const line of drawing.strokes)for(const p of line.points){const k=key(...p);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(p);}
const covered=(x,z)=>{
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const p of buckets.get(key(x+dx,z+dz))??[])if(Math.hypot(p[0]-x,p[1]-z)<=1)return true;
  return false;
};
let probes=0;const misses=[];
function probe(x,z){
  if(!N.eligible(GARDEN,x,z))return;
  const d=.018,h=actual.height(x,z),differences=[];
  for(const [dx,dz] of [[d,0],[-d,0],[0,d],[0,-d]])if(N.eligible(GARDEN,x+dx,z+dz))differences.push(Math.abs(actual.height(x+dx,z+dz)-h)/d);
  if(Math.max(...differences)<.085)return;
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
assert.equal(misses.length,0,`Significant bank probes missing hatching within 1 m: ${JSON.stringify(misses.slice(0,15))}`);
for(const id of ['A','B','D','F','K','M'])assert(!drawing.strokes.some(s=>s.zone===id),`Finished or building zone ${id} is excluded`);
console.log(`Actual banks: ${drawing.strokes.length} hatches, ${probes} independent bank probes covered within 1 m; ${((performance.now()-start)/1000).toFixed(2)} s; zones ${[...new Set(drawing.strokes.map(s=>s.zone))].sort().join(',')}.`);
