import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cwd=fileURLToPath(new URL('../',import.meta.url));
function run(command,args,stdio='inherit') {
  const result=spawnSync(command,args,{cwd,stdio,encoding:'utf8'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
  return result.stdout;
}

const checks=[
  'validate-layout.js',
  'verify-garden-details.mjs',
  'verify-exterior.mjs',
  'verify-exterior-furniture.mjs',
  'verify-room-layout.mjs',
  'verify-room-a-grading.mjs',
  'verify-planting-profiles.mjs',
  'verify-privacy-screens.mjs',
  'verify-portal-drain.mjs',
  'verify-climber-model.mjs',
  'verify-sauna.mjs',
  'verify-pergola.mjs',
  'verify-pergola-approach.mjs',
  'verify-pergola-bedroom-view.mjs',
  'verify-pond-approach.mjs',
  'verify-perennial-sharing.mjs',
  'verify-garage.mjs',
  'verify-garage-roof-ends.mjs',
  'verify-loft-ceiling.mjs',
  'verify-loft-door-floor.mjs',
  'verify-loft-roof-windows.mjs',
  'verify-walk-loft.mjs',
  'verify-walk-facade.mjs',
  'verify-cathedral-roof.mjs',
  'verify-house-roof.mjs',
  'verify-house-roof-export.mjs',
  'verify-roof-wall-cap.mjs',
  'verify-house-chimney.mjs',
  'verify-house-wall-backing.mjs',
  'verify-entrance-jamb.mjs',
  'verify-entrance-controls.mjs',
  'verify-kitchen-upper-modules.mjs',
  'verify-coffee-niche.mjs',
  'verify-dressing-room.mjs',
  'verify-walk-doors.mjs',
  'verify-walk-door-visibility.mjs',
  'verify-walk-collision-height.mjs',
  'verify-walk-levels.mjs',
  'verify-walk-step-support.mjs',
  'verify-walk-portals.mjs',
  'verify-walk-windows.mjs',
  'verify-pocket-doors.mjs',
  'verify-house-wall-layers.mjs',
  'verify-nightstands.mjs',
  'verify-fixtures.mjs',
  'verify-public-runtime.mjs',
  'verify-interior-data.mjs house-interior.js',
  'verify-door-approach.mjs',
  'verify-hoxter-stove.mjs',
  'verify-ravak-freedom.mjs',
  'verify-stair-flight.mjs',
  'verify-kitchen-fronts.mjs',
  'verify-cabinet-finishes.mjs',
  'verify-window-seat-handles.mjs',
  'verify-bedroom-window-reveal.mjs',
  'verify-corona-bed.mjs',
  'verify-driveway-check.mjs',
  'verify-grading-data.mjs',
  'verify-grading-report.mjs',
  'verify-plan-terrain.mjs',
  'verify-grading-layout.mjs',
  'verify-boundary-fence.mjs',
  'verify-terrain-banks.mjs',
  'verify-west-drainage.mjs',
  'verify-garage-bank.mjs',
  'verify-pond-grading.mjs',
  'verify-garden-routes.mjs',
  'verify-route-ground-clipping.mjs',
  'verify-circular-pad-ground.mjs',
  'verify-mesh-height-query.mjs',
  'verify-pond-ground-mesh.mjs',
  'verify-fence-model.mjs',
  'verify-gate-model.mjs',
  'verify-boundary-memory.mjs',
  'verify-utility-pillar.mjs',
  'verify-viewer-loading.mjs',
  'verify-walk-interior-loading.mjs',
  'verify-walk-movement.mjs',
  'verify-render-scheduler.mjs',
  'verify-bathroom-fixtures.mjs',
  'verify-bathroom-vanities.mjs',
  'docs/verify-utility-joinery.mjs',
  'docs/verify-kitchen-spec.mjs',
  'docs/verify-shower-fittings.mjs',
  'docs/verify-utility-rack-placement.mjs',
  'docs/verify-entrance-threshold.mjs',
  'docs/verify-eye-level-walkthrough.mjs',
  'docs/verify-electrical-model.mjs',
  'docs/verify-electrical-points.mjs',
  'verify-greenhouse.mjs',
  'verify-raised-beds.mjs',
  'verify-productive-court.mjs',
  'verify-firepit.mjs',
  'verify-hidden-bench.mjs',
  'verify-site-terrain.mjs',
  'verify-python-json.mjs',
  'generate-svg.js',
  'generate-driveway-check.js',
];

for(const check of checks){
  console.log(`\n> ${check}`);
  run(process.execPath,check.split(' '));
}

// Porcelain also catches staged changes and regenerated files deleted from Git.
const changed=run('git',['status','--porcelain','--','*.svg'],'pipe');
if(changed){
  console.error('Generated SVGs are stale or missing. Review and commit the regenerated drawings.');
  console.error(changed.trimEnd());
  run('git',['--no-pager','diff','--stat','--','*.svg']);
  process.exit(1);
}
console.log('\nAll verification checks passed.');
