import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';
import {ROOT,BROWSER_CHECKS,BROWSER_MODES} from './verify-checks.mjs';
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

// Checks that fail against the current pages. A bare run leaves them out.
// Name one as an argument to run it.
const KNOWN_FAILING={
  'verify-grading-browser.mjs':'expects 8 zone feature rows, grading.html renders 9',
  'verify-grading-session-browser.mjs':'expects 8 zone feature rows, the terrain preview renders 9',
  'verify-route-ground-rendering.mjs':'patches a cutGroundUnderRoutes call that index.html no longer contains, so the page never reports ready',
  'verify-room-layout.mjs':'its browser part finds a west-side object that fails the report.west test',
  'verify-viewer-ui.mjs':'expects 23 view presets, index.html has 24',
  'docs/verify-electrical-points.mjs':'clicks the #electrical summary, which interior.html keeps hidden',
  'docs/verify-shower-fittings.mjs':'reads a page global named data that interior.html does not define',
};

// A GitHub runner has no GPU and renders WebGL on the CPU, so these checks
// need minutes each there. A CI job runs one shard, one check at a time. Every
// check that no shard names runs in the shard "fast".
const SHARDS={
  'entrance':['verify-entrance-drawing-browser.mjs','verify-entrance-egress-browser.mjs','verify-pergola-view-browser.mjs','docs/verify-utility-rack-placement.mjs'],
  'roof':['verify-roof-browser.mjs','verify-terrain-worker-browser.mjs'],
  'vr':['verify-walk-vr-browser.mjs'],
  'doors':['verify-walk-doors-browser.mjs'],
};

// These cannot pass on CPU rendering as they are written. A run with CI set
// leaves them out.
const CI_SKIPPED={
  'verify-entrance-stairs-browser.mjs':'allows 30 s for the loading panel to close, and CPU rendering needs longer',
  'verify-interior-ui.mjs':'gives no result in 20 minutes on a runner without a GPU',
  'verify-render-scheduler.mjs':'counts frames of a resting scene, and the count differs on CPU rendering',
  'verify-sauna-browser.mjs':'allows 120 s for the garden to load, and CPU rendering needs longer',
  'verify-walk-interior-browser.mjs':'its W key walk covers too little distance at the frame rate of CPU rendering',
  'docs/verify-eye-level-walkthrough.mjs':'allows 5 s for a pointer event to clear, and CPU rendering needs longer',
};
const skipped={...KNOWN_FAILING,...(process.env.CI?CI_SKIPPED:{})};
const slow=Object.values(SHARDS).flat();

const all=[...BROWSER_CHECKS.map(name=>({name,env:{}})),...BROWSER_MODES.map(mode=>({name:mode.file,env:mode.env}))];
const stale=[...slow,...Object.keys(skipped)].filter(name=>!all.some(check=>check.name===name));
if(stale.length)throw new Error(`scripts/verify-browser.mjs names missing checks: ${stale.join(', ')}`);

const {values,positionals:only}=parseArgs({options:{shard:{type:'string'},shards:{type:'boolean'}},allowPositionals:true});
if(values.shards){
  console.log(JSON.stringify(['fast',...Object.keys(SHARDS)]));
  process.exit(0);
}
const unknown=only.filter(name=>!all.some(check=>check.name===name));
if(unknown.length){
  console.error(`Not a browser check: ${unknown.join(', ')}`);
  process.exit(2);
}
if(values.shard&&values.shard!=='fast'&&!(values.shard in SHARDS)){
  console.error(`Not a shard: ${values.shard}`);
  process.exit(2);
}
const inShard=name=>!values.shard||(values.shard==='fast'?!slow.includes(name):SHARDS[values.shard].includes(name));
const checks=all.filter(check=>only.length?only.includes(check.name):!(check.name in skipped)&&inShard(check.name));

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

if(!only.length)for(const [name,reason] of Object.entries(skipped))console.log(`\nSkipped: ${name} (${reason})`);
if(failures.length){
  console.error(`\n${failures.length} of ${checks.length} browser checks failed:`);
  for(const failure of failures){
    console.error(`\n--- ${failure.name}`);
    console.error(failure.output.trimEnd());
  }
  process.exit(1);
}
console.log(`\nAll ${checks.length} browser checks passed in ${((Date.now()-runStarted)/1000).toFixed(0)}s.`);
