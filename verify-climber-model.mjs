import assert from 'node:assert/strict';
import { ClimberModel } from './climber-model.js';
const THREE = await import(process.env.THREE_MODULE || 'three');
for (const [width, height] of [[1.1, 2.2], [.95, 2.4], [.3, .4]]) {
  for (const seed of [1, 94, 1257]) {
    const plant = ClimberModel.create(THREE, { width, height, seed });
    const leaves = plant.children.find(m => m.isInstancedMesh);
    assert.equal(plant.children.length, 2);
    assert.ok(leaves.count >= 200);
    assert.equal(plant.userData.plantingScale, .45);
    assert.equal(leaves.userData.leafHabit, 'deciduous');
    const same = ClimberModel.create(THREE, { width, height, seed }).children.find(m => m.isInstancedMesh);
    assert.deepEqual(leaves.instanceMatrix.array, same.instanceMatrix.array);
    assert.deepEqual(leaves.instanceColor.array, same.instanceColor.array);
    const p = new THREE.Vector3(), matrix = new THREE.Matrix4();
    for (const mesh of plant.children) {
      for (let i = 0; i < (mesh.count ?? 1); i++) {
        if (mesh.isInstancedMesh) mesh.getMatrixAt(i, matrix); else matrix.identity();
        const positions = mesh.geometry.attributes.position;
        for (let j = 0; j < positions.count; j++) {
          p.fromBufferAttribute(positions, j).applyMatrix4(matrix);
          assert.ok(Number.isFinite(p.x + p.y + p.z));
          assert.ok(Math.abs(p.x) <= width / 2 + 1e-6, `Climber leaves must stay in wall run: ${p.x} / ${width}`);
          assert.ok(p.y >= -.002 && p.y <= height + 1e-6, `Climber height ${p.y} / ${height}`);
          assert.ok(p.z > 0 && p.z < .22, 'Climbers must remain in shallow facade envelope');
        }
      }
    }
  }
}
const trimmed = ClimberModel.create(THREE, { blocked: p => p.x > .15 });
assert.ok(trimmed.children.find(m => m.isInstancedMesh).count < 240);
assert.throws(() => ClimberModel.create(THREE, { height: NaN }), /finite/);
console.log('Climbers: seeded attached leaves, shallow wall bounds, rooted stems, seasonal metadata and blocked branches pass');
