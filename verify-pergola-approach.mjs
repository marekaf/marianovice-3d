import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const {GradingSite}=require('./grading-site.js');
const survey=existsSync(new URL('./docs/survey-terrain.js',import.meta.url))?require('./docs/survey-terrain.js').SURVEY_TERRAIN:undefined;
const {site}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey});
const route=GARDEN.gardenRoutes.find(r=>r.id==='Daily dining');
const length=route.points.slice(1).reduce((sum,b,i)=>sum+Math.hypot(b[0]-route.points[i][0],b[1]-route.points[i][1]),0);
assert(length>10,'Dining approach needs enough length for the retained 750 mm fall');
let maxGrade=0,maxEdgeGrade=0,maxCrossfall=0;
for(let i=1;i<route.points.length;i++) {
  const a=route.points[i-1],b=route.points[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/l,uz=(b[1]-a[1])/l;
  for(let s=.01;s<l-.01;s+=.02)for(const offset of[-.59,-.4,-.2,0,.2,.4,.59]){
    const x=a[0]+ux*s-uz*offset,z=a[1]+uz*s+ux*offset;
    const grade=Math.abs(site.routeHeight(x+ux*.005,z+uz*.005)-site.routeHeight(x-ux*.005,z-uz*.005))/.01;
    if(offset===0)maxGrade=Math.max(maxGrade,grade);
    maxEdgeGrade=Math.max(maxEdgeGrade,grade);
    maxCrossfall=Math.max(maxCrossfall,Math.abs(site.routeHeight(x-uz*.005,z+ux*.005)-site.routeHeight(x+uz*.005,z-ux*.005))/.01);
    assert(site.routeHeight(x,z)-site.height(x,z)>=.095,'Walking ribbon has continuous support below its finish');
  }
}
assert(maxGrade<=.10,'Approach centerline stays at or below 10% sampled longitudinal grade');
assert(maxEdgeGrade<=.14,'Inner bend stays below the provisional 14% sampled edge-grade limit');
assert(maxCrossfall<=.075,'The turn does not introduce a sharp transverse ridge');
assert.equal(site.routeHeight(...route.points[0]),2.465);
assert.equal(site.routeHeight(...route.points.at(-1)),1.715);
for(let z=11.58;z<=12.59;z+=.02)assert(Math.abs(site.routeHeight(23.58,z)-2.465)<1e-9,'Entire terrace joining edge remains level');
const end=route.points.at(-1),previous=route.points.at(-2),lastLength=Math.hypot(end[0]-previous[0],end[1]-previous[1]);
const paving=GARDEN.elements.find(e=>e.id==='pergola').parts.find(p=>p.role==='paving');
assert(end[1]<=paving.y+paving.d,'Lower route center must reach the actual paving edge, not touch it with the cap tip');
assert(end[0]-route.width/2>=paving.x&&end[0]+route.width/2<=paving.x+paving.w,'Full-width landing fits the actual paving');
for(let offset=-.59;offset<=.59;offset+=.02)assert(Math.abs(site.routeHeight(end[0]+offset,paving.y+paving.d)-1.715)<1e-9,'Full paving-edge overlap stays level');
for(let offset=-.59;offset<=.59;offset+=.02){
  const x=end[0]-(end[1]-previous[1])/lastLength*offset,z=end[1]+(end[0]-previous[0])/lastLength*offset;
  assert(Math.abs(site.routeHeight(x,z)-1.715)<1e-9,'Entire lower joining edge remains level');
}
const {SiteTerrain}=require('./site-terrain.js');
const withoutApproach=structuredClone(site.spec);
withoutApproach.routeProfiles=withoutApproach.routeProfiles.filter(r=>r.id!=='Daily dining');
for(const pad of [...site.spec.finishPads,...site.spec.protectedPads,...site.spec.gatheringPads.filter(p=>p.radius===undefined)]){
  for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){
    const x=pad.x0+(pad.x1-pad.x0)*i/8,z=pad.z0+(pad.z1-pad.z0)*j/8;
    assert(Math.abs(site.height(x,z)-SiteTerrain.height(withoutApproach,x,z))<1e-9,'Approach soil blending cannot overrun a fixed slab core');
  }
}
const bounds=site.spec.routeProfiles.find(r=>r.id==='Daily dining').bankBounds;
for(let t=0;t<=1;t+=.02){
  const x=bounds.x0+(bounds.x1-bounds.x0)*t,z=bounds.z0+(bounds.z1-bounds.z0)*t;
  for(const [px,pz,dx,dz]of[[x,bounds.z0,0,1],[x,bounds.z1,0,1],[bounds.x0,z,1,0],[bounds.x1,z,1,0]]){
    assert(Math.abs(site.height(px+dx*1e-5,pz+dz*1e-5)-site.height(px-dx*1e-5,pz-dz*1e-5))<.001,'Local influence bounds have no hard ground-height jump');
  }
}
const pondWalk=GARDEN.gardenRoutes.find(r=>r.id==='Pond walk');
for(let i=1;i<pondWalk.points.length;i++){
  const a=pondWalk.points[i-1],b=pondWalk.points[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(l/.05);
  for(let j=0;j<=steps;j++)for(const offset of[-.6,0,.6]){
    const x=a[0]+(b[0]-a[0])*j/steps-(b[1]-a[1])/l*offset,z=a[1]+(b[1]-a[1])*j/steps+(b[0]-a[0])/l*offset;
    assert(Math.abs(site.height(x,z)-SiteTerrain.height(withoutApproach,x,z))<1e-9,'Approach banking must not regrade the Pond walk ribbon');
  }
}
const {GardenRouteModel}=require('./garden-route-model.js');
let maxBankGrade=0,maxBankPoint;
const fixed=GARDEN.elements.filter(e=>['house','eastTerrace','pergola'].includes(e.id)).flatMap(e=>e.parts.filter(p=>p.kind==='rect'));
for(let x=22;x<=31;x+=.1)for(let z=10.8;z<=17.2;z+=.1){
  if(fixed.some(p=>x>=p.x&&x<=p.x+p.w&&z>=p.y&&z<=p.y+p.d)||GardenRouteModel.distance(GARDEN.gardenRoutes,x,z)<=0)continue;
  const grade=Math.hypot(site.height(x+.02,z)-site.height(x-.02,z),site.height(x,z+.02)-site.height(x,z-.02))/.04;
  if(grade>maxBankGrade){maxBankGrade=grade;maxBankPoint=[x,z];}
}
assert(maxBankGrade<1.3,`Planted shoulder stays below the provisional 130% sampled cap: ${maxBankGrade} at ${maxBankPoint}`);
const planting=GARDEN.elements.find(z=>z.id==='terraceFrontage');
assert(planting.parts.filter(p=>p.kind==='polygon').length>=2,'Low planting occupies the loop as well as the original terrace strip');
const viewer=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const plantingSource=viewer.slice(viewer.indexOf('// Planting communities follow'),viewer.indexOf('const smokeParticles'));
const positions=[];
let seed=1;
await vm.runInNewContext(`(async()=>{${plantingSource}})()`,{
  GARDEN:{elements:[planting]},EL:{terraceFrontage:planting},GA:{x:0,y:0,w:0},
  zoneRandom:()=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;},
  inPlot:()=>true,perennialDensity:2,ViewerLoading:{yield:async()=>{}},
  addPerennial:(id,x,z)=>positions.push([x,z]),addBush:()=>{}
});
for(const polygon of planting.parts.filter(p=>p.kind==='polygon')){
  const contains=([x,z])=>{
    let inside=false;
    for(let i=0,j=polygon.points.length-1;i<polygon.points.length;j=i++){
      const [ax,az]=polygon.points[i],[bx,bz]=polygon.points[j];
      if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
    }
    return inside;
  };
  assert(positions.filter(contains).length>=10,'Viewer must populate every terrace planting polygon');
}
console.log(JSON.stringify({length,maxGradePercent:maxGrade*100,maxEdgeGradePercent:maxEdgeGrade*100,maxCrossfallPercent:maxCrossfall*100,maxBankGradePercent:maxBankGrade*100}));
