import assert from 'node:assert/strict';
import { ShrubModel } from './shrub-model.js';
const THREE=await import(process.env.THREE_MODULE||'three');
for(const size of [.35,.8,1.5])for(const [x,z] of [[1,3],[28.32,2.14],[-.3,12]]) {
  const shrub=ShrubModel.create(THREE,{x,z,size,groundY:2});
  const repeat=ShrubModel.create(THREE,{x,z,size,groundY:2});
  assert.deepEqual(shrub.position.toArray(),[x,2,z]);
  assert.equal(shrub.children.length,2);
  assert.equal(shrub.userData.plantingScale,.45);
  assert.equal(shrub.userData.spread,.72*size);
  assert.ok(shrub.userData.leafCount>=1000);
  let minimum=Infinity;
  for(let child=0;child<2;child++) {
    const mesh=shrub.children[child],other=repeat.children[child];
    assert.deepEqual(mesh.geometry.attributes.position.array,other.geometry.attributes.position.array);
    if(mesh.isInstancedMesh){assert.equal(mesh.userData.leafHabit,'deciduous');assert.deepEqual(mesh.instanceMatrix.array,other.instanceMatrix.array);assert.deepEqual(mesh.instanceColor.array,other.instanceColor.array);}
    const matrix=new THREE.Matrix4(),p=new THREE.Vector3();
    for(let i=0;i<(mesh.count??1);i++) {
      if(mesh.isInstancedMesh)mesh.getMatrixAt(i,matrix);else matrix.identity();
      const vertices=mesh.geometry.attributes.position;
      for(let j=0;j<vertices.count;j++) {
        p.fromBufferAttribute(vertices,j).applyMatrix4(matrix);
        assert.ok(Number.isFinite(p.x+p.y+p.z));
        assert.ok(Math.hypot(p.x,p.z)<=size*.72+1e-6,`Shrub spread ${Math.hypot(p.x,p.z)} exceeds ${size*.72}`);
        assert.ok(p.y>=-1e-6&&p.y<=size*1.5+1e-6);
        minimum=Math.min(minimum,p.y);
      }
    }
  }
  assert.ok(Math.abs(minimum)<1e-6,'Woody shrub stems must reach ground');
}
assert.throws(()=>ShrubModel.create(THREE,{size:NaN}),/finite/);
console.log('Shrub rooted bounds, deterministic geometry, two draw calls and seasonal leaves verified');
