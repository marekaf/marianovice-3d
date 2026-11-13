import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

export function* runtimeAssetReferences(source) {
  for(const match of source.matchAll(/(['"])([^'"`\s]+\.(?:m?js|html|css|jpg|png|svg)(?:[?#][^'"]*)?)\1/g)){
    if(/\.download\s*=\s*$/.test(source.slice(0,match.index)))continue;
    yield match[2];
  }
}

// Node resolves require() and path.join() arguments as file names, and a download name is not a
// URL, so a query string there breaks the call instead of busting a cache.
const notFetched=/(?:\brequire\(|__dirname,|\bdownload\(|\.download\s*=)\s*$/;

// Every quoted local .js/.mjs path the browser fetches: script tags, static and dynamic imports,
// worker URLs and script URLs kept in a string.
export function* localScriptReferences(source) {
  for(const match of source.matchAll(/(['"])([^'"`\s?#]+\.m?js)(?:\?v=([^'"`\s&#]*))?\1/g)){
    if(/^(?:[a-z][a-z+.-]*:|\/\/|three\/)/i.test(match[2]))continue;
    if(notFetched.test(source.slice(Math.max(0,match.index-40),match.index)))continue;
    yield {index:match.index,length:match[0].length,quote:match[1],path:match[2],version:match[3]??null};
  }
}

export const assetVersion=file=>createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,12);

export function publicPages(root) {
  return execFileSync('git',['ls-files','--','*.html'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
}

// A script's hash covers the versions written into it, so each script is rewritten before any file
// that references it. Returns the files it changed.
export function versionLocalScripts(pages) {
  const versions=new Map(),visiting=[],changed=[];
  const rewrite=file=>{
    const source=readFileSync(file,'utf8');
    let updated='',end=0;
    for(const reference of localScriptReferences(source)){
      const asset=resolve(dirname(file),reference.path);
      if(!existsSync(asset))throw new Error(`${file} references missing script ${reference.path}`);
      updated+=`${source.slice(end,reference.index)}${reference.quote}${reference.path}?v=${version(asset)}${reference.quote}`;
      end=reference.index+reference.length;
    }
    updated+=source.slice(end);
    if(updated!==source){writeFileSync(file,updated);changed.push(file);}
  };
  const version=asset=>{
    if(versions.has(asset))return versions.get(asset);
    if(visiting.includes(asset))throw new Error(`Scripts that import each other cannot carry content hashes: ${[...visiting.slice(visiting.indexOf(asset)),asset].join(' -> ')}`);
    visiting.push(asset);
    rewrite(asset);
    visiting.pop();
    versions.set(asset,assetVersion(asset));
    return versions.get(asset);
  };
  for(const page of pages)rewrite(page);
  return changed;
}
