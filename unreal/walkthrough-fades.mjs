// Fade through black at every cut. Hard cuts in stereo 360 read as the whole world jumping.
// ffmpeg's fade filter holds black outside its own window, so each shot is trimmed, faded
// and concatenated instead of chaining fades on one stream.
export function shotFadeGraph(shots,{fps,fadeSeconds=0.5,seconds=Infinity,input='0:v',output='v'}){
  const segments=[];
  let start=0;
  for(const shot of shots){
    const end=Math.min(start+shot.duration,seconds);
    if(end>start)segments.push({start,end});
    start+=shot.duration;
    if(start>=seconds)break;
  }
  if(segments.length<2)return null;
  const labels=segments.map((_,index)=>`[a${index}]`).join('');
  const chains=segments.map(({start,end},index)=>{
    const steps=[`trim=start=${start.toFixed(3)}:end=${end.toFixed(3)}`,'setpts=PTS-STARTPTS'];
    if(index>0)steps.push(`fade=t=in:st=0:d=${fadeSeconds}`);
    if(index<segments.length-1)steps.push(`fade=t=out:st=${(end-start-fadeSeconds).toFixed(3)}:d=${fadeSeconds}`);
    return `[a${index}]${steps.join(',')}[s${index}]`;
  });
  // concat measures a segment by its last timestamp and loses that frame's duration, so
  // frames are re-stamped by index afterwards.
  const concat=segments.map((_,index)=>`[s${index}]`).join('')+`concat=n=${segments.length}:v=1:a=0,setpts=N/${fps}/TB[${output}]`;
  return {graph:`[${input}]split=${segments.length}${labels};${chains.join(';')};${concat}`,cuts:segments.length-1};
}
