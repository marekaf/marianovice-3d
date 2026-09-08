import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const require=createRequire(import.meta.url),{GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js'),{HiddenBenchModel}=require('./hidden-bench-model.js');
const model=HiddenBenchModel.build(GARDEN,TERRAIN.plane),rect=model.footprint;
assert.equal(model.product,'HAY Palissade Dining Bench');
assert.deepEqual(model.dimensions,{width:1.28,depth:.70,height:.80,seatHeight:.45});
assert.equal(model.facing,'N');
assert.deepEqual(model,HiddenBenchModel.build(GARDEN,TERRAIN.plane));
assert.equal(model.feet.length,4);
assert.equal(model.parts.filter(p=>p.name.startsWith('formed_rib_')).length,23);
assert(!Object.values(model.materials).some(m=>m.grain));
assert.equal(model.materials.ironRed.color,'#783d32');
assert.equal(model.groundPatches.length,1);
assert.equal(model.groundPatch.w,2);
assert.equal(model.groundPatch.d,1.3);
assert.equal(new Set(model.parts.map(p=>p.name)).size,model.parts.length);
for(const part of model.parts){
  assert(['furniture','ground'].includes(part.category));assert(model.materials[part.material]);
  assert(part.vertices.flat().every(Number.isFinite));
  const area=part.category==='ground'?model.groundPatch:rect;
  for(const p of part.vertices){assert(p[0]>=area.x-1e-8&&p[0]<=area.x+area.w+1e-8,part.name);assert(p[1]>=area.y-1e-8&&p[1]<=area.y+area.d+1e-8,part.name);}
  let volume=0;const origin=part.vertices[0];
  for(const face of part.faces)for(let i=1;i<face.length-1;i++){
    const[a,b,c]=[face[0],face[i],face[i+1]].map(j=>part.vertices[j].map((v,k)=>v-origin[k]));
    volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  assert(volume>0,`${part.name}: outward closed mesh`);
}
for(const foot of model.feet){
  assert(Math.abs(foot.topHeight)<1e-9);
  for(const[x,z,y]of foot.bottomCorners)assert(Math.abs(y+model.floorHeight-model.groundPatch.level)<1e-8);
}
const productVertices=model.parts.filter(p=>p.category==='furniture').flatMap(p=>p.vertices);
const bounds=part=>[0,1,2].map(i=>[Math.min(...part.vertices.map(p=>p[i])),Math.max(...part.vertices.map(p=>p[i]))]);
for(const rib of model.parts.filter(p=>p.name.startsWith('formed_rib_')))for(const supports of [['seat_front_rail'],['back_top_rail','rear_leg_0','rear_leg_1']]){
  const a=bounds(rib);
  assert(supports.some(name=>{const b=bounds(model.parts.find(p=>p.name===name));return a.every((range,i)=>range[0]<=b[i][1]&&range[1]>=b[i][0]);}),`${rib.name} must meet front and back frame`);
}
assert(Math.abs(Math.max(...productVertices.map(p=>p[2]))-.80)<1e-6);
assert(Math.abs(Math.min(...productVertices.map(p=>p[2])))<1e-6);
const {SiteTerrain}=require('./site-terrain.js');
const patches={garage:require('./garage-model.js').GarageModel.groundPatch(GARDEN,TERRAIN.houseFFLInternal-.5),pergola:require('./pergola-model.js').PergolaModel.build(GARDEN).groundPatch,greenhouse:require('./greenhouse-model.js').GreenhouseModel.build(GARDEN,TERRAIN.plane).groundPatch,raisedBeds:require('./raised-beds-model.js').RaisedBedsModel.build(GARDEN).groundPatch};
const terrainOptions=[{},{houseFFL:TERRAIN.houseFFLInternal}];
if(existsSync(new URL('./docs/survey-terrain.js',import.meta.url)))terrainOptions.push({houseFFL:TERRAIN.houseFFLInternal,surveySurface:require('./survey-surface.js').SurveySurface.create(require('./docs/survey-terrain.js').SURVEY_TERRAIN.points,TERRAIN.plane).data});
for(const options of terrainOptions){
  const site=SiteTerrain.create(GARDEN,TERRAIN.plane,patches,options),bench=HiddenBenchModel.build(GARDEN,site.height),pad=bench.groundPatch;
  assert(Math.abs(rect.x+rect.w/2-32.3)<1e-9);
  assert(Math.abs(rect.y+rect.d/2-18.55)<1e-9);
  assert(pad.y+pad.d+pad.southBlend<19.38,'Pad grading must stop before garage north wall');
  for(let x=pad.x;x<=pad.x+pad.w+1e-8;x+=.1)for(let y=pad.y;y<=pad.y+pad.d+1e-8;y+=.1)assert(Math.abs(site.height(x,y)-pad.level)<1e-8,'Entire pad must be graded flat');
  for(const foot of bench.feet){
    assert(Math.abs(bench.floorHeight-site.height(...foot.center)-pad.surfaceOffset)<1e-8,'Every foot must contact mineral finish');
    for(const[x,y,z]of foot.bottomCorners)assert(Math.abs(site.height(x,y)-bench.floorHeight-z)<1e-8);
  }
  const route=GARDEN.gardenRoutes.find(r=>r.id==='Pond walk');
  assert(pad.y<route.points[2][1]+route.width/2&&pad.y+pad.d>route.points[2][1],'Pad meets pond path without a grass gap');
  if(site.routeHeight)for(let x=pad.x;x<=pad.x+pad.w;x+=.1)assert(Math.abs(site.routeHeight(x,18.2)-bench.floorHeight)<1e-8,'Path/pad shared area has identical finish');
  const without={...site.spec,benchPad:undefined};
  for(const point of [[32.3,19.38],[32.3,20],[20,15],[31,17],[34.2,18]])assert.equal(site.height(...point),SiteTerrain.height(without,...point),'No grading outside pad blend');
}
console.log(`Palissade bench: fixed 128×70×80cm steel body; four feet on level 2×1.3m mineral pad, pond connection and garage clearance pass.`);
