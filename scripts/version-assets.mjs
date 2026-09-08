import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const pages=execFileSync('git',['ls-files','--','*.html'],{cwd:root,encoding:'utf8'}).trim().split('\n');
for(const page of pages){
  const file=resolve(root,page),source=readFileSync(file,'utf8');
  const updated=source.replace(/(['"])([^'"\s]+\.m?js)\?v=[^'"&#]+\1/g,(match,quote,asset)=>{
    if(/^https?:/.test(asset))return match;
    const version=createHash('sha256').update(readFileSync(resolve(dirname(file),asset))).digest('hex').slice(0,12);
    return `${quote}${asset}?v=${version}${quote}`;
  });
  if(updated!==source){writeFileSync(file,updated);console.log(`Versioned assets in ${page}`);}
}
