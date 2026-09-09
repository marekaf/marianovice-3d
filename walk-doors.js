export function buildWalkingDoor(THREE,model,buildModel) {
  if(!model.doorMotion)return buildModel(THREE,model);
  const moving=new Set(model.doorMotion.movingParts);
  const group=buildModel(THREE,{...model,parts:model.parts.map(part=>({...part,category:moving.has(part.name)?'doorLeaf':part.category}))});
  const leaf=group.userData.categories.doorLeaf;
  const pivot=new THREE.Group();pivot.name=`${model.name}_${model.doorMotion.kind==='slide'?'slide':'hinge'}`;
  pivot.position.fromArray(model.doorMotion.pivot);
  leaf.position.copy(pivot.position).multiplyScalar(-1);
  group.add(pivot);pivot.add(leaf);
  const fixed=model.parts.filter(part=>!moving.has(part.name));
  const panel=model.parts.find(part=>part.name===`${model.name}_leaf`);
  const movingPanels=model.parts.filter(part=>moving.has(part.name));
  group.userData.walkDoor={id:model.name,opening:model.opening,pivot,leaf,model,fixed,panel,movingPanels,open:false};
  return group;
}

export function createWalkDoors(THREE,{data,doors,floorY}) {
  const origin=data.originPlot,radius=.18;
  const scratch=new THREE.Vector3(),direction=new THREE.Vector3(),inverse=new THREE.Matrix4();
  const raycaster=new THREE.Raycaster();raycaster.far=2;
  const walls=[...data.extWalls,...data.intWalls].map(wall=>({...wall,passages:wall.openings.filter((opening,index)=>{
    const model=data.buildOpening(wall,opening,index);
    return !opening.sill&&opening.h>=1.9&&(!model||model.opening.kind!=='window'||model.opening.sliding);
  })}));
  const overlap=(x,z,x0,z0,x1,z1)=>Math.hypot(x-Math.max(x0,Math.min(x1,x)),z-Math.max(z0,Math.min(z1,z)))<radius-1e-7;
  function partBlocks(part,x,z){
    const [px,pz,py]=part.position,[w,d,h]=part.size;
    if(py+h/2<.12||py-h/2>1.7)return false;
    return overlap(x,z,px-w/2,pz-d/2,px+w/2,pz+d/2);
  }
  function doorBlocks(group,x,z,progress=group.userData.walkDoor.open?1:0){
    const door=group.userData.walkDoor;
    group.updateWorldMatrix(true,false);
    scratch.set(x,floorY+1,z).applyMatrix4(inverse.copy(group.matrixWorld).invert());
    const localX=scratch.x,localZ=scratch.z;
    if(door.fixed.some(part=>partBlocks(part,localX,localZ)))return true;
    const motion=door.model.doorMotion;
    if(motion.kind==='slide')return door.movingPanels.some(part=>partBlocks(part,localX-motion.offset[0]*progress,localZ-motion.offset[2]*progress));
    const angle=motion.angle*progress;
    const pivot=door.model.doorMotion.pivot,dx=localX-pivot[0],dz=localZ-pivot[2];
    return partBlocks(door.panel,pivot[0]+Math.cos(angle)*dx-Math.sin(angle)*dz,pivot[2]+Math.sin(angle)*dx+Math.cos(angle)*dz);
  }
  function canStandAt(x,z,y=floorY+1.7){
    if(y<floorY+.12||y>floorY+3.5)return true;
    const lx=x-origin.x,lz=z-origin.z;
    for(const wall of walls){
      const [x0,z0]=wall.a,[x1,z1]=wall.b;
      if(!overlap(lx,lz,x0,z0,x1,z1))continue;
      const alongX=x1-x0>z1-z0,start=alongX?x0:z0,along=alongX?lx:lz;
      if(!wall.passages.some(o=>along-radius>=start+o.at&&along+radius<=start+o.at+o.w))return false;
    }
    return !doors.some(group=>doorBlocks(group,x,z));
  }
  function aimedDoor(camera){
    camera.getWorldDirection(direction);
    raycaster.set(camera.position,direction);
    let closest=null,distance=Infinity;
    for(const group of doors){
      group.updateWorldMatrix(true,true);
      const hit=raycaster.intersectObject(group.userData.walkDoor.leaf,true)[0];
      if(hit&&hit.distance<distance){closest=group;distance=hit.distance;}
    }
    if(!closest)return null;
    for(let step=.1;step<distance-.25;step+=.1){
      const x=camera.position.x+direction.x*step,z=camera.position.z+direction.z*step;
      if(!canStandAt(x,z,camera.position.y))return null;
    }
    return closest;
  }
  function toggle(group,camera){
    const door=group.userData.walkDoor,target=door.open?0:1;
    const start=door.open?1:0;
    for(let i=1;i<=18;i++)if(doorBlocks(group,camera.position.x,camera.position.z,start+(target-start)*i/18))return false;
    const motion=door.model.doorMotion;
    if(motion.kind==='slide')door.pivot.position.set(motion.pivot[0]+motion.offset[0]*target,motion.pivot[1],motion.pivot[2]+motion.offset[2]*target);
    else door.pivot.rotation.y=motion.angle*target;
    door.open=!door.open;
    group.updateWorldMatrix(true,true);
    return true;
  }
  function constrain(position,previousX,previousZ){
    const dx=position.x-previousX,dz=position.z-previousZ,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.05));
    position.x=previousX;position.z=previousZ;
    for(let i=0;i<steps;i++){
      if(canStandAt(position.x+dx/steps,position.z,position.y))position.x+=dx/steps;
      if(canStandAt(position.x,position.z+dz/steps,position.y))position.z+=dz/steps;
    }
  }
  function recover(position){
    if(canStandAt(position.x,position.z,position.y))return true;
    for(let distance=.1;distance<=2;distance+=.1)for(let step=0;step<32;step++){
      const angle=step*Math.PI/16,x=position.x+Math.cos(angle)*distance,z=position.z+Math.sin(angle)*distance;
      if(canStandAt(x,z,position.y)){position.x=x;position.z=z;return true;}
    }
    return false;
  }
  return {doors,canStandAt,aimedDoor,toggle,constrain,recover};
}
