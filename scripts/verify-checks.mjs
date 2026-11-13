import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const ROOT=fileURLToPath(new URL('../',import.meta.url));

const OWN_SERVER='starts its own HTTP server and needs Chrome';
const SERVED_8765='needs Chrome and the repo served at MODEL_URL (default http://127.0.0.1:8765)';

// The only checks the default run leaves out. Every entry needs a browser,
// so this is also the exact list for a browser job.
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
  'verify-tour-browser.mjs':OWN_SERVER,
  'verify-viewer-ui.mjs':SERVED_8765,
  'verify-walk-doors-browser.mjs':OWN_SERVER,
  'verify-walk-interior-browser.mjs':OWN_SERVER,
  'verify-walk-vr-browser.mjs':OWN_SERVER,
};

export const BROWSER_CHECKS=Object.keys(SKIPPED_CHECKS);

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
  return readdirSync(new URL(prefix,`file://${ROOT}`))
    .filter(name=>/^verify-.+\.mjs$/.test(name))
    .map(name=>prefix+name);
}

export function discoverChecks() {
  const found=[...list(''),...list('docs')].sort();
  const known=new Set([...found,...EXTRA_CHECKS]);
  const stale=[...Object.keys(SKIPPED_CHECKS),...Object.keys(CHECK_ARGS)].filter(name=>!known.has(name));
  if(stale.length)throw new Error(`scripts/verify-checks.mjs names missing checks: ${stale.join(', ')}`);
  return [...EXTRA_CHECKS,...found]
    .filter(name=>!(name in SKIPPED_CHECKS))
    .map(name=>({name,args:[name,...(CHECK_ARGS[name]??[])]}));
}
