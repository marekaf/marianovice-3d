import {mkdtemp,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('..',import.meta.url));
const output=await mkdtemp(join(tmpdir(),'house-visual-review-'));
const env={...process.env,WALK_SCREENSHOT_DIR:output,ROOF_SCREENSHOT_DIR:output,
  DOOR_SCREENSHOT:join(output,'opening_W22_0-open.png'),PORTAL_SCREENSHOT_DIR:output,
  WINDOW_SCREENSHOT_DIR:output,POCKET_SCREENSHOT_DIR:output};
let failed=false;
for(const test of ['verify-walk-interior-browser.mjs','verify-roof-browser.mjs','verify-walk-doors-browser.mjs']){
  const result=spawnSync(process.execPath,[join(root,test)],{cwd:root,env,stdio:'inherit'});
  if(result.error)console.error(result.error.message);
  if(result.status!==0){failed=true;break;}
}
const images=(await readdir(output)).filter(name=>name.endsWith('.png')).sort();
const escape=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
await writeFile(join(output,'index.html'),`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>House visual review</title><style>
body{font:16px system-ui;margin:24px;background:#f1f1ec;color:#223127}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:20px}
figure{margin:0;background:white;padding:12px}img{width:100%;height:auto}figcaption{padding:8px 0}
</style><h1>House visual review</h1>
<p>${failed?'Checks failed. This is a partial capture.':'Browser checks passed. Images still require visual review.'}</p>
<p>Public procedural finishes. No private reference photos or Unreal rendering.</p>
<main>${images.map(name=>`<figure><a href="${escape(name)}"><img loading="lazy" src="${escape(name)}" alt="${escape(name.replace('.png','').replaceAll('-',' '))}"></a><figcaption>${escape(name)}</figcaption></figure>`).join('\n')}</main></html>`);
console.log(`Visual review: ${join(output,'index.html')}`);
if(failed)process.exitCode=1;
