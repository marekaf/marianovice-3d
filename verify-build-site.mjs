import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSite,excludedPages,localReferences,pages,unpublished} from './scripts/build-site.mjs';
import {threeAddons,threeImportMap,threePackage,threePreloadFiles,threePreloads,threeVendor,threeVendorDir} from './three-import-map.mjs';

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

  for(const path of [...threePreloadFiles,'LICENSE'].map(file=>threeVendorDir+file))assert(built.includes(path),`The site holds ${path}`);
  const installed=name=>readFileSync(join(root,threePackage,name));
  for(const path of built.filter(path=>path.startsWith(threeVendorDir)&&path.endsWith('.js'))){
    const source=installed(path.slice(threeVendorDir.length)),bytes=readFileSync(join(out,path));
    assert(bytes.length<source.length,`${path} is smaller than the file in the three package`);
    assert(bytes.includes('SPDX-License-Identifier: MIT')||!source.includes('SPDX-License-Identifier'),`${path} keeps its licence header`);
  }

  let mapped=0;
  for(const path of built){
    if(path.startsWith(threeVendorDir))continue;
    if(!/\.(?:m?js|html|css)$/.test(path))continue;
    const source=readFileSync(join(out,path),'utf8');
    assert.doesNotMatch(source,/node_modules/,`${path} references node_modules`);
    assert.doesNotMatch(source,/(?:https?:)?\/\/[^"'\s]*\bthree(?:@|\.module|\.core|\/)/,`${path} references a remote three URL`);
    const map=source.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    if(map){
      mapped++;
      assert.deepEqual(JSON.parse(map[1]),threeImportMap(threeVendor(path)),`${path} maps three into ${threeVendorDir} with page-relative URLs`);
      const preloads=[...source.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(match=>match[1]);
      assert.deepEqual(preloads,threePreloads(threeVendor(path)),`${path} preloads the vendored build files`);
    }
    for(const match of source.matchAll(/(['"])three\/addons\/([^'"`\s]+)\1/g)){
      const addon=threeVendorDir+threeAddons+match[2];
      assert(built.includes(addon),`${path} imports three/addons/${match[2]}, which the build did not vendor`);
    }
  }
  assert(mapped>0,'No built page holds an import map');

  for(const path of built){
    assert(!/^verify-.*\.mjs$/.test(basename(path)),`Check script in the site: ${path}`);
    assert(!['yarn.lock','README.md','package.json'].includes(basename(path)),`Repository file in the site: ${path}`);
    if(!/\.(?:m?js|html|css)$/.test(path))continue;
    for(const target of localReferences(readFileSync(join(out,path),'utf8'),path)){
      if(unpublished.has(target))continue;
      assert(existsSync(join(out,target)),`${path} references ${target}, which the build did not copy`);
    }
  }
  console.log(`Site build: ${built.length} files, ${pages.length} pages, every local reference copied, three served from ${threeVendorDir}`);
}finally{
  rmSync(out,{recursive:true,force:true});
}
