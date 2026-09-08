export function doorApproach({axis,from,width,zone,furniture}) {
  const spans=[];
  for(const f of furniture){
    if((f.y0??0)>=1.97)continue;
    const ox=Math.min(zone.x1,f.x1)-Math.max(zone.x0,f.x0);
    const oz=Math.min(zone.z1,f.z1)-Math.max(zone.z0,f.z0);
    if(ox<=.05||oz<=.05)continue;
    spans.push([Math.max(from,axis==='x'?f.x0:f.z0),Math.min(from+width,axis==='x'?f.x1:f.z1)]);
  }
  let cursor=from,clear=0;
  for(const [start,end] of spans.sort((a,b)=>a[0]-b[0])){
    clear=Math.max(clear,start-cursor);
    cursor=Math.max(cursor,end);
  }
  clear=Math.max(clear,from+width-cursor);
  return {clear,intrusions:spans.length};
}
