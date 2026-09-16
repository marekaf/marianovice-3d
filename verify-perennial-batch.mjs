import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const THREE = await import(process.env.THREE_MODULE || 'three');
const require = createRequire(import.meta.url);
const { PerennialModel } = require('./perennial-model.js');
const profiles = ['grass', 'daisy', 'spire', 'umbel', 'broadleaf'];
const specs = Array.from({ length: 120 }, (_, i) => ({
  profile: profiles[i % profiles.length], height: .15 + i * .012, spread: .08 + i * .004, seed: i + 7,
  bloom: i % 3 ? [6, 7] : [2, 3], color: i % 4 ? undefined : '#bd5387', winterInterest: i % 2 === 0 }));
const scene = new THREE.Scene(), batch = PerennialModel.createBatch(THREE);
const batched = specs.map((spec, i) => {
  const root = batch.add(spec, { zoneId: `zone-${i % 3}` });
  root.position.set(i * .5, i * .01, -i * .3);
  scene.add(root);
  return root;
});
const meshes = batch.build(scene);
assert.ok(meshes.length <= 3 * 72 && meshes.length > 0, 'Batch must hold one instanced mesh per zone, variant and part');
assert.ok(meshes.every(mesh => mesh.isInstancedMesh && mesh.receiveShadow && mesh.material.vertexColors && mesh.material.side === THREE.DoubleSide));
const capacity = meshes.reduce((sum, mesh) => sum + mesh.instanceMatrix.count, 0);
assert.equal(capacity, batched.reduce((sum, root) => sum + root.userData.instances.length, 0));
const single = specs.map((spec, i) => {
  const root = PerennialModel.createShared(THREE, spec);
  root.position.copy(batched[i].position);
  return root;
});
const render = () => { scene.updateMatrixWorld(true); for (const mesh of meshes) mesh.onBeforeRender(); };
const expected = new THREE.Matrix4(), actual = new THREE.Matrix4(), color = new THREE.Color();
function compare(month) {
  for (let i = 0; i < specs.length; i++) {
    const root = single[i];
    root.updateMatrixWorld(true);
    for (const mesh of root.children) {
      const instance = batched[i].userData.instances.find(entry => entry.part === mesh.userData.plantPart);
      assert.equal(instance.mesh.geometry, mesh.geometry, 'Instances must draw the shared variant geometry');
      assert.equal(instance.mesh.castShadow, mesh.castShadow);
      if (!mesh.visible) { assert.equal(instance.slot, -1, `Month ${month} hidden ${mesh.name} must leave the drawn range`); continue; }
      assert.ok(instance.slot >= 0 && instance.slot < instance.mesh.count, `Month ${month} visible ${mesh.name} must be inside the drawn range`);
      instance.mesh.getMatrixAt(instance.slot, actual);
      expected.copy(mesh.matrixWorld);
      assert.ok(actual.elements.every((value, k) => Math.abs(value - expected.elements[k]) <= 1e-6 * (1 + Math.abs(expected.elements[k]))), `Month ${month} plant ${i} ${mesh.name} transform must match the single-mesh plant`);
      instance.mesh.getColorAt(instance.slot, color);
      assert.equal(color.getHexString(), mesh.material.color.getHexString(), `Month ${month} ${mesh.name} colour must match the single-mesh plant`);
    }
  }
}
for (const month of [7, 1, 3, 10, 2, 12, 7]) {
  for (let i = 0; i < specs.length; i++) { PerennialModel.update(single[i], month); PerennialModel.update(batched[i], month); }
  render();
  compare(month);
  for (const mesh of meshes) {
    const drawn = mesh.userData.members.filter(member => member.visible).length;
    assert.equal(mesh.count, drawn, 'Drawn range must hold exactly the visible parts');
    const slots = mesh.userData.members.filter(member => member.visible).map(member => member.slot).sort((a, b) => a - b);
    assert.deepEqual(slots, slots.map((_, k) => k), 'Visible parts must fill slots without gaps');
  }
}
for (const mesh of meshes) assert.ok(mesh.count === 0 ? mesh.boundingSphere.isEmpty() : mesh.boundingSphere.radius > 0 && mesh.boundingSphere.radius < 60, "Culling sphere must follow the drawn instances");
const before = meshes.map(mesh => mesh.instanceMatrix.version);
render();
assert.deepEqual(meshes.map(mesh => mesh.instanceMatrix.version), before, 'Unchanged plants must not re-upload instance matrices');
for (const root of [...single, ...batched]) root.scale.multiplyScalar(.45);
render();
compare(7);
for (const invalid of [{ profile: 'unknown' }, { height: 0 }]) assert.throws(() => batch.add(invalid));
console.log(JSON.stringify({ plants: specs.length, instancedMeshes: meshes.length, monthsCompared: 7 }));
