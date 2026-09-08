import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {GardenRouteModel}=require('./garden-route-model.js');
const {GARDEN}=require('./layout.js');
const test=[{points:[[0,0],[5,0],[5,5]],width:1.2}];
assert.equal(GardenRouteModel.distance(test,2,0),-.6);
assert.ok(Math.abs(GardenRouteModel.distance(test,2,1)-.4)<1e-9);
const result=GardenRouteModel.geometry(GARDEN.gardenRoutes,(x,z)=>2+x*.02+z*.01);
assert.ok(result.positions.length>1000);
for(let i=0;i<result.positions.length;i+=3) {
  const [x,y,z]=result.positions.slice(i,i+3);
  assert.ok(Number.isFinite(x+y+z));
  assert.ok(Math.abs(y-(2+x*.02+z*.01))<1e-9);
  assert.ok(GardenRouteModel.distance(GARDEN.gardenRoutes,x,z)<.012);
}
assert.deepEqual(GardenRouteModel.geometry(GARDEN.gardenRoutes,(x,z)=>2+x*.02+z*.01),result);
const crossing=[{points:[[0,0],[4,0]],width:1}];
const clipped=GardenRouteModel.geometry(crossing,()=>2,.12,[{kind:'rect',x:1,y:-1,w:2,d:2}]);
for(let i=0;i<clipped.positions.length;i+=9){
  const cx=(clipped.positions[i]+clipped.positions[i+3]+clipped.positions[i+6])/3;
  assert(cx<=1+1e-9||cx>=3-1e-9,'Mineral route must not cover a hardscape slab at the same height');
}
const exclusions=GardenRouteModel.surfaceExclusions(GARDEN);
const apron=GARDEN.elements.find(e=>e.id==='firePit').parts.find(p=>p.kind==='circle'&&p.r>1);
assert(exclusions.includes(apron),'Firepit mlat apron must own its surface instead of sharing route triangles');
const inside=(points,x,z)=>{
  let hit=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
};
const shapes=exclusions.map(p=>p.kind==='rect'?[[p.x,p.y],[p.x+p.w,p.y],[p.x+p.w,p.y+p.d],[p.x,p.y+p.d]]:p.kind==='polygon'?p.points
  :Array.from({length:64},(_,i)=>[p.cx+(p.r??p.rx)*Math.cos(i*Math.PI/32),p.cy+(p.r??p.ry)*Math.sin(i*Math.PI/32)]));
const exclusive=GardenRouteModel.geometry(GARDEN.gardenRoutes,()=>2,.12,exclusions);
assert(exclusive.positions.length<result.positions.length,'Clipping must remove overlapping surface area');
for(let i=0;i<exclusive.positions.length;i+=9){
  const x=(exclusive.positions[i]+exclusive.positions[i+3]+exclusive.positions[i+6])/3,z=(exclusive.positions[i+2]+exclusive.positions[i+5]+exclusive.positions[i+8])/3;
  assert(!shapes.some(points=>inside(points,x,z)),`Route triangle still overlaps a hardscape at ${x},${z}`);
}
const lShape={kind:'polygon',points:[[1,-1],[3,-1],[3,0],[2,0],[2,1],[1,1]]};
const concave=GardenRouteModel.geometry([{points:[[0,.25],[4,.25]],width:.3}],()=>2,.12,[lShape]);
assert(concave.positions.some((n,i)=>i%3===0&&n>2.1&&n<2.9),'Concave cutout must not remove the open notch');
for(let i=0;i<concave.positions.length;i+=9){
  const x=(concave.positions[i]+concave.positions[i+3]+concave.positions[i+6])/3,z=(concave.positions[i+2]+concave.positions[i+5]+concave.positions[i+8])/3;
  assert(!inside(lShape.points,x,z));
}
console.log(`Garden routes: ${result.positions.length/3} rooted vertices, bounded union, deterministic generation pass`);
