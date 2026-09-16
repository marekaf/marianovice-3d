// Fade through black at every cut. Hard cuts in stereo 360 read as the whole world jumping.
export function cutFades(shots,fadeSeconds=0.5){
  const filters=[];
  let elapsed=0;
  shots.forEach((shot,index)=>{
    if(index>0)filters.push(`fade=t=in:st=${elapsed.toFixed(3)}:d=${fadeSeconds}`);
    elapsed+=shot.duration;
    if(index<shots.length-1)filters.push(`fade=t=out:st=${(elapsed-fadeSeconds).toFixed(3)}:d=${fadeSeconds}`);
  });
  return filters.join(',');
}
