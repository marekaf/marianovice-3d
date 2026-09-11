import assert from 'node:assert/strict';
import { analyzeMesh, buildManifest, parseGlb, sourcePositionToUnreal } from './export-fallback-manifest.mjs';
import { analyzeSections, verifyGeometry } from './verify-fallback-geometry.mjs';

function fixture({ indexed = true, stride = 12, componentType = 5123 } = {}) {
  const vertices = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const bytes = { 5121: 1, 5123: 2, 5125: 4 }[componentType];
  const binary = Buffer.alloc(vertices.length * stride + (indexed ? 6 * bytes : 0));
  vertices.forEach((vertex, index) => vertex.forEach((value, axis) => binary.writeFloatLE(value, index * stride + axis * 4)));
  const gltf = { asset: { version: '2.0' }, buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteLength: vertices.length * stride, byteStride: stride }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 6, type: 'VEC3' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ name: 'sample', mesh: 0 }] };
  if (indexed) {
    const write = { 1: 'writeUInt8', 2: 'writeUInt16LE', 4: 'writeUInt32LE' }[bytes];
    [0, 1, 2, 3, 4, 5].forEach((value, index) => binary[write](value, vertices.length * stride + index * bytes));
    gltf.bufferViews.push({ buffer: 0, byteOffset: vertices.length * stride, byteLength: 6 * bytes });
    gltf.accessors.push({ bufferView: 1, componentType, count: 6, type: 'SCALAR' });
    gltf.meshes[0].primitives[0].indices = 1;
  }
  return { gltf, binary };
}

let expectedHash;
for (const options of [{ indexed: false }, { stride: 16 }, { componentType: 5121 }, { componentType: 5125 }]) {
  const { gltf, binary } = fixture(options);
  const result = analyzeMesh(gltf, binary, 0);
  assert.equal(result.rawTriangleCount, 2);
  assert.equal(result.nondegenerateTriangleCount, 1);
  expectedHash ??= result.positionTriangleSha256;
  assert.equal(result.positionTriangleSha256, expectedHash);
}
for (const mutate of [g => { g.meshes[0].primitives[0].mode = 5; }, g => { g.accessors[0].componentType = 5123; },
  g => { g.accessors[0].count = 100; }, g => { g.accessors[0].sparse = {}; }, g => { g.bufferViews[0].byteStride = 13; }]) {
  const { gltf, binary } = fixture();
  mutate(gltf);
  assert.throws(() => analyzeMesh(gltf, binary, 0));
}
const { gltf, binary } = fixture();
const json = Buffer.from(JSON.stringify(gltf));
const jsonPadded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
json.copy(jsonPadded);
const binPadded = Buffer.alloc(Math.ceil(binary.length / 4) * 4);
binary.copy(binPadded);
const glb = Buffer.alloc(28 + jsonPadded.length + binPadded.length);
[0x46546c67, 2, glb.length, jsonPadded.length, 0x4e4f534a].forEach((value, index) => glb.writeUInt32LE(value, index * 4));
jsonPadded.copy(glb, 20);
glb.writeUInt32LE(binPadded.length, 20 + jsonPadded.length);
glb.writeUInt32LE(0x004e4942, 24 + jsonPadded.length);
binPadded.copy(glb, 28 + jsonPadded.length);
const manifest = buildManifest(glb);
assert.equal(manifest.meshes[0].sourceNodeName, 'sample');
assert.equal(manifest.meshes[0].positionTriangleSha256, expectedHash);
assert.equal(manifest.sourceGlbSha256.length, 64);
const sections = [{ vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]].map(sourcePositionToUnreal), indices: [2, 1, 0] }];
const actual = analyzeSections(sections);
assert.equal(actual.unrealPositionTriangleSha256, manifest.meshes[0].unrealPositionTriangleSha256);
assert.equal(verifyGeometry(glb, [{ meshIndex: 0, sections }])[0].matches, true);
assert.equal(verifyGeometry(glb, sections, 0)[0].matches, true);
assert.equal(verifyGeometry(glb, { meshIndex: 0, sections })[0].matches, true);
assert.equal(verifyGeometry(glb, [{ meshIndex: 0, sections: [...sections, ...sections] }])[0].matches, false);
const moved = structuredClone(sections);
moved[0].vertices[0][0] = 0.1;
assert.equal(verifyGeometry(glb, [{ meshIndex: 0, sections: moved }])[0].matches, false);
assert.throws(() => verifyGeometry(glb, sections));
assert.throws(() => analyzeSections([{ vertices: [[0, 0, Infinity]], indices: [0, 0, 0] }]));
assert.throws(() => analyzeSections([{ vertices: [[0, 0, 0]], indices: [0, 1, 0] }]));
assert.deepEqual(sourcePositionToUnreal([0.1, 0.2, 0.3]), [10, 30, 20]);
assert.throws(() => parseGlb(glb.subarray(0, -1)));
binary.writeUInt16LE(99, 72);
assert.throws(() => analyzeMesh(gltf, binary, 0));
console.log('Fallback manifest: indexed/nonindexed, uint8/16/32, interleaved stride, degenerates, hash consistency, GLB and accessor validation passed');
console.log('Fallback geometry: UE coordinate conversion, winding-independent hash, section extraction, single probe, changed/duplicated triangle rejection passed');
