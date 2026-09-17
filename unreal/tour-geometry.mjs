// Unreal yaw: degrees about Z, positive turns from +X toward +Y, which is a right turn on screen.
// A panorama is centred on the shot heading, so a hotspot's azimuth is the target's yaw minus it.
const degrees=radians=>radians*180/Math.PI;
export function headingYaw(shot){
  const [x,y]=shot.start,[tx,ty]=shot.targetStart;
  return degrees(Math.atan2(ty-y,tx-x));
}
export function wrapDegrees(value){
  return ((value+180)%360+360)%360-180;
}
export function azimuthTo(shot,other){
  const [x,y]=shot.start,[ox,oy]=other.start;
  return wrapDegrees(degrees(Math.atan2(oy-y,ox-x))-headingYaw(shot));
}
export function distanceTo(shot,other){
  return Math.hypot(...shot.start.map((value,index)=>other.start[index]-value))/100;
}
export function slugOf(name){
  return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
export function buildTour(shots,{stereo,extension='jpg'}){
  const stills=shots.map((shot,index)=>({
    index,name:shot.name,slug:slugOf(shot.name),
    file:`${String(index).padStart(2,'0')}-${slugOf(shot.name)}_360${stereo?'_TB':''}.${extension}`,
    heading:headingYaw(shot),eyeHeightM:shot.start[2]/100,
    hotspots:[index-1,index+1].filter(target=>target>=0&&target<shots.length).map(target=>({
      to:target,label:shots[target].name,azimuth:azimuthTo(shot,shots[target]),distanceM:distanceTo(shot,shots[target]),
    })),
  }));
  return {stereo,layout:stereo?'top-bottom':'mono',projection:'equirectangular',stills};
}
