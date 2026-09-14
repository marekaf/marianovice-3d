export function placeVRHead(THREE,rig,headWorld,targetFoot){
  const position=rig.getWorldPosition(new THREE.Vector3());
  position.x+=targetFoot.x-headWorld.x;
  position.z+=targetFoot.z-headWorld.z;
  position.y=targetFoot.y;
  if(rig.parent)rig.parent.worldToLocal(position);
  rig.position.copy(position);
  rig.updateWorldMatrix(false,true);
}

export function rotateVRRig(THREE,rig,headWorld,angle){
  const position=rig.getWorldPosition(new THREE.Vector3()),floorY=position.y;
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
  const orientation=rig.getWorldQuaternion(new THREE.Quaternion()).premultiply(rotation);
  position.sub(headWorld).applyQuaternion(rotation).add(headWorld);
  position.y=floorY;
  if(rig.parent){
    rig.parent.worldToLocal(position);
    orientation.premultiply(rig.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  }
  rig.position.copy(position);
  rig.quaternion.copy(orientation);
  rig.updateWorldMatrix(false,true);
}

export function createVRTeleportValidator({data,floorY,canStandAt,radius=.22}){
  return function(point){
    if(!point||![point.x,point.y,point.z].every(Number.isFinite)||Math.abs(point.y-floorY)>.08)return false;
    const x=point.x-data.originPlot.x,z=point.z-data.originPlot.z;
    let inside=false;
    for(let i=0,j=data.outline.length-1;i<data.outline.length;j=i++){
      const [ax,az]=data.outline[j],[bx,bz]=data.outline[i],dx=bx-ax,dz=bz-az;
      const lengthSquared=dx*dx+dz*dz;
      const t=lengthSquared?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/lengthSquared)):0;
      if(Math.hypot(x-ax-t*dx,z-az-t*dz)<radius)return false;
      if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
    }
    if(!inside)return false;
    const stairs=data.stairs;
    if(stairs&&x>=stairs.x0-radius&&x<=stairs.x1+radius&&z>=stairs.z0-radius&&z<=stairs.z1+radius)return false;
    return canStandAt(point.x,point.z,floorY+1.7);
  };
}
