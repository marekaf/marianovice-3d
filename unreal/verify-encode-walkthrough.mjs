import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {shotFadeGraph} from './walkthrough-fades.mjs';

assert.equal(shotFadeGraph([{duration:2}],{fps:2}),null,'A single shot has no cuts');
assert.equal(shotFadeGraph([{duration:2},{duration:3}],{fps:2,seconds:1}),null,'A preview inside the first shot has no cuts');
assert.deepEqual(shotFadeGraph([{duration:2},{duration:1.5},{duration:3}],{fps:2}),{cuts:2,graph:
  '[0:v]split=3[a0][a1][a2];'+
  '[a0]trim=start=0.000:end=2.000,setpts=PTS-STARTPTS,fade=t=out:st=1.500:d=0.5[s0];'+
  '[a1]trim=start=2.000:end=3.500,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.5,fade=t=out:st=1.000:d=0.5[s1];'+
  '[a2]trim=start=3.500:end=6.500,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.5[s2];'+
  '[s0][s1][s2]concat=n=3:v=1:a=0,setpts=N/2/TB[v]'});
assert.deepEqual(shotFadeGraph([{duration:2},{duration:2}],{fps:30,fadeSeconds:0.25,seconds:3,input:'eyes',output:'out'}),{cuts:1,graph:
  '[eyes]split=2[a0][a1];'+
  '[a0]trim=start=0.000:end=2.000,setpts=PTS-STARTPTS,fade=t=out:st=1.750:d=0.25[s0];'+
  '[a1]trim=start=2.000:end=3.000,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.25[s1];'+
  '[s0][s1]concat=n=2:v=1:a=0,setpts=N/30/TB[out]'});

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
  await frames(join(dir,'video-frames-360','left'),6,'64x32');
  await frames(join(dir,'video-frames-360','right'),6,'64x32');
  const stereoReport={state:'completed',preview:false,frame_step:1,
    expected_frames:6,total_frames:6,missing_frames:[],fps:2,resolution:[64,32],projection:'stereo360',stereo_layout:'top-bottom',
    eye_directories:{left:join(dir,'video-frames-360','left'),right:join(dir,'video-frames-360','right')},
    route_shots:shots,output_directory:join(dir,'video-frames-360'),started_at:started};
  await writeFile(join(dir,'video-render-360.json'),JSON.stringify(stereoReport));
  const stereo=encode(['--stereo360']);
  assert.equal(stereo.status,0,stereo.stderr);
  assert.equal(stereo.stdout.trim(),join(dir,'house-walkthrough-360-tb.mp4'));
  const validation=JSON.parse(await readFile(join(dir,'video-validation-360.json'),'utf8'));
  assert.equal(validation.codec,'hevc');
  assert.equal(validation.frames,6);
  assert.equal(validation.width,64);
  assert.equal(validation.height,64,'Left and right eyes stack into a square frame');
  assert.equal(validation.stereoLayout,'top-bottom');
  assert.equal(validation.sphericalMetadata,true);
  assert.equal(validation.fadesAtCuts,1);
  assert.equal(validation.roomSubtitles,0);
  const mid=spawnSync('ffmpeg',['-v','error','-ss','1.25','-i',validation.output,'-frames:v','1','-f','rawvideo','-pix_fmt','gray','-'],{encoding:'latin1',maxBuffer:1<<20});
  assert(Buffer.from(mid.stdout,'latin1').some(byte=>byte>32),'Frames inside a shot stay visible after the fade graph');
  const cut=spawnSync('ffmpeg',['-v','error','-ss','2.0','-i',validation.output,'-frames:v','1','-f','rawvideo','-pix_fmt','gray','-'],{encoding:'latin1',maxBuffer:1<<20});
  assert(Buffer.from(cut.stdout,'latin1').every(byte=>byte<=24),'The first frame after a cut starts black');
  const probe=spawnSync('ffprobe',['-v','error','-show_streams','-of','json',validation.output],{encoding:'utf8'});
  const video=JSON.parse(probe.stdout).streams.find(stream=>stream.codec_type==='video');
  assert.equal(video.codec_tag_string,'hvc1');
  assert(video.side_data_list.some(item=>/spherical/i.test(item.side_data_type)),'Encoded file carries spherical metadata');

  const wrong=encode([]);
  assert.notEqual(wrong.status,0,'The flat encoder must refuse a missing flat report');

  await writeFile(join(dir,'video-render-360.json'),JSON.stringify({...stereoReport,projection:'mono360',stereo_layout:null,
    eye_directories:{'':join(dir,'video-frames-360','left')}}));
  const mono=encode(['--mono360']);
  assert.equal(mono.status,0,mono.stderr);
  const monoValidation=JSON.parse(await readFile(join(dir,'video-validation-360.json'),'utf8'));
  assert.equal(monoValidation.output,join(dir,'house-walkthrough-360.mp4'));
  assert.equal(monoValidation.height,32);
  assert.equal(monoValidation.stereoLayout,null);
  assert.equal(monoValidation.sphericalMetadata,true);
  await writeFile(join(dir,'video-render-360.json'),JSON.stringify({...stereoReport,preview:true,expected_frames:2}));
  const previewRefused=encode(['--stereo360']);
  assert.notEqual(previewRefused.status,0,'A preview render needs the --preview flag');
  const previewEncode=encode(['--stereo360','--preview']);
  assert.equal(previewEncode.status,0,previewEncode.stderr);
  assert.equal(previewEncode.stdout.trim(),join(dir,'house-walkthrough-360-tb-preview.mp4'));
  const previewValidation=JSON.parse(await readFile(join(dir,'video-validation-360-preview.json'),'utf8'));
  assert.equal(previewValidation.frames,2);
  assert.equal(previewValidation.preview,true);
  const monoOnStereo=encode(['--stereo360']);
  assert.notEqual(monoOnStereo.status,0,'A mono report cannot be encoded as stereo');
  await writeFile(join(dir,'video-render-360.json'),JSON.stringify(stereoReport));

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
  await writeFile(join(dir,'video-render-360.json'),JSON.stringify({...stereoReport,projection:'flat'}));
  const crossed=encode(['--stereo360']);
  assert.notEqual(crossed.status,0,'A flat report cannot be encoded as stereo 360');
  assert.match(crossed.stderr,/holds a flat render/);
  console.log('Encode walkthrough: stereo 360 stacks two eyes into H.265 top-bottom with fades and spherical metadata, mono 360 and flat H.264 encodes work, and projection guards pass.');
}finally{
  await rm(dir,{recursive:true,force:true});
}
