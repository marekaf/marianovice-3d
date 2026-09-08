import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createFloorCanvas, createFloorTexture, plankSamples } from './docs/floor-texture.js';

const root = dirname(fileURLToPath(import.meta.url));
const checked = new Set();
const pending = ['index.html', 'interior.html', 'docs/offices.html'].map(path => resolve(root, path));
while (pending.length) {
  const file = pending.pop();
  if (checked.has(file)) continue;
  assert(existsSync(file), `Missing public runtime asset: ${relative(root, file)}`);
  assert(!relative(root, file).startsWith('..'), `Runtime asset outside repository: ${file}`);
  checked.add(file);
  if (!/\.(?:m?js|html|css)$/.test(file)) continue;
  const source = readFileSync(file, 'utf8');
  assert(!/\/Users\/|\.\.\/marianovice\/|BEGIN [A-Z ]*PRIVATE KEY/.test(source), `Private source reference: ${relative(root, file)}`);
  for (const match of source.matchAll(/(['"])([^'"`\s]+\.(?:m?js|html|css|jpg|png|svg)(?:[?#][^'"]*)?)\1/g)) {
    const path = match[2];
    if (/^(?:https?:|data:|three\/)/.test(path)) continue;
    const version=path.match(/\?v=([^&#]+)/)?.[1];
    if(version){
      const asset=resolve(dirname(file),path.split('?')[0]);
      const expected=createHash('sha256').update(readFileSync(asset)).digest('hex').slice(0,12);
      assert.equal(version,expected,`Stale asset version in ${relative(root,file)}: ${path}. Run yarn assets:version.`);
    }
    pending.push(resolve(dirname(file), path.split(/[?#]/)[0]));
  }
}
for (const path of ['house-interior.js', 'docs/survey-terrain.js', 'docs/planting-palette.js', 'docs/eye-level-walkthrough.js', 'docs/house-roof-windows.js']) {
  assert(checked.has(resolve(root, path)), `Public viewer does not reference ${path}`);
}

globalThis.document = {
  createElement(tag) {
    assert.equal(tag, 'canvas');
    return {
      getContext(kind) {
        assert.equal(kind, '2d');
        return {
          createImageData: (width, height) => ({data: new Uint8ClampedArray(width * height * 4)}),
          putImageData: pixels => { this.pixels = pixels.data; },
        };
      },
    };
  },
};
const first = createFloorCanvas(), second = createFloorCanvas();
assert.equal(first.width, 512);
assert.equal(first.height, 1024);
assert.deepEqual(first.pixels, second.pixels);
assert(first.pixels.every((value, index) => index % 4 !== 3 || value === 255));
assert(new Set(first.pixels.filter((_, index) => index % 4 === 0)).size > 12, 'Wood texture needs tonal variation');
for (const [u0, u1, v0, v1] of plankSamples) assert(0 <= u0 && u0 < u1 && u1 <= 1 && 0 <= v0 && v0 < v1 && v1 <= 1);
const texture = createFloorTexture({CanvasTexture: class {constructor(image) {this.image = image;}}, SRGBColorSpace: 'srgb'}, {capabilities: {getMaxAnisotropy: () => 8}});
assert.equal(texture.colorSpace, 'srgb');
assert.equal(texture.anisotropy, 8);
assert.equal(texture.image.width, 512);
delete globalThis.document;
console.log(`Public runtime: ${checked.size} reachable assets present; deterministic original floor texture ${createHash('sha256').update(first.pixels).digest('hex').slice(0, 12)}`);
