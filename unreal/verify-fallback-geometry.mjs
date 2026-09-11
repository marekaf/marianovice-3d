import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGlb, analyzeMesh, triangleSignature, hashTriangleSignatures } from './export-fallback-manifest.mjs';

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function analyzeSections(sections) {
  requireValue(Array.isArray(sections) && sections.length > 0, 'Expected extracted sections');
  const signatures = [];
  let rawTriangleCount = 0;
  for (const section of sections) {
    requireValue(Array.isArray(section.vertices), 'Section vertices are required');
    const vertices = section.vertices.map(vertex => {
      requireValue(Array.isArray(vertex) && vertex.length === 3 && vertex.every(Number.isFinite), 'Expected finite XYZ vertices');
      const result = vertex.map(Math.fround);
      requireValue(result.every(Number.isFinite), 'Vertex exceeds float32 range');
      return result;
    });
    const indices = section.indices ?? section.triangles;
    requireValue(Array.isArray(indices) && indices.length % 3 === 0, 'Expected TRIANGLES section indices');
    requireValue(indices.every(index => Number.isSafeInteger(index) && index >= 0 && index < vertices.length), 'Section index is out of bounds');
    for (let index = 0; index < indices.length; index += 3) {
      const triangle = indices.slice(index, index + 3).map(vertex => vertices[vertex]);
      const [a, b, c] = triangle;
      const u = b.map((value, axis) => value - a[axis]), v = c.map((value, axis) => value - a[axis]);
      rawTriangleCount++;
      if (Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) <= 1e-8) continue;
      signatures.push(triangleSignature(triangle));
    }
  }
  return { rawTriangleCount, nondegenerateTriangleCount: signatures.length,
    unrealPositionTriangleSha256: hashTriangleSignatures(signatures) };
}

export function verifyGeometry(buffer, extraction, probeMeshIndex) {
  const { gltf, binary } = parseGlb(buffer);
  let entries = Array.isArray(extraction) ? extraction : [extraction];
  if (probeMeshIndex !== undefined) {
    requireValue(Number.isSafeInteger(probeMeshIndex) && probeMeshIndex >= 0, 'Invalid probe mesh index');
    entries = [{ meshIndex: probeMeshIndex, sections: extraction.sections ?? extraction }];
  }
  requireValue(entries.length > 0, 'Extraction is empty');
  const seen = new Set();
  return entries.map(entry => {
    requireValue(Number.isSafeInteger(entry.meshIndex) && entry.meshIndex >= 0 && !seen.has(entry.meshIndex), 'Expected unique nonnegative meshIndex entries; raw section arrays require a probe mesh index');
    seen.add(entry.meshIndex);
    const source = analyzeMesh(gltf, binary, entry.meshIndex);
    const actual = analyzeSections(entry.sections);
    return { meshIndex: entry.meshIndex,
      matches: actual.nondegenerateTriangleCount === source.nondegenerateTriangleCount && actual.unrealPositionTriangleSha256 === source.unrealPositionTriangleSha256,
      expected: { nondegenerateTriangleCount: source.nondegenerateTriangleCount, unrealPositionTriangleSha256: source.unrealPositionTriangleSha256 }, actual };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  requireValue(process.argv.length >= 4 && process.argv.length <= 5, 'Usage: node verify-fallback-geometry.mjs source.glb extraction.json [probeMeshIndex]');
  const results = verifyGeometry(await readFile(process.argv[2]), JSON.parse(await readFile(process.argv[3], 'utf8')),
    process.argv[4] === undefined ? undefined : Number(process.argv[4]));
  console.log(JSON.stringify({ matches: results.every(result => result.matches), meshes: results }, null, 2));
  if (results.some(result => !result.matches)) process.exitCode = 1;
}
