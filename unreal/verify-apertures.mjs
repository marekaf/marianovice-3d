import assert from 'node:assert/strict';
import * as THREE from 'three';
import {clipApertures} from './clip-apertures.mjs';

const source=new THREE.PlaneGeometry(10,6,2,1);
source.setAttribute('color',new THREE.Uint8BufferAttribute(Array.from({length:source.attributes.position.count},()=>[128,64,255]).flat(),3,true));
source.clearGroups();source.addGroup(0,6,0);source.addGroup(6,6,1);
const before=JSON.stringify(source.toJSON());
const matrix=new THREE.Matrix4().makeRotationY(Math.PI/6);
matrix.setPosition(12,4,7);
const center=new THREE.Vector3(0,0,0).applyMatrix4(matrix);
const second=new THREE.Vector3(3,0,0).applyMatrix4(matrix);
const box=(point,r)=>({min:point.toArray().map(v=>v-r),max:point.toArray().map(v=>v+r)});
const boxes=[box(center,.5),box(second,.3)];
const result=clipApertures(THREE,source,matrix,boxes);
const mesh=new THREE.Mesh(result,[0,1].map(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide})));
mesh.applyMatrix4(matrix);mesh.updateMatrixWorld(true);
const normal=new THREE.Vector3(0,0,1).transformDirection(matrix);
function hits(x,y) {
  const target=new THREE.Vector3(x,y,0).applyMatrix4(matrix);
  return new THREE.Raycaster(target.clone().addScaledVector(normal,2),normal.clone().negate()).intersectObject(mesh);
}
assert.equal(hits(0,0).length,0,'central roof aperture must be an actual ray-passable hole');
assert.equal(hits(3,0).length,0,'second aperture must remain open');
for(const [x,y] of [[-4,0],[1.5,0],[0,2.5],[4,0]])assert.ok(hits(x,y).length,'surface outside aperture retained');
assert.deepEqual([...new Set(result.groups.map(g=>g.materialIndex))],[0,1]);
for(const attribute of Object.values(result.attributes))assert.ok([...attribute.array].every(Number.isFinite));
const pos=result.attributes.position,uv=result.attributes.uv,normals=result.attributes.normal;
for(let i=0;i<pos.count;i++){
  assert.ok(Math.abs(uv.getX(i)-(pos.getX(i)/10+.5))<1e-6,'interpolated U');
  assert.ok(Math.abs(uv.getY(i)-(pos.getY(i)/6+.5))<1e-6,'interpolated V');
  assert.equal(normals.getZ(i),1,'normal stays in local coordinates');
  assert.ok(Math.abs(result.attributes.color.getX(i)-128/255)<1e-6,'normalized vertex color retained');
}
assert.equal(JSON.stringify(source.toJSON()),before,'source geometry immutable');
const untouched=clipApertures(THREE,source,matrix,[{min:[100,100,100],max:[101,101,101]}]);
assert.equal(untouched.attributes.position.count,12,'disjoint box retains both source quads');
const removed=clipApertures(THREE,source,matrix,[{min:[0,-10,-10],max:[30,20,30]}]);
assert.equal(removed.attributes.position.count,0,'containing box removes entire surface');
const planar=new THREE.PlaneGeometry(4,4);
const coplanar=clipApertures(THREE,planar,new THREE.Matrix4(),[{min:[-1,-1,0],max:[1,1,1]}]);
const planarMesh=new THREE.Mesh(coplanar,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
planarMesh.updateMatrixWorld(true);
assert.equal(new THREE.Raycaster(new THREE.Vector3(0,0,2),new THREE.Vector3(0,0,-1)).intersectObject(planarMesh).length,0,'coplanar box face must not duplicate the clipped polygon');
function area(geometry){
  const p=geometry.attributes.position;
  let total=0;
  for(let i=0;i<p.count;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,i);
    const b=new THREE.Vector3().fromBufferAttribute(p,i+1).sub(a);
    const c=new THREE.Vector3().fromBufferAttribute(p,i+2).sub(a);
    total+=b.cross(c).length()/2;
  }
  return total;
}
assert.ok(Math.abs(area(coplanar)-12)<1e-6,'exact retained area prevents duplicate or missing triangles');
const overlapping=clipApertures(THREE,planar.toNonIndexed(),new THREE.Matrix4(),[
  {min:[-1,-1,-1],max:[1,1,1]},{min:[0,-1,-1],max:[1.5,1,1]},
]);
assert.ok(Math.abs(area(overlapping)-11)<1e-6,'overlapping apertures subtract their union on nonindexed geometry');
const positions=overlapping.attributes.position;
for(let i=0;i<positions.count;i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(positions,i);
  const b=new THREE.Vector3().fromBufferAttribute(positions,i+1).sub(a);
  const c=new THREE.Vector3().fromBufferAttribute(positions,i+2).sub(a);
  assert.ok(b.cross(c).z>0,'retained triangles preserve front-face winding');
}
console.log('Aperture clipping verified: transformed ray openings, retained surfaces, attributes, groups and immutable source.');
