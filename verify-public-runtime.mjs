import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {assetVersion,localScriptReferences,publicPages,runtimeAssetReferences} from './runtime-asset-references.mjs';
import { createFloorTexture, plankSamples, waitForFloorReference } from './docs/floor-texture.js';

const root = dirname(fileURLToPath(import.meta.url));
const pages = publicPages(root).map(path => resolve(root, path));
const fetched = new Set();
const scripts = [...pages];
while (scripts.length) {
  const file = scripts.pop();
  if (fetched.has(file)) continue;
  fetched.add(file);
  for (const reference of localScriptReferences(readFileSync(file, 'utf8'))) {
    const asset = resolve(dirname(file), reference.path);
    assert(existsSync(asset), `Missing script in ${relative(root, file)}: ${reference.path}`);
    assert(reference.version, `Unversioned local script in ${relative(root, file)}: ${reference.path}. Run yarn assets:version.`);
    assert.equal(reference.version, assetVersion(asset), `Stale asset version in ${relative(root, file)}: ${reference.path}. Run yarn assets:version.`);
    scripts.push(asset);
  }
}

const checked = new Set();
const pending = [...pages];
while (pending.length) {
  const file = pending.pop();
  if (checked.has(file)) continue;
  assert(existsSync(file), `Missing public runtime asset: ${relative(root, file)}`);
  assert(!relative(root, file).startsWith('..'), `Runtime asset outside repository: ${file}`);
  checked.add(file);
  if (!/\.(?:m?js|html|css)$/.test(file)) continue;
  const source = readFileSync(file, 'utf8');
  assert(!/\/Users\/|\.\.\/marianovice\/|BEGIN [A-Z ]*PRIVATE KEY/.test(source), `Private source reference: ${relative(root, file)}`);
  for (const path of runtimeAssetReferences(source)) {
    if (/^(?:https?:|data:|three\/|\/node_modules\/)/.test(path)) continue;
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

const image = readFileSync(resolve(root,'floorify-champagne.jpg'));
assert.equal(createHash('sha256').update(image).digest('hex'),'09eeb1dac3c6ba3b0440373cca544e192353ee23678c34d685055aa90cad0688','Public floor must use the approved reference image');
assert.deepEqual(plankSamples,[[.003,.247,.55,.98],[.253,.497,.02,.98],[.503,.747,.02,.98],[.753,.997,.29,.98]]);
let loaded;
const texture = createFloorTexture({TextureLoader: class {
  load(url,onLoad) {
    assert.equal(url,new URL('./floorify-champagne.jpg',import.meta.url).href);
    loaded=onLoad;return {};
  }
}, SRGBColorSpace:'srgb'}, {capabilities:{getMaxAnisotropy:()=>8}});
assert.equal(texture.name,'Floorify Champagne');
assert.equal(texture.colorSpace,'srgb');
assert.equal(texture.anisotropy,8);
let finished=false;
const ready=waitForFloorReference().then(()=>{finished=true;});
await Promise.resolve();
assert.equal(finished,false,'Floor readiness waits for the image');
loaded();
await ready;
assert.equal(finished,true);
console.log(`Public runtime: ${checked.size} reachable assets present; approved Champagne image, plank crops and loading verified`);
