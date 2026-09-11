import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const epsilon = 1e-12;
const hash = value => createHash('sha256').update(value).digest('hex');
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const natural = value => Number.isSafeInteger(value) && value >= 0;

export function triangleSignature(triangle) {
  return triangle.map(vertex => {
    const bytes = Buffer.allocUnsafe(12);
    vertex.forEach((value, axis) => bytes.writeFloatLE(value === 0 ? 0 : value, axis * 4));
    return bytes.toString('hex');
  }).sort().join('');
}

export const hashTriangleSignatures = signatures => hash(signatures.sort().join('\n'));
export const sourcePositionToUnreal = ([x, y, z]) => [x, z, y].map(value => Math.fround(value * 100));

export function parseGlb(buffer) {
  requireValue(Buffer.isBuffer(buffer) && buffer.length >= 20, 'GLB header is missing');
  requireValue(buffer.readUInt32LE(0) === 0x46546c67 && buffer.readUInt32LE(4) === 2, 'Expected GLB version 2');
  requireValue(buffer.readUInt32LE(8) === buffer.length, 'GLB length does not match header');
  const chunks = [];
  for (let offset = 12; offset < buffer.length;) {
    requireValue(offset + 8 <= buffer.length, 'Truncated GLB chunk header');
    const length = buffer.readUInt32LE(offset), type = buffer.readUInt32LE(offset + 4);
    requireValue(length % 4 === 0 && offset + 8 + length <= buffer.length, 'Invalid GLB chunk length');
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  requireValue(chunks.length === 2 && chunks[0].type === 0x4e4f534a && chunks[1].type === 0x004e4942, 'Expected JSON and BIN chunks only');
  const gltf = JSON.parse(chunks[0].data.toString('utf8'));
  requireValue(gltf.asset?.version === '2.0' && gltf.buffers?.length === 1 && !gltf.buffers[0].uri, 'Expected embedded glTF 2.0 buffer');
  const length = gltf.buffers[0].byteLength;
  requireValue(natural(length) && length <= chunks[1].data.length && chunks[1].data.length - length <= 3, 'Invalid embedded buffer length');
  return { gltf, binary: chunks[1].data.subarray(0, length) };
}

function accessor(gltf, binary, index, position) {
  requireValue(natural(index), 'Missing accessor index');
  const item = gltf.accessors?.[index];
  requireValue(item && !item.sparse && !item.normalized, 'Sparse or normalized accessors are unsupported');
  const types = position ? { 5126: [4, 'readFloatLE'] } : { 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'] };
  requireValue(item.type === (position ? 'VEC3' : 'SCALAR') && types[item.componentType], 'Expected float32 VEC3 positions or unsigned scalar indices');
  requireValue(natural(item.count) && item.count > 0 && natural(item.bufferView), 'Invalid accessor count or buffer view');
  const view = gltf.bufferViews?.[item.bufferView];
  requireValue(view && view.buffer === 0, 'Accessor must use embedded buffer');
  const [bytes, read] = types[item.componentType], width = position ? 3 : 1;
  const start = view.byteOffset ?? 0, offset = item.byteOffset ?? 0, stride = view.byteStride ?? width * bytes;
  requireValue(natural(start) && natural(offset) && natural(view.byteLength) && start + view.byteLength <= binary.length, 'Buffer view is out of bounds');
  requireValue(natural(stride) && stride >= width * bytes && stride % bytes === 0 && (start + offset) % bytes === 0, 'Invalid accessor stride or alignment');
  requireValue(view.byteStride === undefined || (stride >= 4 && stride <= 252 && stride % 4 === 0), 'Invalid glTF byteStride');
  requireValue(offset + (item.count - 1) * stride + width * bytes <= view.byteLength, 'Accessor is out of bounds');
  return { count: item.count, get: index => Array.from({ length: width }, (_, axis) => binary[read](start + offset + index * stride + axis * bytes)) };
}

export function analyzeMesh(gltf, binary, meshIndex) {
  const mesh = gltf.meshes?.[meshIndex];
  requireValue(mesh?.primitives?.length > 0, 'Mesh has no primitives');
  let rawTriangleCount = 0, nondegenerateTriangleCount = 0;
  const signatures = [], unrealSignatures = [];
  for (const primitive of mesh.primitives) {
    requireValue((primitive.mode ?? 4) === 4 && !primitive.targets && !primitive.extensions?.KHR_draco_mesh_compression, 'Only uncompressed static TRIANGLES primitives are supported');
    const positions = accessor(gltf, binary, primitive.attributes?.POSITION, true);
    const indices = primitive.indices === undefined ? null : accessor(gltf, binary, primitive.indices, false);
    const count = indices?.count ?? positions.count;
    requireValue(count % 3 === 0, 'Triangle vertex count must be divisible by three');
    for (let offset = 0; offset < count; offset += 3) {
      const triangle = Array.from({ length: 3 }, (_, corner) => {
        const index = indices ? indices.get(offset + corner)[0] : offset + corner;
        requireValue(index < positions.count, 'Triangle index is out of bounds');
        const vertex = positions.get(index);
        requireValue(vertex.every(Number.isFinite), 'Position must contain finite values');
        return vertex;
      });
      const [a, b, c] = triangle;
      const u = b.map((value, axis) => value - a[axis]), v = c.map((value, axis) => value - a[axis]);
      const area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
      rawTriangleCount++;
      if (area <= epsilon) continue;
      nondegenerateTriangleCount++;
      signatures.push(triangleSignature(triangle));
      unrealSignatures.push(triangleSignature(triangle.map(sourcePositionToUnreal)));
    }
  }
  return { meshIndex, rawTriangleCount, nondegenerateTriangleCount,
    degenerateTriangleCount: rawTriangleCount - nondegenerateTriangleCount,
    positionTriangleSha256: hashTriangleSignatures(signatures),
    unrealPositionTriangleSha256: hashTriangleSignatures(unrealSignatures) };
}

export function buildManifest(buffer) {
  const { gltf, binary } = parseGlb(buffer);
  requireValue(Array.isArray(gltf.meshes) && Array.isArray(gltf.nodes), 'GLB meshes and nodes are required');
  const meshes = gltf.meshes.map((_, index) => {
    const sourceNodes = gltf.nodes.flatMap((node, nodeIndex) => node.mesh === index ? [{ nodeIndex, name: node.name ?? null }] : []);
    return { ...analyzeMesh(gltf, binary, index), sourceNodeName: sourceNodes[0]?.name ?? null, sourceNodes };
  });
  return { schemaVersion: 1, sourceGlbSha256: hash(buffer), sourceGlbBytes: buffer.length,
    degenerateCrossNormThreshold: epsilon,
    positionHashEncoding: 'SHA256 of sorted nondegenerate triangle signatures joined by LF; each signature is three sorted float32-LE XYZ hex vertices, signed zero normalized. Mesh-local glTF coordinates; ignores winding, normals, materials and node transforms.',
    unrealPositionHashEncoding: 'Same signatures after source position conversion to float32([x,z,y]*100) centimeters. Source degenerates excluded before conversion. No node transforms or import pivot baking applied.',
    meshes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const defaults = fileURLToPath(new URL('./generated/', import.meta.url));
  requireValue(process.argv.length <= 4, 'Usage: node export-fallback-manifest.mjs [input.glb] [output.json]');
  const input = resolve(process.argv[2] ?? resolve(defaults, 'house-walkthrough.glb'));
  const output = resolve(process.argv[3] ?? resolve(defaults, 'house-fallback-manifest.json'));
  requireValue(input !== output, 'Input and output paths must differ');
  const manifest = buildManifest(await readFile(input));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ output, meshes: manifest.meshes.length, sourceGlbSha256: manifest.sourceGlbSha256 }));
}
