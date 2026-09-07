import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require=createRequire(import.meta.url);
const { SurveySurface }=require('./survey-surface.js');
const fallback={a:.01,b:-.02,c:3};
const square=[[0,0,3],[10,0,4],[10,10,5],[0,10,4],[5,5,4]];
const planar=SurveySurface.create(square,fallback);
for(let x=0;x<=10;x+=.5)for(let z=0;z<=10;z+=.5)assert.ok(Math.abs(planar.height(x,z)-(3+.1*x+.1*z))<1e-10);
assert.deepEqual(planar.data,SurveySurface.create([...square].reverse(),fallback).data);
assert.throws(()=>SurveySurface.create([[0,0,0],[1,1,1],[2,2,2]],fallback),/collinear/);
assert.throws(()=>SurveySurface.create([[0,0,0],[0,0,1],[2,1,2]],fallback),/distinct/);
assert.throws(()=>SurveySurface.create([[0,0,0],[1,1,NaN],[2,1,2]],fallback),/finite/);
function verify(surface) {
  const {data}=surface,serialized=JSON.parse(JSON.stringify(data));
  const used=new Set(data.triangles.flat());
  assert.equal(used.size,data.points.length,'Every measured point belongs to triangulation');
  assert.equal(data.triangles.length,2*data.points.length-2-data.hullEdges.length,'Triangulation must have no holes');
  for(const [i,j] of data.hullEdges) {
    const a=data.points[i],b=data.points[j];
    for(const p of data.points)assert.ok((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-1e-8,'Boundary must be the convex survey hull');
  }
  for(const [x,z,h] of data.points)assert.ok(Math.abs(surface.height(x,z)-h)<1e-9,'Measured spot must be reproduced exactly');
  let edgeChecks=0;
  for(const tri of data.triangles)for(let e=0;e<3;e++) {
    const a=data.points[tri[e]],b=data.points[tri[(e+1)%3]],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    for(const t of [.1,.5,.9]) {
      const x=a[0]+t*dx,z=a[1]+t*dz,center=surface.height(x,z);
      for(const sign of [-1,1]) {
        const near=surface.height(x+sign*dz/len*1e-7,z-sign*dx/len*1e-7);
        assert.ok(Math.abs(near-center)<1e-5,'No jump across triangle or survey-hull edge');
      }
      assert.equal(SurveySurface.height(serialized,x,z),center);
      edgeChecks++;
    }
  }
  for(let x=-20;x<70;x+=1.1)for(let z=-20;z<70;z+=1.3)assert.ok(Number.isFinite(surface.height(x,z)));
  const farX=1000,farZ=1000,plane=data.fallbackPlane;
  assert.ok(Math.abs(surface.height(farX,farZ)-Math.max(0,plane.a*farX+plane.b*farZ+plane.c))<1e-9,'Distant extrapolation must converge to fallback plane');
  const parityPoints=data.points.map(p=>p.slice(0,2));
  for(let x=-20;x<70;x+=1.1)for(let z=-20;z<70;z+=1.3)parityPoints.push([x,z]);
  for(const [i,j] of data.hullEdges) {
    const a=data.points[i],b=data.points[j],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    for(const t of [0,.001,.5,.999,1])for(const offset of [-1e-7,0,1e-7,.01,1,10])parityPoints.push([a[0]+t*dx+offset*dz/length,a[1]+t*dz-offset*dx/length]);
  }
  for(const i of new Set(data.hullEdges.flat())) {
    const p=data.points[i];
    for(const radius of [.01,.5,3,20])for(let angle=0;angle<Math.PI*2;angle+=Math.PI/60) {
      const x=p[0]+radius*Math.cos(angle),z=p[1]+radius*Math.sin(angle);
      parityPoints.push([x,z]);
      const nearby=surface.height(p[0]+radius*Math.cos(angle+1e-8),p[1]+radius*Math.sin(angle+1e-8));
      assert.ok(Math.abs(surface.height(x,z)-nearby)<1e-5,'No jump where nearest hull edge changes near a corner');
    }
  }
  const python=JSON.parse(execFileSync('python3',['-c','import json,sys; from blender.survey_surface import height; d=json.load(sys.stdin); print(json.dumps([height(d["data"], *p) for p in d["points"]]))'],
    {cwd:new URL('.',import.meta.url),input:JSON.stringify({data,points:parityPoints}),encoding:'utf8',maxBuffer:8*1024*1024}));
  assert.equal(python.length,parityPoints.length);
  let maxError=0;
  parityPoints.forEach(([x,z],i)=>{const error=Math.abs(surface.height(x,z)-python[i]);maxError=Math.max(maxError,error);assert.ok(error<1e-9,`Python sampler differs by ${error} m`);});
  return {points:data.points.length,triangles:data.triangles.length,hullEdges:data.hullEdges.length,edgeChecks,paritySamples:parityPoints.length,pythonMaxError:maxError};
}
console.log('Synthetic survey',verify(planar));
const irregular=Array.from({length:49},(_,i)=>{const x=i%7*3+Math.sin(i)*.14,z=Math.floor(i/7)*3+Math.cos(i)*.13;return [x,z,3+Math.sin(x*.2)+Math.cos(z*.3)];});
console.log('Irregular survey',verify(SurveySurface.create(irregular,fallback)));
const {SURVEY_TERRAIN}=require('./docs/survey-terrain.js');
const {TERRAIN}=require('./terrain.js');
console.log('Measured survey',verify(SurveySurface.create(SURVEY_TERRAIN.points,TERRAIN.plane)));
