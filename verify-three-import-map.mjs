import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicPages} from './runtime-asset-references.mjs';
import {threeImportMap,threePackage,threePreloadFiles,threePreloads,threeSource,threeVersion} from './three-import-map.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
assert.match(threeVersion,/^\d+\.\d+\.\d+$/,'package.json must pin an exact three version, because the site build names its directory after it');

let mapped=0;
for(const page of publicPages(root)){
  const source=readFileSync(resolve(root,page),'utf8');
  assert.doesNotMatch(source,/https?:\/\/[^"'\s]*\bthree@/,`${page} must not load three from a remote host`);
  const maps=[...source.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)];
  if(!maps.length){
    assert.doesNotMatch(source,/from\s*['"]three['"/]/,`${page} imports three without an import map`);
    continue;
  }
  mapped++;
  assert.equal(maps.length,1,`${page} must hold one import map`);
  const imports=JSON.parse(maps[0][1]);
  assert.deepEqual(imports,threeImportMap(threeSource(page)),`${page} import map must match three-import-map.mjs with the prefix ${threeSource(page)}`);
  const preloads=[...source.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)];
  assert.deepEqual(preloads.map(match=>match[1]),threePreloads(threeSource(page)),`${page} must preload the two three.js build files`);
  // A root-absolute URL leaves the mount when a server holds the repository under a subpath.
  for(const target of [...Object.values(imports.imports),...preloads.map(match=>match[1])]){
    const {pathname}=new URL(target,`http://localhost/preview/${page}`);
    assert.ok(pathname.startsWith(`/preview/${threePackage}`),`${page} must reach ${target} relative to the page, got ${pathname}`);
  }
  // Chrome before 133 ignores an import map that follows a module preload.
  assert.ok(preloads[0].index>maps[0].index,`${page} must place the import map before the module preloads`);
}
assert.ok(mapped>0,'No page holds an import map');

const installed=resolve(root,threePackage);
if(existsSync(installed)){
  assert.equal(JSON.parse(readFileSync(resolve(installed,'package.json'),'utf8')).version,threeVersion,'The installed three must be the version package.json pins');
  for(const file of threePreloadFiles)assert.ok(existsSync(resolve(installed,file)),`${threePackage}${file} is missing`);
}
console.log(`${mapped} pages load three ${threeVersion} through the same page-relative import map.`);
