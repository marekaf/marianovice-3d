import {spawn} from 'node:child_process';
import {ROOT,GENERATORS,discoverChecks} from './verify-checks.mjs';

const jobs=Number(process.env.VERIFY_JOBS??4);
if(!Number.isInteger(jobs)||jobs<1){
  console.error(`VERIFY_JOBS must be a positive integer, got ${process.env.VERIFY_JOBS}`);
  process.exit(2);
}

function run(command,args) {
  return new Promise(resolve=>{
    const started=Date.now();
    const chunks=[];
    const child=spawn(command,args,{cwd:ROOT,stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',chunk=>chunks.push(chunk));
    child.stderr.on('data',chunk=>chunks.push(chunk));
    const done=(ok,note='')=>resolve({ok,output:Buffer.concat(chunks).toString('utf8')+note,seconds:(Date.now()-started)/1000});
    child.on('error',error=>done(false,`${error.message}\n`));
    child.on('close',(code,signal)=>done(code===0,code===0?'':`exit ${signal??code}\n`));
  });
}

const failures=[];
function report(name,result) {
  console.log(`\n> ${name} (${result.seconds.toFixed(1)}s)${result.ok?'':' FAILED'}`);
  if(result.output.trim())console.log(result.output.trimEnd());
  if(!result.ok)failures.push({name,output:result.output});
}

const checks=discoverChecks();
let next=0;
async function worker() {
  while(next<checks.length){
    const check=checks[next++];
    report(check.name,await run(process.execPath,check.args));
  }
}
await Promise.all(Array.from({length:Math.min(jobs,checks.length)},worker));

for(const generator of GENERATORS)report(generator,await run(process.execPath,[generator]));

// Porcelain also catches staged changes and regenerated files deleted from Git.
const changed=await run('git',['status','--porcelain','--','*.svg']);
if(!changed.ok)report('git status',changed);
else if(changed.output){
  const diff=await run('git',['--no-pager','diff','--stat','--','*.svg']);
  failures.push({name:'generated SVGs',output:`Generated SVGs are stale or missing. Review and commit the regenerated drawings.\n${changed.output}${diff.output}`});
}

if(failures.length){
  console.error(`\n${failures.length} of ${checks.length+GENERATORS.length+1} verification steps failed:`);
  for(const failure of failures){
    console.error(`\n--- ${failure.name}`);
    console.error(failure.output.trimEnd());
  }
  process.exit(1);
}
console.log(`\nAll ${checks.length} verification checks passed.`);
