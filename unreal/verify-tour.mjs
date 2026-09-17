import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {azimuthTo, buildTour, headingYaw, slugOf, wrapDegrees} from './tour-geometry.mjs';

const route=JSON.parse(await readFile(new URL('./walkthrough-route.json',import.meta.url),'utf8'));
const close=(a,b,message)=>assert(Math.abs(a-b)<1e-9,`${message}: ${a} vs ${b}`);
const shot=(start,target)=>({name:'Test',start,targetStart:target});
close(headingYaw(shot([0,0,170],[10,0,170])),0,'Looking along +X is yaw 0');
close(headingYaw(shot([0,0,170],[0,10,170])),90,'Looking along +Y is yaw 90');
close(azimuthTo(shot([0,0,170],[10,0,170]),{start:[0,10,170]}),90,'A target on +Y is a right turn from +X');
close(azimuthTo(shot([0,0,170],[10,0,170]),{start:[0,-10,170]}),-90,'A target on -Y is a left turn from +X');
assert.equal(Math.abs(azimuthTo(shot([0,0,170],[10,0,170]),{start:[-10,0,170]})),180,'A target behind is 180');
close(azimuthTo(shot([0,0,170],[0,-10,170]),{start:[10,0,170]}),90,'Azimuth is relative to the heading');
assert.equal(wrapDegrees(270),-90);
assert.equal(slugOf('1.06 Living'),'1-06-living');

const tour=buildTour(route.shots,{stereo:true});
assert.equal(tour.stills.length,route.shots.length);
assert.equal(tour.stills[0].file,'00-1-01-entrance_360_TB.jpg');
assert.deepEqual(tour.stills[0].hotspots.map(h=>h.to),[1],'The first still links forward only');
assert.deepEqual(tour.stills.at(-1).hotspots.map(h=>h.to),[tour.stills.length-2],'The last still links back only');
assert(tour.stills.slice(1,-1).every(still=>still.hotspots.length===2),'Middle stills link both ways');
for(const still of tour.stills)for(const hotspot of still.hotspots){
  assert(hotspot.azimuth>=-180&&hotspot.azimuth<=180&&hotspot.distanceM>0,`${still.name}: hotspot to ${hotspot.label} is well formed`);
}
assert.equal(buildTour(route.shots,{stereo:false}).stills[3].file,'03-1-04-guest-room_360.jpg');
assert.equal(new Set(tour.stills.map(still=>still.file)).size,tour.stills.length,'Still file names are unique');

if(spawnSync('ffmpeg',['-version']).error){
  console.log('Tour: geometry and manifest pass. ffmpeg is unavailable, so the image export was skipped.');
  process.exit(0);
}
const exporter=fileURLToPath(new URL('./export-tour.mjs',import.meta.url));
const dir=await mkdtemp(join(tmpdir(),'tour-export-'));
try{
  const started=Date.now()/1000-1;
  const shots=route.shots.slice(0,3).map(s=>({...s,duration:1/30,end:s.start,targetEnd:s.targetStart}));
  for(const eye of ['left','right']){
    await mkdir(join(dir,'video-frames-360',eye),{recursive:true});
    const colour=eye==='left'?'green':'blue';
    const result=spawnSync('ffmpeg',['-v','error','-y','-f','lavfi','-i',`color=c=${colour}:size=64x32:rate=1`,'-frames:v','3','-start_number','0',join(dir,'video-frames-360',eye,'%05d.png')],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
  }
  const report={state:'completed',stills:true,projection:'stereo360',preview:false,frame_step:1,expected_frames:3,total_frames:3,missing_frames:[],
    resolution:[64,32],exposure_bias:-4,route_shots:shots,started_at:started,
    eye_directories:{left:join(dir,'video-frames-360','left'),right:join(dir,'video-frames-360','right')}};
  await writeFile(join(dir,'video-render-360.json'),JSON.stringify(report));
  const exported=spawnSync(process.execPath,[exporter],{encoding:'utf8',env:{...process.env,WALKTHROUGH_GENERATED:dir}});
  assert.equal(exported.status,0,exported.stderr);
  const manifest=JSON.parse(await readFile(join(dir,'tour','tour.json'),'utf8'));
  assert.equal(manifest.stills.length,3);
  assert.equal(manifest.stereo,true);
  assert.equal(manifest.exposureBias,-4);
  assert.deepEqual(manifest.stills.map(still=>[still.width,still.height]),[[64,64],[64,64],[64,64]],'Stereo stills stack to 1:1');
  const probe=spawnSync('ffmpeg',['-v','error','-i',join(dir,'tour',manifest.stills[0].file),'-f','rawvideo','-pix_fmt','rgb24','-'],{encoding:'latin1',maxBuffer:1<<22});
  const pixels=Buffer.from(probe.stdout,'latin1');
  const top=pixels.subarray(0,3),bottom=pixels.subarray(64*63*3,64*63*3+3);
  assert(top[1]>top[2]&&bottom[2]>bottom[1],'Left eye is the top half, right eye the bottom half');
  await writeFile(join(dir,'video-render-360.json'),JSON.stringify({...report,stills:false}));
  assert.notEqual(spawnSync(process.execPath,[exporter],{encoding:'utf8',env:{...process.env,WALKTHROUGH_GENERATED:dir}}).status,0,'A video render is not a tour');
  console.log('Tour: heading and azimuth geometry, manifest links, and the stereo still export pass.');
}finally{
  await rm(dir,{recursive:true,force:true});
}
