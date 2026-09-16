import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cutFades} from './walkthrough-fades.mjs';

assert.equal(cutFades([{duration:2}]),'','A single shot has no cuts');
assert.equal(cutFades([{duration:2},{duration:1.5},{duration:3}]),
  'fade=t=out:st=1.500:d=0.5,fade=t=in:st=2.000:d=0.5,fade=t=out:st=3.000:d=0.5,fade=t=in:st=3.500:d=0.5');
assert.equal(cutFades([{duration:2},{duration:2}],0.25),'fade=t=out:st=1.750:d=0.25,fade=t=in:st=2.000:d=0.25');

const encoder=fileURLToPath(new URL('./encode-walkthrough.mjs',import.meta.url));
if(spawnSync('ffmpeg',['-version']).error){
  console.log('Encode walkthrough: fade filter chain passes. ffmpeg is unavailable, so the encode round trips were skipped.');
  process.exit(0);
}
const dir=await mkdtemp(join(tmpdir(),'walkthrough-encode-'));
const started=Date.now()/1000-1;
async function frames(folder,count,size){
  await mkdir(folder,{recursive:true});
  const result=spawnSync('ffmpeg',['-v','error','-y','-f','lavfi','-i',`testsrc=size=${size}:rate=1`,'-frames:v',String(count),'-start_number','0',join(folder,'%05d.png')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
}
function encode(args,env){
  return spawnSync(process.execPath,[encoder,...args],{encoding:'utf8',env:{...process.env,WALKTHROUGH_GENERATED:dir,...env}});
}
try{
  const shots=[{name:'A',duration:2},{name:'B',duration:1}];
  await frames(join(dir,'video-frames-360'),6,'64x64');
  await writeFile(join(dir,'video-render-360.json'),JSON.stringify({state:'completed',preview:false,frame_step:1,
    expected_frames:6,total_frames:6,missing_frames:[],fps:2,resolution:[64,64],projection:'stereo360',stereo_layout:'top-bottom',
    route_shots:shots,output_directory:join(dir,'video-frames-360'),started_at:started}));
  const stereo=encode(['--stereo360']);
  assert.equal(stereo.status,0,stereo.stderr);
  assert.equal(stereo.stdout.trim(),join(dir,'house-walkthrough-360-tb.mp4'));
  const validation=JSON.parse(await readFile(join(dir,'video-validation-360.json'),'utf8'));
  assert.equal(validation.codec,'hevc');
  assert.equal(validation.frames,6);
  assert.equal(validation.stereoLayout,'top-bottom');
  assert.equal(validation.sphericalMetadata,true);
  assert.equal(validation.fadesAtCuts,1);
  assert.equal(validation.roomSubtitles,0);
  const probe=spawnSync('ffprobe',['-v','error','-show_streams','-of','json',validation.output],{encoding:'utf8'});
  const video=JSON.parse(probe.stdout).streams.find(stream=>stream.codec_type==='video');
  assert.equal(video.codec_tag_string,'hvc1');
  assert(video.side_data_list.some(item=>/spherical/i.test(item.side_data_type)),'Encoded file carries spherical metadata');

  const wrong=encode([]);
  assert.notEqual(wrong.status,0,'The flat encoder must refuse a missing flat report');

  await frames(join(dir,'video-frames'),4,'64x36');
  await writeFile(join(dir,'video-render.json'),JSON.stringify({state:'completed',preview:false,frame_step:1,
    expected_frames:4,total_frames:4,missing_frames:[],fps:2,resolution:[64,36],projection:'flat',
    route_shots:[{name:'A',duration:1},{name:'B',duration:1}],output_directory:join(dir,'video-frames'),started_at:started}));
  const flat=encode([]);
  assert.equal(flat.status,0,flat.stderr);
  const flatValidation=JSON.parse(await readFile(join(dir,'video-validation.json'),'utf8'));
  assert.equal(flatValidation.codec,'h264');
  assert.equal(flatValidation.roomSubtitles,2);
  assert.equal(flatValidation.sphericalMetadata,false);
  const mismatch=encode(['--stereo360'],{});
  assert.equal(mismatch.status,0,'Stereo report is still valid after the flat encode');
  await writeFile(join(dir,'video-render-360.json'),JSON.stringify({state:'completed',preview:false,frame_step:1,
    expected_frames:6,total_frames:6,missing_frames:[],fps:2,resolution:[64,64],projection:'flat',
    route_shots:shots,output_directory:join(dir,'video-frames-360'),started_at:started}));
  const crossed=encode(['--stereo360']);
  assert.notEqual(crossed.status,0,'A flat report cannot be encoded as stereo 360');
  assert.match(crossed.stderr,/holds a flat render/);
  console.log('Encode walkthrough: stereo 360 H.265 top-bottom encode with fades and spherical metadata, flat H.264 encode, and projection guards pass.');
}finally{
  await rm(dir,{recursive:true,force:true});
}
