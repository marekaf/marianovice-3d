import assert from 'node:assert/strict';
import {buildElectricalOutlet,buildElectricalFrame,electricalFacePoint,attachElectricalPoints} from './electrical-model.js';
import {ELECTRICAL_POINTS} from './electrical-points.js';

const point={id:'test-outlet',room:'test',kind:'power',count:2,position:[2,1,3],normal:[0,0,1],orientation:'horizontal'};
for(const kind of ['power','data','coax'])for(const orientation of ['horizontal','vertical'])for(const count of [1,2,5,6,11]){
  const model=buildElectricalOutlet({...point,kind,orientation,count});
  assert.equal(model.deviceCount,count);assert.equal(model.devices.length,count);assert.equal(model.frames.length,Math.ceil(count/5));
  assert.equal(new Set(model.parts.map(p=>p.name)).size,model.parts.length);
  assert(model.frames.every(frame=>frame.count<=5));
  for(const part of model.parts){assert(part.position.every(Number.isFinite));assert((part.size??[part.radius,part.depth]).every(n=>Number.isFinite(n)&&n>0));}
  if(kind==='power'){
    assert.equal(model.parts.filter(p=>p.name.endsWith('_earth_pin')).length,count);
    assert.equal(model.parts.filter(p=>p.name.endsWith('_socket')).flatMap(p=>p.holes).length,count*2);
  }
  for(let i=1;i<model.frames.length;i++){
    const a=model.frames[i-1],b=model.frames[i],axis=orientation==='horizontal'?0:1;
    assert(Math.abs(b.center[axis]-a.center[axis])>(a.size[axis]+b.size[axis])/2);
  }
}
const normals=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]];
for(const normal of normals){
  const p={...point,normal},out=electricalFacePoint(p,[0,0,.01]);
  assert(Math.abs(out.reduce((sum,n,i)=>sum+(n-p.position[i])*normal[i],0)-.01)<1e-9);
  assert(Math.abs(electricalFacePoint(p,[0,.1,0]).reduce((sum,n,i)=>sum+(n-p.position[i])*normal[i],0))<1e-9);
}
assert.throws(()=>buildElectricalOutlet({...point,count:0}));
assert.throws(()=>buildElectricalOutlet({...point,normal:[1,0,1]}));
const mixedPoints=[{...point,id:'data',kind:'data',count:2,frameId:'shared'},{...point,id:'power',count:3,frameId:'shared'},{...point,id:'coax',kind:'coax',count:1,frameId:'shared'}];
const mixed=buildElectricalFrame(mixedPoints);
assert.equal(mixed.frameCount,2);assert.equal(mixed.deviceCount,6);
assert.deepEqual(mixed.devices.map(p=>p.kind),['power','power','power','data','data','coax']);
assert.deepEqual(mixed.recordIds,['power','data','coax']);
assert.equal(new Set(mixed.devices.map(p=>p.center.join(','))).size,6);
assert.equal(new Set(mixed.parts.map(p=>p.name)).size,mixed.parts.length);
assert.throws(()=>buildElectricalFrame([point,{...point,position:[2,2,3]}]),/anchors/);
const switched=buildElectricalFrame([{...point,count:3,switchCount:1}]);
assert.equal(switched.socketCount,3);assert.equal(switched.switchCount,1);assert.equal(switched.deviceCount,4);
assert.equal(switched.devices.filter(p=>p.kind==='switch').length,1);
const floor=buildElectricalFrame([{...point,normal:[0,1,0]}]);
assert(floor.parts.every(p=>p.material==='metal'));assert(floor.parts.every(p=>p.position[2]+p.size[2]<.005));
if(process.env.THREE_MODULE){
  const THREE=await import(process.env.THREE_MODULE),house={root:new THREE.Group(),dims:{floorY:.12}};
  const points=normals.map((normal,i)=>({...point,id:`outlet-${i}`,normal}));
  const group=attachElectricalPoints(THREE,house,points);house.root.updateMatrixWorld(true);
  assert.equal(group.position.y,.12);assert.equal(group.children.length,6);
  group.children.forEach((fixture,i)=>{
    const normal=new THREE.Vector3(0,0,1).transformDirection(fixture.matrixWorld);
    assert(normal.distanceTo(new THREE.Vector3(...points[i].normal))<1e-9);
    fixture.traverse(mesh=>{if(mesh.isMesh)assert([...mesh.geometry.attributes.position.array].every(Number.isFinite));});
  });
  assert.throws(()=>attachElectricalPoints(THREE,house,[point,point]),/Duplicate/);
  const grouped=attachElectricalPoints(THREE,house,mixedPoints);
  assert.equal(grouped.children.length,1);assert.equal(grouped.children[0].userData.count,6);
  assert.deepEqual(grouped.children[0].userData.recordIds,['power','data','coax']);
  const mapped=ELECTRICAL_POINTS.filter(p=>p.position&&p.normal);
  const source=attachElectricalPoints(THREE,house,mapped);
  assert.equal(source.children.flatMap(p=>p.userData.recordIds).length,mapped.length);
  assert(source.children.some(p=>p.userData.recordIds.includes('1.06-Z09')));
}
console.log('Electrical outlet checks passed: finite geometry, mixed frames, switches, closed floor covers, six surface normals and mapped source records.');
