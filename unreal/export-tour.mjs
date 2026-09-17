import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {buildTour} from './tour-geometry.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const generated=process.env.WALKTHROUGH_GENERATED?resolve(process.env.WALKTHROUGH_GENERATED):resolve(root,'generated');
const report=JSON.parse(await readFile(resolve(generated,'video-render-360.json'),'utf8'));
assert.equal(report.state,'completed','Render must complete before exporting');
assert.equal(report.stills,true,'The tour export needs a stills render');
assert.deepEqual(report.missing_frames,[]);
assert(['mono360','stereo360'].includes(report.projection),'The tour needs a 360 render');
const stereo=report.projection==='stereo360';
const eyeOrder=stereo?['left','right']:[''];
const shots=report.route_shots;
assert.equal(report.total_frames,shots.length);
for(const eye of eyeOrder)for(let frame=0;frame<shots.length;frame++){
  const info=await stat(resolve(report.eye_directories[eye],`${String(frame).padStart(5,'0')}.png`));
  assert(info.size>0&&info.mtimeMs>=report.started_at*1000,`Missing or stale ${eye||'frame'} ${frame}`);
}
function run(args){
  const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});
  if(result.error)throw result.error;
  assert.equal(result.status,0,result.stderr);
}
const tour=buildTour(shots,{stereo});
const folder=resolve(generated,'tour');
await mkdir(folder,{recursive:true});
for(const still of tour.stills){
  const frame=`${String(still.index).padStart(5,'0')}.png`;
  const inputs=eyeOrder.flatMap(eye=>['-i',resolve(report.eye_directories[eye],frame)]);
  const graph=stereo?['-filter_complex','[0:v][1:v]vstack=inputs=2[v]','-map','[v]']:[];
  run([...inputs,...graph,'-q:v','2',resolve(folder,still.file)]);
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','stream=width,height','-of','csv=p=0',resolve(folder,still.file)],{encoding:'utf8'});
  const [width,height]=probe.stdout.trim().split(',').map(Number);
  assert.equal(width,report.resolution[0]);
  assert.equal(height,report.resolution[1]*(stereo?2:1));
  still.width=width;still.height=height;
}
tour.resolution=report.resolution;
tour.exposureBias=report.exposure_bias??0;
await writeFile(resolve(folder,'tour.json'),JSON.stringify(tour,null,2));
console.log(`${folder}: ${tour.stills.length} ${stereo?'stereo':'mono'} stills`);
