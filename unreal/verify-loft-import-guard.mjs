import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const temporary=await mkdtemp(join(tmpdir(),'house-loft-import-guard-'));
try{
  await mkdir(join(temporary,'generated'));
  await copyFile(new URL('./import-loft.py',import.meta.url),join(temporary,'import-loft.py'));
  await writeFile(join(temporary,'generated/manifest.json'),JSON.stringify({ownership:{loft:'house',roofWindows:'house'}}));
  const result=spawnSync('python3',['-I',join(temporary,'import-loft.py')],{encoding:'utf8',timeout:5000});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/house.*already.*loft|loft.*owned.*house/i,'Integrated house blocks the supplement before any engine import');
  assert(!result.stderr.includes('ModuleNotFoundError'),'The guard must run before importing the engine API');
}finally{
  await rm(temporary,{recursive:true,force:true});
}
console.log('Loft supplement import refuses an integrated house package before loading the engine');
