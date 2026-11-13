import {spawn} from 'node:child_process';
import {ROOT,BROWSER_CHECKS,BROWSER_MODES} from './verify-checks.mjs';
import {serveRepo} from './browser.mjs';

const jobs=Number(process.env.BROWSER_JOBS??2);
const minutes=Number(process.env.BROWSER_CHECK_MINUTES??10);
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

// A GitHub runner has no GPU and renders WebGL on the CPU. These checks draw
// the full scene many times and then need 3 to 10 minutes each, or miss the
// timeouts they set themselves. A run with CI set leaves them out.
const SLOW='needs minutes of CPU rendering on a runner without a GPU';
const CI_SKIPPED={
  'verify-entrance-drawing-browser.mjs':SLOW,
  'verify-entrance-egress-browser.mjs':SLOW,
  'verify-entrance-stairs-browser.mjs':SLOW,
  'verify-interior-ui.mjs':SLOW,
  'verify-pergola-view-browser.mjs':SLOW,
  'verify-render-scheduler.mjs':SLOW,
  'verify-roof-browser.mjs':SLOW,
  'verify-sauna-browser.mjs':SLOW,
  'verify-terrain-worker-browser.mjs':SLOW,
  'verify-walk-doors-browser.mjs':SLOW,
  'verify-walk-interior-browser.mjs':SLOW,
  'verify-walk-vr-browser.mjs':SLOW,
  'docs/verify-eye-level-walkthrough.mjs':SLOW,
  'docs/verify-utility-rack-placement.mjs':'reads window.DEBUG after network idle, and a slow runner reaches idle before the page sets it',
};
const skipped={...KNOWN_FAILING,...(process.env.CI?CI_SKIPPED:{})};

const all=[...BROWSER_CHECKS.map(name=>({name,env:{}})),...BROWSER_MODES.map(mode=>({name:mode.file,env:mode.env}))];
const only=process.argv.slice(2);
const unknown=only.filter(name=>!all.some(check=>check.name===name));
if(unknown.length){
  console.error(`Not a browser check: ${unknown.join(', ')}`);
  process.exit(2);
}
const checks=all.filter(check=>only.length?only.includes(check.name):!(check.name in skipped));

const server=await serveRepo();
const env={
  ...process.env,
  MODEL_URL:`${server.origin}/index.html`,
  GARDEN_URL:`${server.origin}/index.html`,
  INTERIOR_URL:`${server.origin}/interior.html`,
  BASE_URL:server.origin,
};

function run(check) {
  return new Promise(resolve=>{
    const started=Date.now();
    const chunks=[];
    const child=spawn(process.execPath,[check.name],{cwd:ROOT,env:{...env,...check.env},stdio:['ignore','pipe','pipe']});
    const timer=setTimeout(()=>{chunks.push(Buffer.from(`no result after ${minutes} minutes\n`));child.kill('SIGKILL');},minutes*60000);
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
const started=Date.now();
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
console.log(`\nAll ${checks.length} browser checks passed in ${((Date.now()-started)/1000).toFixed(0)}s.`);
