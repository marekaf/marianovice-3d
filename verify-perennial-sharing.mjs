import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const THREE = await import(process.env.THREE_MODULE || 'three');
const require = createRequire(import.meta.url);
const { PerennialModel } = require('./perennial-model.js');
const profiles = ['grass', 'daisy', 'spire', 'umbel', 'broadleaf'];
let constructions = 0;
const measuredThree = { ...THREE, BufferGeometry: class extends THREE.BufferGeometry {
  constructor() { super(); constructions++; }
} };
for (const profile of profiles) for (let seed = 1; seed <= 4; seed++)
  PerennialModel.createShared(measuredThree, { profile, seed });
const warmed = constructions;
const specimens = [], geometries = new Set();
let repeatedBytes = 0;
const bytes = geometry => Object.values(geometry.attributes).reduce((sum, a) => sum + a.array.byteLength, 0);
for (let i = 0; i < 100; i++) {
  const profile = profiles[i % profiles.length], height = .15 + i * .017, spread = .08 + i * .005;
  const spec = { profile, height, spread, seed: i + 101, bloom: [5, 7], color: '#bd5387', winterInterest: i % 2 === 0 };
  const root = PerennialModel.createShared(measuredThree, spec);
  assert.equal(root.userData.profile, profile);
  assert.equal(root.userData.height, height);
  assert.equal(root.userData.spread, spread);
  assert.equal(root.userData.winterInterest, spec.winterInterest);
  assert.deepEqual(root.userData.bloom, spec.bloom);
  assert.notEqual(root.userData.bloom, spec.bloom);
  root.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  for (const mesh of root.children) {
    geometries.add(mesh.geometry);
    repeatedBytes += bytes(mesh.geometry);
    const positions = mesh.geometry.attributes.position;
    for (let k = 0; k < positions.count; k++) {
      point.fromBufferAttribute(positions, k).applyMatrix4(mesh.matrixWorld);
      assert.ok(point.y >= -1e-6 && point.y <= height + 1e-6);
      assert.ok(Math.hypot(point.x, point.z) <= spread + 1e-6);
    }
    if (mesh.userData.plantPart === 'flower') {
      assert.equal(mesh.material.color.getHexString(), 'bd5387');
      assert.equal(mesh.userData.summerColor, '#bd5387');
    }
  }
  specimens.push(root);
}
assert.equal(constructions, warmed, 'Warm variants must not generate geometry per specimen');
assert.equal(geometries.size, 72, 'Four variants per profile contain 72 shared botanical-part geometries');
const sharedBytes = [...geometries].reduce((sum, geometry) => sum + bytes(geometry), 0);
assert.ok(sharedBytes <= repeatedBytes * .21, '100 specimens must use at most one fifth of duplicated geometry bytes');
const first = specimens[0], sameVariant = specimens[20];
for (let i = 0; i < first.children.length; i++) {
  assert.equal(first.children[i].geometry, sameVariant.children[i].geometry);
  assert.notEqual(first.children[i].material, sameVariant.children[i].material);
}
const untouched = sameVariant.children.map(mesh => [mesh.visible, mesh.scale.y, mesh.material.color.getHex()]);
PerennialModel.update(first, 3);
assert.deepEqual(sameVariant.children.map(mesh => [mesh.visible, mesh.scale.y, mesh.material.color.getHex()]), untouched);
const firstBloom = PerennialModel.createShared(measuredThree, { profile: 'daisy', bloom: [7], seed: 1 });
const secondBloom = PerennialModel.createShared(measuredThree, { profile: 'daisy', bloom: [8], seed: 1 });
assert.equal(firstBloom.children.find(mesh => mesh.userData.plantPart === 'flower').visible, true);
assert.equal(secondBloom.children.find(mesh => mesh.userData.plantPart === 'flower').visible, false);
for (const invalid of [{ profile: 'unknown' }, { height: 0 }, { spread: Infinity }])
  assert.throws(() => PerennialModel.createShared(measuredThree, invalid));
console.log(JSON.stringify({ specimens: specimens.length, uniqueGeometries: geometries.size, sharedBytes, repeatedBytes, constructionsAfterWarmup: constructions - warmed }));
