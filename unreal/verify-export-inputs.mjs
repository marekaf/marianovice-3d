import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parseExportArgs,createExportInputs} from './export-inputs.mjs';

assert.throws(()=>parseExportArgs([]),/source-root/);
assert.throws(()=>parseExportArgs(['--source-root']),/argument|value/i);
assert.throws(()=>parseExportArgs(['--source-root','viewer','--unknown']),/unknown/i);
assert.deepEqual(parseExportArgs(['--source-root','viewer','--loft']),{sourceRoot:'viewer',loftOnly:true});
assert.deepEqual(parseExportArgs(['--source-root','viewer','--floor-reference','private.jpg']),{sourceRoot:'viewer',loftOnly:false,floorReferencePath:'private.jpg'});
assert.throws(()=>parseExportArgs(['--source-root','viewer','--floor-reference',' ']),/empty/);
const temporary=await mkdtemp(join(tmpdir(),'house-export-inputs-'));
try{
  const viewer=join(temporary,'viewer'),tooling=join(temporary,'tooling');
  await mkdir(join(viewer,'node_modules/three'),{recursive:true});
  await mkdir(join(viewer,'node_modules/three/build'),{recursive:true});
  await mkdir(join(tooling,'unreal'),{recursive:true});
  await writeFile(join(viewer,'index.html'),'active viewer');
  await writeFile(join(viewer,'interior.html'),'active interior');
  await writeFile(join(viewer,'node_modules/three/package.json'),JSON.stringify({name:'three',version:'0.160.0'}));
  await writeFile(join(viewer,'node_modules/three/build/three.module.js'),'selected dependency');
  await writeFile(join(tooling,'index.html'),'older viewer');
  await writeFile(join(tooling,'unreal/export-scene.mjs'),'export helper');
  const inputs=await createExportInputs({sourceRoot:viewer,toolRoot:tooling});
  const page=await inputs.resolveRequest('/index.html?version=1');
  assert.equal(page.owner,'viewer');assert.equal(await readFile(page.file,'utf8'),'active viewer');
  const helper=await inputs.resolveRequest('/unreal/export-scene.mjs');
  assert.equal(helper.owner,'tooling');assert.equal(await readFile(helper.file,'utf8'),'export helper');
  assert.equal((await inputs.resolveRequest('/node_modules/three/package.json')).owner,'viewer');
  for(const path of ['/../secret','/%2e%2e/secret','/unreal/../../secret','/unreal/%2e%2e/secret','/%2e%2e%2fsecret']){
    await assert.rejects(()=>inputs.resolveRequest(path),undefined,path);
  }
  await writeFile(join(temporary,'outside'),'outside');
  await symlink(join(temporary,'outside'),join(viewer,'escape.js'));
  await symlink(join(temporary,'outside'),join(tooling,'unreal/escape.mjs'));
  await assert.rejects(()=>inputs.resolveRequest('/escape.js'));
  await assert.rejects(()=>inputs.resolveRequest('/unreal/escape.mjs'));
  await assert.rejects(()=>createExportInputs({sourceRoot:tooling,toolRoot:tooling}));
  const cli=spawnSync(process.execPath,[fileURLToPath(new URL('./export.mjs',import.meta.url)),'--source-root',viewer],{
    encoding:'utf8',env:{...process.env,PLAYWRIGHT_MODULE:'missing-export-preflight-module'},timeout:5000,
  });
  assert.notEqual(cli.status,0);
  assert.match(cli.stderr,/package\.json/,'Missing source metadata fails before loading the browser dependency');
  assert(!cli.stderr.includes('missing-export-preflight-module'));
}finally{
  await rm(temporary,{recursive:true,force:true});
}

const toolRoot=resolve(fileURLToPath(new URL('../',import.meta.url)));
const inputs=await createExportInputs({sourceRoot:toolRoot,toolRoot});
const page=await inputs.resolveRequest('/index.html'),helper=await inputs.resolveRequest('/unreal/export-inputs.mjs');
const pageBytes=await readFile(page.file),helperBytes=await readFile(helper.file);
inputs.recordFile(page,pageBytes);inputs.recordFile(helper,helperBytes);
const provenance=await inputs.provenance();
assert.match(provenance.viewer.revision,/^[a-f0-9]{40}$/);
assert.match(provenance.tooling.revision,/^[a-f0-9]{40}$/);
assert.equal(typeof provenance.viewer.dirty,'boolean');
assert.equal(provenance.viewer.fileHashes['/index.html'],createHash('sha256').update(pageBytes).digest('hex'));
assert.equal(provenance.tooling.fileHashes['/unreal/export-inputs.mjs'],createHash('sha256').update(helperBytes).digest('hex'));
assert(!('/unreal/export-inputs.mjs' in provenance.viewer.fileHashes));
assert(!('/index.html' in provenance.tooling.fileHashes));
console.log('Export inputs: explicit viewer root, separate tooling, traversal protection and source fingerprints');
