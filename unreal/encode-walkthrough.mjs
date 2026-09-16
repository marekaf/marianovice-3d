import assert from 'node:assert/strict';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {injectSphericalMetadata} from './spherical-metadata.mjs';
import {cutFades} from './walkthrough-fades.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const generated=process.env.WALKTHROUGH_GENERATED?resolve(process.env.WALKTHROUGH_GENERATED):resolve(root,'generated');
const projection=process.argv.includes('--stereo360')?'stereo360':'flat';
const stereo=projection==='stereo360';
const reportPath=resolve(generated,stereo?'video-render-360.json':'video-render.json');
const report=JSON.parse(await readFile(reportPath,'utf8'));
assert.equal(report.state,'completed','Render must complete before encoding');
assert.equal(report.preview,false,'Cannot encode a preview as the full walkthrough');
assert.equal(report.frame_step,1,'Cannot encode sparse storyboard frames');
assert.equal(report.expected_frames,report.total_frames);
assert.deepEqual(report.missing_frames,[]);
assert.equal(report.projection??'flat',projection,`${reportPath} holds a ${report.projection??'flat'} render`);
const frames=resolve(report.output_directory??resolve(generated,'video-frames'));
for(let frame=0;frame<report.total_frames;frame++){
  const info=await stat(resolve(frames,`${String(frame).padStart(5,'0')}.png`));
  assert(info.size>0&&info.mtimeMs>=report.started_at*1000,`Missing or stale frame ${frame}`);
}
const shots=report.route_shots;
assert(Array.isArray(shots)&&shots.length>0,'Render must include its route snapshot');
assert.equal(Math.round(shots.reduce((sum,shot)=>sum+shot.duration,0)*report.fps),report.total_frames);
if(stereo){
  assert.equal(report.stereo_layout,'top-bottom');
  assert.equal(report.resolution[0],report.resolution[1],'Top-bottom stereo 360 frames must be square');
}
function run(command,args){
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.error)throw result.error;
  assert.equal(result.status,0,result.stderr);
  return result.stdout;
}
const output=resolve(generated,stereo?'house-walkthrough-360-tb.mp4':'house-walkthrough.mp4');
const input=['-hide_banner','-loglevel','error','-y','-framerate',String(report.fps),'-i',resolve(frames,'%05d.png')];
if(stereo){
  // Subtitles are omitted: 360 players draw them across the seam, not in front of the viewer.
  // hvc1 tagging lets Quest, macOS and iOS players open the H.265 stream.
  run('ffmpeg',[...input,'-vf',cutFades(shots),'-frames:v',String(report.total_frames),
    '-c:v','libx265','-preset','medium','-crf','20','-pix_fmt','yuv420p','-tag:v','hvc1',
    '-x265-params','log-level=error','-movflags','+faststart',output]);
  const tagged=injectSphericalMetadata(await readFile(output),{stereo:'top-bottom'});
  await writeFile(output,tagged.buffer);
}else{
  const stamp=seconds=>new Date(Math.round(seconds*1000)).toISOString().slice(11,23).replace('.',',');
  let elapsed=0;
  const subtitles=shots.map((shot,index)=>{
    const start=elapsed;elapsed+=shot.duration;
    return `${index+1}\n${stamp(start)} --> ${stamp(elapsed)}\n${shot.name}\n`;
  }).join('\n');
  const subtitlePath=resolve(generated,'walkthrough-rooms.srt');
  await writeFile(subtitlePath,subtitles);
  run('ffmpeg',[...input,'-i',subtitlePath,
    '-map','0:v:0','-map','1:s:0','-frames:v',String(report.total_frames),
    '-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',
    '-c:s','mov_text','-metadata:s:s:0','language=eng','-movflags','+faststart',output]);
}
const probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output]));
const video=probe.streams.find(stream=>stream.codec_type==='video');
assert.equal(video.width,report.resolution[0]);
assert.equal(video.height,report.resolution[1]);
assert.equal(Number(video.nb_frames),report.total_frames);
assert(Math.abs(Number(probe.format.duration)-report.total_frames/report.fps)<.1);
const sideData=video.side_data_list??[];
if(stereo){
  assert.equal(video.codec_name,'hevc');
  assert.equal(sideData.find(item=>/spherical/i.test(item.side_data_type))?.projection,'equirectangular','Spherical metadata must survive the write');
  assert.match(sideData.find(item=>/stereo/i.test(item.side_data_type))?.type??'',/top.*bottom/i);
}
run('ffmpeg',['-v','error','-i',output,'-map','0:v:0','-f','null','-']);
await writeFile(resolve(generated,stereo?'video-validation-360.json':'video-validation.json'),JSON.stringify({
  status:'passed',output,projection,width:video.width,height:video.height,frames:Number(video.nb_frames),
  seconds:Number(probe.format.duration),codec:video.codec_name,bytes:Number(probe.format.size),
  decodedWithoutErrors:true,roomSubtitles:stereo?0:shots.length,
  stereoLayout:stereo?'top-bottom':null,sphericalMetadata:stereo,fadesAtCuts:stereo?shots.length-1:0,
},null,2));
console.log(output);
