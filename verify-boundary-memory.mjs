import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as THREE from 'three';

const require = createRequire(import.meta.url);
const { GateModel } = require('./gate-model.js');
const { FenceModel } = require('./fence-model.js');
const source = (await readFile(new URL('./model3d.js', import.meta.url), 'utf8'))
  .replaceAll("'three/addons/", "'" + new URL('./node_modules/three/examples/jsm/', import.meta.url).href);
const { buildModel } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
globalThis.document = { createElement: () => ({ getContext: () => ({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  putImageData() {},
}) }) };

for (const [model, expectedTriangles, baselineBytes, baselineDescriptor] of [
  [GateModel.build({ open: 0, wicketOpen: 0 }), 782172, 75082536, 42352215],
  [FenceModel.build({ start: [0, 0], end: [40, 0], heightAt: x => x * .1 }), 736808, 20924688, 27629696],
]) {
  const root = buildModel(THREE, model);
  root.updateMatrixWorld(true);
  let bytes = 0, triangles = 0, draws = 0;
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    bytes += Object.values(geometry.attributes).reduce((sum, a) => sum + a.array.byteLength, 0)
      + (geometry.index?.array.byteLength || 0) + (mesh.instanceMatrix?.array.byteLength || 0);
    triangles += (geometry.index?.count || geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
    draws++;
    assert([...geometry.attributes.position.array].every(Number.isFinite));
    if (mesh.isInstancedMesh) {
      const variant = Number(mesh.name.slice(mesh.name.lastIndexOf('_') + 1));
      const part = model.parts.find(part => mesh.name.startsWith(part.name + '_'));
      const repeated = part.groups[variant];
      assert.equal(mesh.parent.name, part.category);
      mesh.computeBoundingBox();
      for (const instance of [0, mesh.count - 1]) {
        const matrix = new THREE.Matrix4();
        mesh.getMatrixAt(instance, matrix);
        const expected = new THREE.Vector3(repeated.positions[instance][0], repeated.positions[instance][2], repeated.positions[instance][1]);
        assert(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(expected) < 5e-6);
        const triangle = Array.from({ length: 3 }, (_, i) => new THREE.Vector3().fromBufferAttribute(
          geometry.attributes.position, geometry.index ? geometry.index.getX(i) : i,
        ).applyMatrix4(matrix));
        for (const vertex of triangle) assert(mesh.boundingBox.clone().expandByScalar(1e-5).containsPoint(vertex));
        const center = triangle[0].clone().add(triangle[1]).add(triangle[2]).multiplyScalar(1 / 3);
        const normal = triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).normalize();
        if (normal.lengthSq() < .5) continue;
        const hits = new THREE.Raycaster(center.clone().addScaledVector(normal, .01), normal.negate(), 0, .03).intersectObject(mesh);
        assert(hits.some(hit => hit.instanceId === instance), 'Repeated boundary detail remains raycastable');
      }
    }
  });
  const descriptorBytes = JSON.stringify(model).length;
  console.log(JSON.stringify({ name: model.name, bytes, triangles, draws, descriptorBytes }));
  assert.equal(triangles, expectedTriangles, 'Every strand and wire triangle must remain');
  assert(bytes < baselineBytes * .15, 'Repeated boundary detail must use less than 15% of original buffers');
  assert(descriptorBytes < baselineDescriptor * .15, 'Model descriptors must not retain expanded copies');
  assert(draws < 120, 'Repeated detail must stay batched');
}
