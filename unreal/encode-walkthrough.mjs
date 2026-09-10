import assert from 'node:assert/strict';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

const root=dirname(fileURLToPath(import.meta.url));
const generated=resolve(root,'generated');
const report=JSON.parse(await readFile(resolve(generated,'video-render.json'),'utf8'));
assert.equal(report.state,'completed','Render must complete before encoding');
assert.equal(report.preview,false,'Cannot encode a preview as the full walkthrough');
assert.equal(report.frame_step,1,'Cannot encode sparse storyboard frames');
assert.equal(report.expected_frames,report.total_frames);
assert.deepEqual(report.missing_frames,[]);
for(let frame=0;frame<report.total_frames;frame++){
  const info=await stat(resolve(generated,'video-frames',`${String(frame).padStart(5,'0')}.png`));
  assert(info.size>0&&info.mtimeMs>=report.started_at*1000,`Missing or stale frame ${frame}`);
}
const shots=report.route_shots;
assert(Array.isArray(shots)&&shots.length>0,'Render must include its route snapshot');
assert.equal(Math.round(shots.reduce((sum,shot)=>sum+shot.duration,0)*report.fps),report.total_frames);
const stamp=seconds=>new Date(Math.round(seconds*1000)).toISOString().slice(11,23).replace('.',',');
let elapsed=0;
const subtitles=shots.map((shot,index)=>{
  const start=elapsed;elapsed+=shot.duration;
  return `${index+1}\n${stamp(start)} --> ${stamp(elapsed)}\n${shot.name}\n`;
}).join('\n');
const subtitlePath=resolve(generated,'walkthrough-rooms.srt');
await writeFile(subtitlePath,subtitles);
const output=resolve(generated,'house-walkthrough.mp4');
function run(command,args){
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.error)throw result.error;
  assert.equal(result.status,0,result.stderr);
  return result.stdout;
}
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(report.fps),
  '-i',resolve(generated,'video-frames','%05d.png'),'-i',subtitlePath,
  '-map','0:v:0','-map','1:s:0','-frames:v',String(report.total_frames),
  '-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',
  '-c:s','mov_text','-metadata:s:s:0','language=eng','-movflags','+faststart',output]);
const probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output]));
const video=probe.streams.find(stream=>stream.codec_type==='video');
assert.equal(video.width,report.resolution[0]);
assert.equal(video.height,report.resolution[1]);
assert.equal(Number(video.nb_frames),report.total_frames);
assert(Math.abs(Number(probe.format.duration)-report.total_frames/report.fps)<.1);
run('ffmpeg',['-v','error','-i',output,'-map','0:v:0','-f','null','-']);
await writeFile(resolve(generated,'video-validation.json'),JSON.stringify({
  status:'passed',output,width:video.width,height:video.height,frames:Number(video.nb_frames),
  seconds:Number(probe.format.duration),codec:video.codec_name,bytes:Number(probe.format.size),
  decodedWithoutErrors:true,roomSubtitles:shots.length,
},null,2));
console.log(output);
