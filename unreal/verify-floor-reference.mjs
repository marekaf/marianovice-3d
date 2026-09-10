import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createFloorReference} from './export-floor-reference.mjs';

const temporary=await mkdtemp(join(tmpdir(),'floor-reference-check-'));
try {
  assert.equal(await createFloorReference(),null);
  const path=join(temporary,'reference.jpg'),bytes=Buffer.from([255,216,255,224,1,2,3]);
  await writeFile(path,bytes);
  const reference=await createFloorReference(path);
  assert.equal(reference.metadata.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert(!JSON.stringify(reference.metadata).includes(temporary));
  const source=reference.module.replace("export {createFloorCanvas} from '/__export/procedural-floor.mjs';",'');
  const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  let succeed,fail;
  const THREE={SRGBColorSpace:'srgb',TextureLoader:class{load(url,onLoad,progress,onError){
    assert.equal(url,'/__export/floor-reference.jpg');succeed=onLoad;fail=onError;return {};
  }}};
  const texture=mod.createFloorTexture(THREE,{capabilities:{getMaxAnisotropy:()=>4}});
  assert.equal(texture.colorSpace,'srgb');assert.equal(texture.anisotropy,4);
  assert.deepEqual(mod.plankSamples,[[.003,.247,.55,.98],[.253,.497,.02,.98],[.503,.747,.02,.98],[.753,.997,.29,.98]]);
  let ready=false;const waiting=mod.waitForFloorReference().then(()=>{ready=true;});
  await Promise.resolve();assert.equal(ready,false);
  succeed(texture);await waiting;assert(ready);
  mod.createFloorTexture(THREE,{capabilities:{getMaxAnisotropy:()=>1}});fail();
  await assert.rejects(mod.waitForFloorReference(),/failed to load/);
  await writeFile(path,'not an image');
  await assert.rejects(createFloorReference(path),/JPEG/);
  await assert.rejects(createFloorReference(join(temporary,'missing.jpg')),/ENOENT/);
  assert.deepEqual(reference.bytes,bytes,'An input edit cannot change the already fingerprinted image');
  console.log('Local floor reference: fingerprint, plank crops, load completion and failure checks pass');
} finally {await rm(temporary,{recursive:true,force:true});}
