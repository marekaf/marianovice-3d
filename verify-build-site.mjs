import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSite,excludedPages,localReferences,pages,unpublished} from './scripts/build-site.mjs';

const root=fileURLToPath(new URL('./',import.meta.url));
for(const dir of ['','docs/']){
  for(const name of readdirSync(join(root,dir)).filter(name=>name.endsWith('.html'))){
    assert(pages.includes(dir+name)||excludedPages.has(dir+name),`${dir+name} is neither published nor excluded in scripts/build-site.mjs`);
  }
}

const out=mkdtempSync(join(tmpdir(),'marianovice-site-'));
try{
  buildSite(out);
  const built=readdirSync(out,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile())
    .map(entry=>relative(out,join(entry.parentPath,entry.name)).split(sep).join('/')).sort();

  assert.deepEqual(built.filter(path=>path.endsWith('.html')),[...pages].sort(),'The site holds the listed pages and no other page');
  assert(built.includes('CNAME'),'CNAME keeps the custom domain');

  for(const path of built){
    assert(!/^verify-.*\.mjs$/.test(basename(path)),`Check script in the site: ${path}`);
    assert(!['yarn.lock','README.md','package.json'].includes(basename(path)),`Repository file in the site: ${path}`);
    if(!/\.(?:m?js|html|css)$/.test(path))continue;
    for(const target of localReferences(readFileSync(join(out,path),'utf8'),path)){
      if(unpublished.has(target))continue;
      assert(existsSync(join(out,target)),`${path} references ${target}, which the build did not copy`);
    }
  }
  console.log(`Site build: ${built.length} files, ${pages.length} pages, every local reference copied`);
}finally{
  rmSync(out,{recursive:true,force:true});
}
