import {readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const ROOT_URL=new URL('../',import.meta.url);
export const ROOT=fileURLToPath(ROOT_URL);

const OWN_SERVER='starts its own HTTP server and needs Chrome';
const SERVED_8765='needs Chrome and the repo served at MODEL_URL (default http://127.0.0.1:8765)';

// The only checks the default run leaves out. Every entry needs a browser.
// A browser job runs these plus the BROWSER_MODES below.
export const SKIPPED_CHECKS={
  'verify-entrance-drawing-browser.mjs':'needs Chrome and the repo served at BASE_URL (default http://127.0.0.1:8781)',
  'verify-entrance-egress-browser.mjs':OWN_SERVER,
  'verify-entrance-stairs-browser.mjs':OWN_SERVER,
  'verify-garage-roof.mjs':SERVED_8765,
  'verify-grading-browser.mjs':SERVED_8765,
  'verify-grading-session-browser.mjs':SERVED_8765,
  'verify-interior-ui.mjs':'needs Chrome and interior.html served at INTERIOR_URL (default http://127.0.0.1:8765)',
  'verify-kitchen-return-grille-browser.mjs':'needs Chrome and the repo served at BASE_URL (default http://127.0.0.1:8781)',
  'verify-model3d-batching.mjs':SERVED_8765,
  'verify-pergola-view-browser.mjs':`${OWN_SERVER}; writes screenshots to PERGOLA_SCREENSHOT_DIR`,
  'verify-roof-browser.mjs':OWN_SERVER,
  'verify-route-ground-rendering.mjs':'needs Chrome and index.html served at GARDEN_URL (default http://127.0.0.1:8765)',
  'verify-sauna-browser.mjs':SERVED_8765,
  'verify-terrain-worker-browser.mjs':OWN_SERVER,
  'verify-three-subpath-browser.mjs':OWN_SERVER,
  'verify-tour-browser.mjs':OWN_SERVER,
  'verify-viewer-ui.mjs':SERVED_8765,
  'verify-walk-doors-browser.mjs':OWN_SERVER,
  'verify-walk-interior-browser.mjs':OWN_SERVER,
  'verify-walk-vr-browser.mjs':OWN_SERVER,
};

export const BROWSER_CHECKS=Object.keys(SKIPPED_CHECKS);

// These stay in the default pool for their non-browser part. With `env` set
// they also open Chrome on the page that the `url` variable names (default
// http://127.0.0.1:8765).
export const BROWSER_MODES=[
  {file:'verify-gate-model.mjs',env:{GATE_BROWSER:'1'},url:'INTERIOR_URL'},
  {file:'verify-render-scheduler.mjs',env:{RENDER_BROWSER:'1'},url:'GARDEN_URL'},
  {file:'verify-room-layout.mjs',env:{GARDEN_BROWSER:'1'},url:'GARDEN_URL'},
  {file:'docs/verify-electrical-points.mjs',env:{ELECTRICAL_BROWSER:'1'},url:'INTERIOR_URL'},
  {file:'docs/verify-eye-level-walkthrough.mjs',env:{WALKTHROUGH_BROWSER:'1'},url:'INTERIOR_URL'},
  // No separate switch: a set PLAYWRIGHT_MODULE starts the browser part.
  {file:'docs/verify-kitchen-spec.mjs',env:{PLAYWRIGHT_MODULE:'playwright-core'},url:'INTERIOR_URL'},
  {file:'docs/verify-shower-fittings.mjs',env:{SHOWER_BROWSER:'1'},url:'INTERIOR_URL'},
  {file:'docs/verify-utility-rack-placement.mjs',env:{UTILITY_RACK_BROWSER:'1'},url:'INTERIOR_URL'},
];

// A GitHub runner has no GPU and renders WebGL on the CPU, so some browser
// checks need minutes each there. The browser workflow runs one job for each
// of these shards that a check names, one check at a time, and one job named
// "fast" for the rest.
export const BROWSER_SHARDS=['entrance','roof','vr','doors','slow-1','slow-2','slow-3','slow-4','slow-5','slow-6','slow-7'];

// known-failing: the check fails against the current pages.
// ci-skipped: the check cannot pass on CPU rendering as it is written.
const BROWSER_STATUSES=['run','known-failing','ci-skipped'];

// Checks that exit with an error when they get no arguments.
export const CHECK_ARGS={
  'verify-interior-data.mjs':['house-interior.js'],
};

// Checks whose file name does not match verify-*.mjs.
export const EXTRA_CHECKS=['validate-layout.js'];

// These write the tracked SVGs that the staleness test reads, so they run
// one at a time after the pool.
export const GENERATORS=['generate-svg.js','generate-driveway-check.js'];

function list(directory) {
  const prefix=directory?`${directory}/`:'';
  return readdirSync(new URL(prefix,ROOT_URL))
    .filter(name=>/^verify-.+\.mjs$/.test(name))
    .map(name=>prefix+name);
}

function markerProblem(lines,isBrowser) {
  if(!isBrowser)return 'is not a browser check';
  if(lines.length>1)return `has ${lines.length} markers`;
  let marker;
  try{marker=JSON.parse(lines[0]);}catch{return 'is not JSON';}
  if(marker===null||typeof marker!=='object'||Array.isArray(marker))return 'is not a JSON object';
  const extra=Object.keys(marker).filter(key=>!['status','reason','shard'].includes(key));
  if(extra.length)return `has the unknown key ${extra.join(', ')}`;
  if('status' in marker&&!BROWSER_STATUSES.includes(marker.status))return `has the unknown status ${marker.status}`;
  if('shard' in marker&&!BROWSER_SHARDS.includes(marker.shard))return `has the unknown shard ${marker.shard}`;
  const skips=marker.status==='known-failing'||marker.status==='ci-skipped';
  if(skips&&(typeof marker.reason!=='string'||!marker.reason.trim()))return `has the status ${marker.status} without a reason`;
  return null;
}

// Node keeps a UTF-8 byte order mark in the text it reads, and `^` does not
// match after it, so a marker on the first line needs the mark removed.
export function browserCiMarkerLines(text) {
  return [...text.replace(/^\uFEFF/,'').matchAll(/^\/\/ ?browser-ci\b(.*)$/gm)].map(match=>match[1]);
}

// Returns the `// browser-ci {...}` line of each browser check, by check name.
// It reads the files as text, because an import runs the check.
export function browserCiMarkers() {
  const browser=new Set([...BROWSER_CHECKS,...BROWSER_MODES.map(mode=>mode.file)]);
  const markers=new Map();
  const problems=[];
  for(const name of [...EXTRA_CHECKS,...list(''),...list('docs')]){
    const lines=browserCiMarkerLines(readFileSync(new URL(name,ROOT_URL),'utf8'));
    if(!lines.length)continue;
    const problem=markerProblem(lines,browser.has(name));
    if(problem)problems.push(`${name} ${problem}`);
    else markers.set(name,JSON.parse(lines[0]));
  }
  if(problems.length)throw new Error(`Wrong browser-ci marker: ${problems.join('; ')}`);
  return markers;
}

export function discoverChecks() {
  browserCiMarkers();
  const found=[...list(''),...list('docs')].sort();
  const known=new Set([...found,...EXTRA_CHECKS]);
  const stale=[...Object.keys(SKIPPED_CHECKS),...Object.keys(CHECK_ARGS),...BROWSER_MODES.map(mode=>mode.file)].filter(name=>!known.has(name));
  if(stale.length)throw new Error(`scripts/verify-checks.mjs names missing checks: ${stale.join(', ')}`);
  return [...EXTRA_CHECKS,...found]
    .filter(name=>!(name in SKIPPED_CHECKS))
    .map(name=>({name,args:[name,...(CHECK_ARGS[name]??[])]}));
}
