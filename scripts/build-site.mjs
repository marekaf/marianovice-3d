import {copyFileSync,existsSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join,posix,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildSync,transformSync} from 'esbuild';
import {threeImportMap,threeSource,threeVendorDir,threeVersion} from '../three-import-map.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));

export const pages=['index.html','interior.html','grading.html','editor.html','fixtures.html','docs/offices.html'];

// Pages kept out of the published site, each with the reason.
export const excludedPages=new Map([
  ['tour.html','its data, unreal/generated/tour/tour.json, is generated locally and not published'],
  ['review.html','local draft that .gitignore keeps out of the repository'],
  ['book.html','local draft that .gitignore keeps out of the repository'],
]);

// Files a published page names but the repository does not hold. The page handles the failed request itself.
// They stay out even when a local run has them on disk, so a local build equals the CI build.
export const unpublished=new Map([
  ['docs/terrain-works-export.json','generated locally; grading.html reports that the views are unavailable'],
  ['docs/terrain-works.pdf','generated locally together with the export manifest'],
]);

const extras=['CNAME'];
const scanned=/\.(?:m?js|html|css)$/;
const reference=/(['"])([^'"`\s]+\.(?:m?js|html|css|json|jpe?g|png|gif|webp|svg|ico|pdf|woff2?|glb|gltf|hdr|wasm)(?:[?#][^'"]*)?)\1/g;

// Site paths a source file names: script, import, fetch, image and link targets. The match is on any quoted
// path with an asset extension, so a reference built from pieces at run time is invisible here.
export function* localReferences(source,from){
  for(const match of source.matchAll(reference)){
    // The value of a download attribute or property names the saved file, not a request.
    if(/download\s*=\s*$/.test(source.slice(0,match.index)))continue;
    if(/^(?:[a-z][a-z0-9+.-]*:|\/\/|three\/)/i.test(match[2])||match[2].startsWith(threeSource))continue;
    yield posix.normalize(posix.join(posix.dirname(from),match[2].split(/[?#]/)[0]));
  }
}

export function siteFiles(){
  const files=new Set(),missing=[];
  const pending=pages.map(path=>({path,from:'the page list'}));
  while(pending.length){
    const {path,from}=pending.pop();
    if(files.has(path)||unpublished.has(path))continue;
    if(excludedPages.has(path)){missing.push(`${from} links to the excluded page ${path}`);continue;}
    if(path.startsWith('../')||!existsSync(join(root,path))){missing.push(`${from} references ${path}, which does not exist`);continue;}
    files.add(path);
    if(!scanned.test(path))continue;
    for(const next of localReferences(readFileSync(join(root,path),'utf8'),path))pending.push({path:next,from:path});
  }
  for(const path of extras){
    if(existsSync(join(root,path)))files.add(path);
    else missing.push(`${path} does not exist`);
  }
  if(missing.length)throw new Error(`Cannot build the site:\n  ${missing.join('\n  ')}`);
  return [...files].sort();
}

// Writes a minified copy of three's entry file, of each addon the site files import, and of every file those
// import. Each file stays a separate module at its package path, so the relative imports inside the package
// still resolve and the browser holds one instance of three.module.js and of three.core.js.
function vendorThree(out,files){
  const source=join(root,'.'+threeSource);
  const installed=existsSync(join(source,'package.json'))?JSON.parse(readFileSync(join(source,'package.json'),'utf8')).version:null;
  if(installed!==threeVersion)throw new Error(`Cannot build the site: package.json pins three ${threeVersion}, node_modules holds ${installed??'no three'}. Run yarn install.`);
  const entry=threeImportMap.imports.three.slice(threeSource.length),addons=threeImportMap.imports['three/addons/'].slice(threeSource.length);
  const entries=new Set([entry]);
  for(const path of files){
    if(!scanned.test(path))continue;
    for(const match of readFileSync(join(root,path),'utf8').matchAll(/(['"])three\/addons\/([^'"`\s]+)\1/g))entries.add(addons+match[2]);
  }
  for(const path of entries)if(!existsSync(join(source,path)))throw new Error(`Cannot build the site: three ${threeVersion} has no ${path}`);
  // This bundle is discarded. Its metafile lists every file the entries reach through relative imports.
  const {metafile}=buildSync({absWorkingDir:source,entryPoints:[...entries],bundle:true,external:['three'],format:'esm',write:false,metafile:true,outdir:'unused',logLevel:'silent'});
  const vendored=Object.keys(metafile.inputs).sort();
  for(const path of vendored){
    for(const {path:name,original,external} of metafile.inputs[path].imports){
      // The import map of the pages resolves the name three and no other bare name.
      if(external?name!=='three':!/^\.\.?\//.test(original))throw new Error(`Cannot build the site: ${path} imports ${original??name}, which the import map does not resolve`);
    }
    // The default legal-comment mode keeps the licence header of each file.
    const {code}=transformSync(readFileSync(join(source,path),'utf8'),{loader:'js',format:'esm',minify:true,sourcefile:path});
    const target=join(out,threeVendorDir,path);
    mkdirSync(dirname(target),{recursive:true});
    writeFileSync(target,code);
  }
  copyFileSync(join(source,'LICENSE'),join(out,threeVendorDir,'LICENSE'));
  return [...vendored,'LICENSE'].map(path=>threeVendorDir+path);
}

export function buildSite(outDir){
  const out=resolve(outDir),files=siteFiles();
  rmSync(out,{recursive:true,force:true});
  for(const path of files){
    const target=join(out,path);
    mkdirSync(dirname(target),{recursive:true});
    // An import map resolves a relative address against the page, so each page gets its own path to the vendor directory.
    if(path.endsWith('.html'))writeFileSync(target,readFileSync(join(root,path),'utf8').replaceAll(threeSource,(posix.relative(posix.dirname(path),'.')||'.')+'/'+threeVendorDir));
    else copyFileSync(join(root,path),target);
  }
  return [...files,...vendorThree(out,files)].sort();
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
  const outDir=process.argv[2]??join(root,'_site');
  const files=buildSite(outDir);
  console.log(`Site: ${files.length} files in ${resolve(outDir)}`);
}
