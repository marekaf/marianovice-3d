import assert from 'node:assert/strict';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {injectSphericalMetadata} from './spherical-metadata.mjs';
import {shotFadeGraph} from './walkthrough-fades.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const generated=process.env.WALKTHROUGH_GENERATED?resolve(process.env.WALKTHROUGH_GENERATED):resolve(root,'generated');
const projection=process.argv.includes('--stereo360')?'stereo360':process.argv.includes('--mono360')?'mono360':'flat';
const panoramic=projection!=='flat',stereo=projection==='stereo360',preview=process.argv.includes('--preview');
const reportPath=resolve(generated,panoramic?'video-render-360.json':'video-render.json');
const report=JSON.parse(await readFile(reportPath,'utf8'));
assert.equal(report.state,'completed','Render must complete before encoding');
assert.equal(report.preview,preview,preview?'Pass --preview only for a preview render':'Cannot encode a preview as the full walkthrough');
assert.equal(report.frame_step,1,'Cannot encode sparse storyboard frames');
if(!preview)assert.equal(report.expected_frames,report.total_frames);
const frameCount=report.expected_frames;
assert.deepEqual(report.missing_frames,[]);
assert.equal(report.projection??'flat',projection,`${reportPath} holds a ${report.projection??'flat'} render`);
const eyes=report.eye_directories??{'':report.output_directory??resolve(generated,'video-frames')};
const eyeOrder=stereo?['left','right']:[''];
assert.deepEqual(Object.keys(eyes).sort(),[...eyeOrder].sort(),`${projection} needs frame folders for ${eyeOrder.join(', ')||'one eye'}`);
for(const eye of eyeOrder)for(let frame=0;frame<frameCount;frame++){
  const info=await stat(resolve(eyes[eye],`${String(frame).padStart(5,'0')}.png`));
  assert(info.size>0&&info.mtimeMs>=report.started_at*1000,`Missing or stale ${eye||'frame'} ${frame}`);
}
const shots=report.route_shots;
assert(Array.isArray(shots)&&shots.length>0,'Render must include its route snapshot');
assert.equal(Math.round(shots.reduce((sum,shot)=>sum+shot.duration,0)*report.fps),report.total_frames);
if(preview)assert.equal(frameCount,Math.min(report.fps,report.total_frames),'A preview holds one second of frames');
if(panoramic)assert.equal(report.resolution[0],report.resolution[1]*2,'Equirectangular frames must be 2:1');
if(stereo)assert.equal(report.stereo_layout,'top-bottom');
function run(command,args){
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.error)throw result.error;
  assert.equal(result.status,0,result.stderr);
  return result.stdout;
}
const names={flat:'house-walkthrough.mp4',mono360:'house-walkthrough-360.mp4',stereo360:'house-walkthrough-360-tb.mp4'};
const output=resolve(generated,preview?names[projection].replace('.mp4','-preview.mp4'):names[projection]);
const inputs=eyeOrder.flatMap(eye=>['-framerate',String(report.fps),'-i',resolve(eyes[eye],'%05d.png')]);
const common=['-hide_banner','-loglevel','error','-y',...inputs];
const expected=[report.resolution[0],report.resolution[1]*(stereo?2:1)];
const fades=panoramic?shotFadeGraph(shots,{fps:report.fps,seconds:frameCount/report.fps,input:stereo?'eyes':'0:v'}):null;
if(panoramic){
  // Subtitles are omitted: 360 players draw them across the seam, not in front of the viewer.
  // hvc1 tagging lets Quest, macOS and iOS players open the H.265 stream.
  const stacked=stereo?'[0:v][1:v]vstack=inputs=2[eyes];':'';
  const filter=stacked+(fades?fades.graph:stereo?'[eyes]null[v]':'[0:v]null[v]');
  run('ffmpeg',[...common,'-filter_complex',filter,'-map','[v]','-r',String(report.fps),'-frames:v',String(frameCount),
    '-c:v','libx265','-preset','slow','-crf','16','-pix_fmt','yuv420p','-tag:v','hvc1',
    '-x265-params','log-level=error','-movflags','+faststart',output]);
  const tagged=injectSphericalMetadata(await readFile(output),{stereo:stereo?'top-bottom':'none'});
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
  run('ffmpeg',[...common,'-i',subtitlePath,
    '-map','0:v:0','-map','1:s:0','-frames:v',String(frameCount),
    '-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',
    '-c:s','mov_text','-metadata:s:s:0','language=eng','-movflags','+faststart',output]);
}
const probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output]));
const video=probe.streams.find(stream=>stream.codec_type==='video');
assert.equal(video.width,expected[0]);
assert.equal(video.height,expected[1]);
assert.equal(Number(video.nb_frames),frameCount);
assert(Math.abs(Number(probe.format.duration)-frameCount/report.fps)<.1);
const sideData=video.side_data_list??[];
if(panoramic){
  assert.equal(video.codec_name,'hevc');
  assert.equal(sideData.find(item=>/spherical/i.test(item.side_data_type))?.projection,'equirectangular','Spherical metadata must survive the write');
  const stereoData=sideData.find(item=>/stereo/i.test(item.side_data_type));
  if(stereo)assert.match(stereoData?.type??'',/top.*bottom/i);
  else assert.doesNotMatch(stereoData?.type??'',/top.*bottom|side.*side/i);
}
run('ffmpeg',['-v','error','-i',output,'-map','0:v:0','-f','null','-']);
await writeFile(resolve(generated,(panoramic?'video-validation-360':'video-validation')+(preview?'-preview':'')+'.json'),JSON.stringify({
  status:'passed',output,projection,preview,width:video.width,height:video.height,frames:Number(video.nb_frames),
  seconds:Number(probe.format.duration),codec:video.codec_name,bytes:Number(probe.format.size),
  decodedWithoutErrors:true,roomSubtitles:panoramic?0:shots.length,
  stereoLayout:stereo?'top-bottom':null,sphericalMetadata:panoramic,fadesAtCuts:fades?fades.cuts:0,
},null,2));
console.log(output);
