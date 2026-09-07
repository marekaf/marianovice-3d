import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const THREE = await import(process.env.THREE_MODULE || 'three');
const require = createRequire(import.meta.url);
const { PerennialModel } = require('./perennial-model.js');

function positions(root) {
  return root.children.map(mesh => Array.from(mesh.geometry.attributes.position.array));
}
let vertices = 0;
for (const profile of ['grass', 'daisy', 'spire', 'umbel', 'broadleaf']) {
  for (const dimensions of [[.8, .35], [.15, .08], [1.8, .65]]) {
    const [height, spread] = dimensions;
    const options = { profile, height, spread, seed: 813, bloom: [5, 6, 7] };
    const root = PerennialModel.create(THREE, options);
    assert.deepEqual(positions(root), positions(PerennialModel.create(THREE, options)), 'Same seed must reproduce geometry');
    assert.notDeepEqual(positions(root), positions(PerennialModel.create(THREE, { ...options, seed: 814 })), 'Different seeds must vary the clump');
    assert.ok(root.children.length >= 2 && root.children.length <= 4, 'Clump must batch by botanical part');
    assert.equal(root.userData.plantingScale, .45);
    assert.deepEqual(root.userData.bloom, options.bloom);
    const foliage = root.children.find(mesh => mesh.userData.plantPart === 'foliage').geometry.attributes.position;
    let foliageArea = 0;
    for (let i = 0; i < foliage.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(foliage, i);
      const b = new THREE.Vector3().fromBufferAttribute(foliage, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(foliage, i + 2);
      foliageArea += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    assert.ok(foliageArea > spread * spread * (profile === 'grass' ? 3 : 8), 'Established clumps need layered leaf coverage, not bare stalks');
    let lowest = Infinity;
    for (const mesh of root.children) {
      assert.ok(['stem', 'foliage', 'flower', 'seedhead'].includes(mesh.userData.plantPart));
      const p = mesh.geometry.attributes.position;
      assert.ok(p.count % 3 === 0);
      assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        assert.ok(Number.isFinite(x + y + z));
        assert.ok(y >= -1e-7 && y <= height + 1e-7);
        assert.ok(Math.hypot(x, z) <= spread + 1e-7);
        lowest = Math.min(lowest, y);
      }
      vertices += p.count;
    }
    assert.equal(lowest, 0, 'Stems must touch the local planting surface');
    PerennialModel.update(root, 7);
    const summer = root.children.map(mesh => ({ visible: mesh.visible, scale: mesh.scale.y, color: mesh.material.color.getHex() }));
    const flowers = root.children.filter(mesh => mesh.userData.plantPart === 'flower');
    assert.ok(flowers.every(mesh => mesh.visible));
    PerennialModel.update(root, 9);
    assert.ok(flowers.every(mesh => !mesh.visible), 'Flowers must disappear outside supplied bloom months');
    PerennialModel.update(root, 1);
    assert.ok(flowers.every(mesh => !mesh.visible));
    assert.ok(root.children.filter(mesh => mesh.userData.plantPart === 'seedhead').every(mesh => mesh.visible));
    assert.ok(root.children.filter(mesh => mesh.userData.plantPart === 'foliage').every(mesh => profile === 'grass' ? mesh.visible : !mesh.visible));
    PerennialModel.update(root, 7);
    assert.deepEqual(root.children.map(mesh => ({ visible: mesh.visible, scale: mesh.scale.y, color: mesh.material.color.getHex() })), summer, 'Season changes must be reversible');
  }
}
assert.throws(() => PerennialModel.create(THREE, { height: -1 }), /positive/);
assert.throws(() => PerennialModel.create(THREE, { profile: 'unknown' }), /known/);
const winterBloom = PerennialModel.create(THREE, { profile: 'broadleaf', bloom: [2, 3], color: '#f3e5ce', winterInterest: false });
const blossom = winterBloom.children.find(mesh => mesh.userData.plantPart === 'flower');
assert.equal(blossom.material.color.getHex(), new THREE.Color('#f3e5ce').getHex());
for (const month of [2, 3]) {
  PerennialModel.update(winterBloom, month);
  assert.ok(blossom.visible, 'Winter bloom months must not be suppressed');
  assert.ok(winterBloom.children.filter(mesh => mesh.userData.plantPart === 'foliage').every(mesh => mesh.visible));
  assert.ok(winterBloom.children.every(mesh => mesh.scale.y === 1), 'Blooming winter forms must not be cut back');
}
for (const profile of ['grass', 'daisy', 'spire', 'umbel']) {
  const plant = PerennialModel.create(THREE, { profile, winterInterest: false });
  PerennialModel.update(plant, 1);
  assert.ok(plant.children.filter(mesh => mesh.userData.plantPart === 'seedhead').every(mesh => !mesh.visible));
  PerennialModel.update(plant, 3);
  assert.ok(plant.children.every(mesh => mesh.scale.y === .12), 'March cutback must reduce standing forms');
  PerennialModel.update(plant, 7);
  assert.ok(plant.children.every(mesh => mesh.scale.y === 1));
  if (profile === 'daisy') assert.ok(plant.children.find(mesh => mesh.userData.plantPart === 'seedhead').visible, 'Daisy center stays visible during bloom');
}
console.log(`Perennials: five profiles at three sizes; ${vertices} checked vertices; seeded variation, bounds, roots and seasons pass`);
