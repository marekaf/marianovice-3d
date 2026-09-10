import {parseArgs} from 'node:util';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

export function parseExportArgs(args) {
  const {values}=parseArgs({args,options:{'source-root':{type:'string'},'floor-reference':{type:'string'},loft:{type:'boolean',default:false}},allowPositionals:false});
  if(!values['source-root']?.trim())throw new Error('An explicit --source-root viewer directory is required');
  if(values['floor-reference']!==undefined&&!values['floor-reference'].trim())throw new Error('Floor reference path must not be empty');
  return {sourceRoot:values['source-root'],loftOnly:values.loft,...(values['floor-reference']?{floorReferencePath:values['floor-reference']}:{})};
}

function inside(root,file) {
  const path=relative(root,file);
  return path!==''&&!isAbsolute(path)&&path!=='..'&&!path.startsWith('..'+sep);
}

export async function createExportInputs({sourceRoot,toolRoot}) {
  if(!sourceRoot?.trim())throw new Error('An explicit source root is required');
  const viewerRoot=await realpath(resolve(sourceRoot)),toolingRoot=await realpath(resolve(toolRoot));
  async function checkedFile(root,path) {
    const file=await realpath(resolve(root,path));
    if(!inside(root,file))throw new Error('Export input is outside its selected root');
    if(!(await stat(file)).isFile())throw new Error('Export input must be a file');
    return file;
  }
  await checkedFile(viewerRoot,'index.html');
  await checkedFile(viewerRoot,'interior.html');
  const dependency=JSON.parse(await readFile(await checkedFile(viewerRoot,'node_modules/three/package.json'),'utf8'));
  if(dependency.name!=='three'||dependency.version!=='0.160.0')throw new Error('Selected viewer requires its own three 0.160.0 dependency');
  await checkedFile(viewerRoot,'node_modules/three/build/three.module.js');
  const hashes={viewer:new Map(),tooling:new Map()};
  async function resolveRequest(rawUrl) {
    let pathname=rawUrl.split(/[?#]/,1)[0];
    if(!pathname.startsWith('/')||pathname.startsWith('//'))throw new Error('Export requests must use an absolute local path');
    for(;;){
      if(pathname.includes('\\')||pathname.includes('\0')||pathname.split('/').some(part=>part==='.'||part==='..'))throw new Error('Export path traversal is forbidden');
      const decoded=decodeURIComponent(pathname);
      if(decoded===pathname)break;
      pathname=decoded;
    }
    const owner=pathname.startsWith('/unreal/')?'tooling':'viewer',root=owner==='tooling'?toolingRoot:viewerRoot;
    const file=await checkedFile(root,'.'+pathname);
    if(owner==='tooling'&&!inside(await realpath(resolve(toolingRoot,'unreal')),file))throw new Error('Exporter helper is outside its helper directory');
    return {pathname,file,owner};
  }
  function recordFile(input,bytes) {
    hashes[input.owner].set(input.pathname,createHash('sha256').update(bytes).digest('hex'));
  }
  async function provenance() {
    for(const [owner,root,paths]of [['viewer',viewerRoot,['package.json','yarn.lock']],['tooling',toolingRoot,['unreal/export.mjs','unreal/export-inputs.mjs','unreal/export-floor-reference.mjs','package.json','yarn.lock']]]){
      for(const path of paths){
        const file=await checkedFile(root,path);
        recordFile({owner,pathname:'/'+path},await readFile(file));
      }
    }
    const repository=(root,owner)=>({
      revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
      dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),
      fileHashes:Object.fromEntries([...hashes[owner]].sort(([a],[b])=>a.localeCompare(b))),
    });
    return {viewer:repository(viewerRoot,'viewer'),tooling:repository(toolingRoot,'tooling')};
  }
  return {viewerRoot,toolRoot:toolingRoot,resolveRequest,recordFile,provenance};
}
