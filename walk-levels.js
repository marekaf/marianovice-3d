export function createWalkLevels({data,loftData,floorY,groundHeight,canStandAt,headroomAt,eyeHeight=1.7,radius=.18}) {
  const stairs=data.stairs,origin=data.originPlot;
  if(stairs.toward!=='E')throw new Error('Walking stairs require an eastward flight');
  const going=(stairs.x1-stairs.x0)/stairs.steps,loftHeight=floorY+loftData.floorY+.00375;
  const headSamples=[[0,0],...Array.from({length:8},(_,i)=>[radius*Math.cos(i*Math.PI/4),radius*Math.sin(i*Math.PI/4)])];
  let state={surface:'ground',footY:floorY,stairIndex:null};
  const stairLane=z=>z>=stairs.z0+radius&&z<=stairs.z1-radius;
  const inStairs=(x,z)=>x>=stairs.x0&&x<stairs.x1&&z>=stairs.z0&&z<=stairs.z1;
  const unsupported=loftData.floorHoles.flatMap(hole=>{
    const x0=Math.max(hole.x0,stairs.x0),x1=Math.min(hole.x1,stairs.x1);
    const z0=Math.max(hole.z0,stairs.z0),z1=Math.min(hole.z1,stairs.z1);
    if(x0>=x1||z0>=z1)return [hole];
    return [{x0:hole.x0,x1:hole.x1,z0:hole.z0,z1:z0},{x0:hole.x0,x1:hole.x1,z0:z1,z1:hole.z1},
      {x0:hole.x0,x1:x0,z0,z1},{x0:x1,x1:hole.x1,z0,z1}].filter(r=>r.x1>r.x0&&r.z1>r.z0);
  });
  function loftSupported(x,z){
    let inside=false;
    for(let i=0,j=loftData.outline.length-1;i<loftData.outline.length;j=i++){
      const [ax,az]=loftData.outline[j],[bx,bz]=loftData.outline[i],dx=bx-ax,dz=bz-az;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
      if(Math.hypot(x-ax-t*dx,z-az-t*dz)<radius-1e-8)return false;
      if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
    }
    return inside&&!unsupported.some(r=>Math.hypot(x-Math.max(r.x0,Math.min(r.x1,x)),z-Math.max(r.z0,Math.min(r.z1,z)))<radius-1e-8);
  }
  function candidate(x,z,previousX) {
    const lx=x-origin.x,lz=z-origin.z,px=previousX-origin.x;
    let surface=state.surface;
    if(surface==='ground'&&inStairs(lx,lz)){
      if(px>=stairs.x0||!stairLane(lz))return null;
      surface='stairs';
    }else if(surface==='loft'&&inStairs(lx,lz)){
      if(px<stairs.x1||!stairLane(lz))return null;
      surface='stairs';
    }else if(surface==='stairs'){
      if(!stairLane(lz))return null;
      if(lx<stairs.x0)surface='ground';
      else if(lx>=stairs.x1)surface='loft';
    }
    const stairIndex=surface==='stairs'?Math.min(stairs.steps-1,Math.floor((lx-stairs.x0)/going)):null;
    if(surface==='loft'&&!loftSupported(lx,lz))return null;
    const footY=surface==='stairs'?floorY+(stairIndex+1)*stairs.rise+.0025:surface==='loft'?loftHeight:groundHeight(x,z);
    if((state.surface==='stairs'||surface==='stairs')&&Math.abs(footY-state.footY)>stairs.rise+.004)return null;
    const eyeY=footY+eyeHeight;
    if(!canStandAt(x,z,eyeY)||headSamples.some(([dx,dz])=>eyeY+.05>headroomAt(x+dx,z+dz)))return null;
    return {surface,footY,stairIndex};
  }
  function reset(position){
    state={surface:'ground',footY:groundHeight(position.x,position.z),stairIndex:null};
    position.y=state.footY+eyeHeight;
  }
  function constrain(position,previousX,previousZ){
    const dx=position.x-previousX,dz=position.z-previousZ,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.05));
    position.x=previousX;position.z=previousZ;
    for(let step=0;step<steps;step++)for(const [x,z]of [[dx/steps,0],[0,dz/steps]]){
      if(x===0&&z===0)continue;
      const next=candidate(position.x+x,position.z+z,position.x);
      if(!next)continue;
      position.x+=x;position.z+=z;state=next;position.y=state.footY+eyeHeight;
    }
  }
  return {reset,constrain,get state(){return {...state};}};
}
