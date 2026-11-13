import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';
import {ROOT,BROWSER_CHECKS,BROWSER_MODES,BROWSER_SHARDS,browserCiMarkers} from './verify-checks.mjs';
import {serveRepo} from './browser.mjs';

const jobs=Number(process.env.BROWSER_JOBS??2);
const minutes=Number(process.env.BROWSER_CHECK_MINUTES??10);
// The whole run ends inside this budget, so a CI job with a longer limit
// always gets the summary below.
const budget=Number(process.env.BROWSER_RUN_MINUTES??Infinity);
if(!Number.isInteger(jobs)||jobs<1){
  console.error(`BROWSER_JOBS must be a positive integer, got ${process.env.BROWSER_JOBS}`);
  process.exit(2);
}

const markers=browserCiMarkers();
const marker=name=>markers.get(name)??{};
// A bare run leaves out every known-failing check. A run with CI set also
// leaves out every ci-skipped check. Name a check as an argument to run it.
const skips=name=>marker(name).status==='known-failing'||(marker(name).status==='ci-skipped'&&Boolean(process.env.CI));

const all=[...BROWSER_CHECKS.map(name=>({name,env:{}})),...BROWSER_MODES.map(mode=>({name:mode.file,env:mode.env}))];
const skipOrder=name=>`${marker(name).status==='ci-skipped'?1:0} ${name.includes('/')?1:0} ${name}`;
const skipped=all.map(check=>check.name).filter(skips).sort((a,b)=>skipOrder(a)<skipOrder(b)?-1:1);

const {values,positionals:only}=parseArgs({options:{shard:{type:'string'},shards:{type:'boolean'}},allowPositionals:true});
// Every check without a shard in its marker runs in the shard "fast".
const shardOf=name=>marker(name).shard??'fast';
const used=new Set(all.map(check=>shardOf(check.name)));
if(values.shards){
  console.log(JSON.stringify(['fast',...BROWSER_SHARDS.filter(name=>used.has(name))]));
  process.exit(0);
}
const unknown=only.filter(name=>!all.some(check=>check.name===name));
if(unknown.length){
  console.error(`Not a browser check: ${unknown.join(', ')}`);
  process.exit(2);
}
if(values.shard&&values.shard!=='fast'&&!BROWSER_SHARDS.includes(values.shard)){
  console.error(`Not a shard: ${values.shard}`);
  process.exit(2);
}
if(values.shard&&!only.length&&!used.has(values.shard)){
  console.log(`no checks in shard ${values.shard}`);
  process.exit(0);
}
const inShard=name=>!values.shard||shardOf(name)===values.shard;
const checks=all.filter(check=>only.length?only.includes(check.name):!skips(check.name)&&inShard(check.name));

const server=await serveRepo();
const env={
  ...process.env,
  MODEL_URL:`${server.origin}/index.html`,
  GARDEN_URL:`${server.origin}/index.html`,
  INTERIOR_URL:`${server.origin}/interior.html`,
  BASE_URL:server.origin,
};

const runStarted=Date.now();
function run(check) {
  return new Promise(resolve=>{
    const started=Date.now();
    const chunks=[];
    const limit=Math.min(minutes,budget-(started-runStarted)/60000);
    if(limit<=0){resolve({ok:false,output:`not started: the run budget of ${budget} minutes is used\n`,seconds:0});return;}
    // detached puts Chrome in the group of the check, so the kill reaches it too.
    const child=spawn(process.execPath,[check.name],{cwd:ROOT,env:{...env,...check.env},stdio:['ignore','pipe','pipe'],detached:true});
    const timer=setTimeout(()=>{
      chunks.push(Buffer.from(`no result after ${limit.toFixed(1)} minutes\n`));
      try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}
    },limit*60000);
    child.stdout.on('data',chunk=>chunks.push(chunk));
    child.stderr.on('data',chunk=>chunks.push(chunk));
    const done=(ok,note='')=>{
      clearTimeout(timer);
      resolve({ok,output:Buffer.concat(chunks).toString('utf8')+note,seconds:(Date.now()-started)/1000});
    };
    child.on('error',error=>done(false,`${error.message}\n`));
    child.on('close',(code,signal)=>done(code===0,code===0?'':`exit ${signal??code}\n`));
  });
}

const failures=[];
let next=0;
async function worker() {
  while(next<checks.length){
    const check=checks[next++],name=check.name;
    const result=await run(check);
    console.log(`\n> ${name} (${result.seconds.toFixed(1)}s)${result.ok?'':' FAILED'}`);
    if(result.output.trim())console.log(result.output.trimEnd());
    if(!result.ok)failures.push({name,output:result.output});
  }
}
await Promise.all(Array.from({length:Math.min(jobs,checks.length)},worker));
await server.close();

if(!only.length)for(const name of skipped)console.log(`\nSkipped: ${name} (${marker(name).reason})`);
if(failures.length){
  console.error(`\n${failures.length} of ${checks.length} browser checks failed:`);
  for(const failure of failures){
    console.error(`\n--- ${failure.name}`);
    console.error(failure.output.trimEnd());
  }
  process.exit(1);
}
console.log(`\nAll ${checks.length} browser checks passed in ${((Date.now()-runStarted)/1000).toFixed(0)}s.`);
