export function stepSupportHeight(surfaces,x,z,radius=.18){
  let height=-Infinity;
  for(const surface of surfaces){
    const dx=x-Math.max(surface.x0,Math.min(surface.x1,x));
    const dz=z-Math.max(surface.z0,Math.min(surface.z1,z));
    if(Math.hypot(dx,dz)<radius-1e-7)height=Math.max(height,surface.y);
  }
  return height;
}
