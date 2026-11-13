import {copyFileSync,existsSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {dirname,join,posix,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

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
    if(/^(?:[a-z][a-z0-9+.-]*:|\/\/|three\/)/i.test(match[2]))continue;
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

export function buildSite(outDir){
  const out=resolve(outDir),files=siteFiles();
  rmSync(out,{recursive:true,force:true});
  for(const path of files){
    const target=join(out,path);
    mkdirSync(dirname(target),{recursive:true});
    copyFileSync(join(root,path),target);
  }
  return files;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
  const outDir=process.argv[2]??join(root,'_site');
  const files=buildSite(outDir);
  console.log(`Site: ${files.length} files in ${resolve(outDir)}`);
}
