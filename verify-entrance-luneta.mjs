import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildEntranceLuneta,entranceLunetaPavingDatum} from './entrance-luneta-model.js';
const require=createRequire(import.meta.url);
const {HOUSE_INTERIOR:house}=require('./house-interior.js'),{GARDEN:garden}=require('./layout.js');
const {TERRAIN}=require('./terrain.js'),{GradingSite}=require('./grading-site.js'),{SiteTerrain}=require('./site-terrain.js');
const {site}=GradingSite.create({garden,terrain:TERRAIN});
const finish=(x,z)=>SiteTerrain.drivewayFinish(site.spec,x,z),before=JSON.stringify([house,garden,house.exteriorOpenings()]);
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const variant of ['sketch','aligned','straight']){
  const datum=entranceLunetaPavingDatum(house,garden,finish,{variant});
  const model=buildEntranceLuneta(house,garden,TERRAIN.houseFFLInternal,datum,{variant}),d=model.dimensions;
  assert.deepEqual(model,buildEntranceLuneta(house,garden,TERRAIN.houseFFLInternal,datum,{variant}));
  close(d.footprint.x1,21.88);close(d.zSouth,variant==='sketch'?22.53:22.5525);close(d.footprint.z1,d.zSouth+2*d.southTread);
  close(d.floorY-3*d.rise,datum);assert(d.rise>.17&&d.rise<.18);
  assert.equal(model.walkSurfaces.length,variant==='straight'?6:8);
  const terrace=garden.elements.find(e=>e.id==='eastTerrace').parts.find(p=>p.kind==='rect');
  close(model.recess.z0,terrace.y+terrace.d);
  close(model.recess.x1,model.wallSegments.find(s=>s.name==='recess_east').x0);
  close(model.proposedFill.x0,terrace.x+terrace.w);
  close(model.proposedFill.x1,model.wallSegments.find(s=>s.name==='garden_return').x0);
  close(model.proposedFill.z1,model.wallSegments.find(s=>s.name==='terrace_south').z0);
  close(model.proposedFill.y,d.floorY);
  close(model.proposedFill.bottom,d.wall.bottom);
  const fill=model.parts.find(p=>p.name==='garden_return_fill');
  close(fill.position[2]+fill.size[2]/2,model.proposedFill.y);
  assert.equal(fill.material,'grass');
  assert(model.parts.every(p=>p.material!=='soil'),'The entrance has paving and lawn, not exposed soil');
  close(model.recess.y,d.floorY);
  close(model.wallSegments.find(s=>s.name==='stair_north').x0,d.facadeX+.7);
  for(let x=d.facadeX+.031;x<d.facadeX+.6;x+=.083)for(let z=model.recess.z0+.023;z<d.zSouth-.1;z+=.073){
    const surfaces=model.walkSurfaces.filter(s=>x>s.x0&&x<s.x1&&z>s.z0&&z<s.z1);
    assert.equal(surfaces.length,1,'The entire entrance-to-terrace connection is continuously walkable');
    close(surfaces[0].y,d.floorY);
    const tops=model.parts.filter(p=>x>p.position[0]-p.size[0]/2+1e-9&&x<p.position[0]+p.size[0]/2-1e-9&&z>p.position[1]-p.size[1]/2+1e-9&&z<p.position[1]+p.size[1]/2-1e-9&&Math.abs(p.position[2]+p.size[2]/2-d.floorY)<1e-8);
    assert.equal(tops.length,1,'The connection has one visible finish without wall or paving overlap');
    assert.equal(tops[0].material,'paving');
  }
  for(const [i,a] of model.walkSurfaces.entries())for(const b of model.walkSurfaces.slice(i+1)){
    assert(Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)<1e-8||Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0)<1e-8,'Walking rectangles must not overlap');
  }
  let samples=0;
  for(let x=d.facadeX+.01317;x<d.footprint.x1;x+=.01917)for(let z=d.zNorth+.01317;z<d.footprint.z1;z+=.01917){
    if(x<d.facadeX+.7&&z>d.zSouth)continue;
    const i=Math.max(x<=d.facadeX+.7?0:Math.ceil((x-d.facadeX-.7)/.3),z<=d.zSouth?0:Math.ceil((z-d.zSouth)/.325));
    const surfaces=model.walkSurfaces.filter(s=>x>s.x0&&x<s.x1&&z>s.z0&&z<s.z1);
    assert.equal(surfaces.length,1,'Expanded stair footprint has no gaps');close(surfaces[0].y,d.floorY-i*d.rise);samples++;
    const supporting=model.parts.filter(p=>['stairFill','palisade'].includes(p.material)&&x>=p.position[0]-p.size[0]/2-1e-8&&x<=p.position[0]+p.size[0]/2+1e-8&&z>=p.position[1]-p.size[1]/2-1e-8&&z<=p.position[1]+p.size[1]/2+1e-8);
    assert.equal(supporting.length,1);close(supporting[0].position[2]+supporting[0].size[2]/2,surfaces[0].y-(supporting[0].material==='stairFill'?.06:0));
    const finishes=model.parts.filter(p=>['paving','palisade'].includes(p.material)&&Math.abs(p.position[2]+p.size[2]/2-surfaces[0].y)<1e-8&&x>p.position[0]-p.size[0]/2+1e-9&&x<p.position[0]+p.size[0]/2-1e-9&&z>p.position[1]-p.size[1]/2+1e-9&&z<p.position[1]+p.size[1]/2-1e-9);
    assert.equal(finishes.length,1,`Visible paving and palisade tops cover (${x}, ${z}) without coplanar overlaps`);
  }
  for(const fill of model.parts.filter(p=>p.material==='stairFill'))for(const palisade of model.parts.filter(p=>p.material==='palisade')){
    const intersection=[0,1,2].map(axis=>Math.min(fill.position[axis]+fill.size[axis]/2,palisade.position[axis]+palisade.size[axis]/2)-Math.max(fill.position[axis]-fill.size[axis]/2,palisade.position[axis]-palisade.size[axis]/2));
    assert(intersection.some(length=>length<=1e-8),`${fill.name} intersects ${palisade.name}`);
  }
  for(const p of model.parts){assert(p.position.every(Number.isFinite)&&p.size.every(n=>Number.isFinite(n)&&n>0));close(p.position[2]-p.size[2]/2,p.material==='paving'?p.position[2]-.03:p.material==='luneta'?p.position[2]-.1:d.wall.bottom);}
  for(const segment of model.wallSegments){
    const blocks=model.parts.filter(p=>p.name.startsWith(`luneta_${segment.name}_`));
    close(Math.max(...blocks.map(p=>p.position[2]+p.size[2]/2)),d.floorY);
    close(Math.min(...blocks.map(p=>p.position[2]-p.size[2]/2)),d.floorY-.8);
    assert.equal(new Set(blocks.map(p=>p.position[2])).size,4);
    const alongX=segment.x1-segment.x0>segment.z1-segment.z0,axis=alongX?0:1,length=alongX?segment.x1-segment.x0:segment.z1-segment.z0;
    for(let course=0;course<4;course++){
      const row=blocks.filter(p=>p.name.includes(`_${course}_`));
      close(row.reduce((sum,p)=>sum+p.size[axis],0),length);
      assert(row.every(p=>p.size[axis]<=.4+1e-8),'Luneta units retain nominal 400 mm length with cut ends');
      close(row[0].size[axis],course%2?.2:.4);
    }
  }
  if(variant==='aligned')assert(model.walkSurfaces[1].z1>=model.walkSurfaces[0].z1,'Landing supports the full entrance opening');
  for(const part of model.parts.filter(p=>/^entrance_south_|^south_riser_[12]_/.test(p.name)))assert(part.position[0]-part.size[0]/2>=21.28-1e-8,'South wraps remain east of the house wall');
  console.log(JSON.stringify({variant,datum,rise:d.rise,samples,parts:model.parts.length,wallCourses:d.wall.courses}));
}
assert.equal(JSON.stringify([house,garden,house.exteriorOpenings()]),before);
for(const args of [[NaN,1], [2,Infinity],[1,2],[2,2]])assert.throws(()=>buildEntranceLuneta(house,garden,...args));
assert.throws(()=>buildEntranceLuneta(house,garden,2.465,1.95,{variant:'unknown'}));
assert.throws(()=>entranceLunetaPavingDatum(house,garden,()=>NaN));
console.log('Entrance Luneta variants: supported tiled steps, equal rises, continuous walk surfaces and four wall courses verified');
const {carportPostLayout}=await import('./carport-posts-model.js');
const entrancePost=carportPostLayout(garden).find(post=>post.id==='entrance');
const intersects=(surface,half)=>Math.min(surface.x1,entrancePost.x+half)>Math.max(surface.x0,entrancePost.x-half)+1e-8&&Math.min(surface.z1,entrancePost.z+half)>Math.max(surface.z0,entrancePost.z-half)+1e-8;
for(const variant of ['straight','aligned','sketch']){
  const datum=entranceLunetaPavingDatum(house,garden,finish,{variant});
  const model=buildEntranceLuneta(house,garden,TERRAIN.houseFFLInternal,datum,{variant});
  if(variant==='straight'){
    assert(model.walkSurfaces.every(s=>!intersects(s,entrancePost.footingWidth/2)),'Straight treads avoid even the nominal footing plan envelope');
    close(entrancePost.z-entrancePost.footingWidth/2-model.dimensions.zSouth,.0275);
  }else assert(model.walkSurfaces.some(s=>intersects(s,entrancePost.width/2)),'Source wrap variants retain their documented post collision');
}
console.log('Straight descent avoids the entrance post; source wraps intersect it and remain comparison variants');
