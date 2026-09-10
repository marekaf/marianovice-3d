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
  if(model.opening.pocket){
    const [x,z,y]=panel.position,[w,d,h]=panel.size;
    group.userData.walkDoor.closedBounds=new THREE.Box3(new THREE.Vector3(x-w/2,y-h/2,z-d/2),new THREE.Vector3(x+w/2,y+h/2,z+d/2));
  }
  return group;
}

export function createWalkDoors(THREE,{data,doors,floorY,eyeHeight=1.7}) {
  const origin=data.originPlot,radius=.18;
  const scratch=new THREE.Vector3(),direction=new THREE.Vector3(),inverse=new THREE.Matrix4();
  const raycaster=new THREE.Raycaster();raycaster.far=2;
  const walls=[...data.extWalls,...data.intWalls].map(wall=>({...wall,cells:data.subtractWallRecesses?.({x0:wall.a[0],z0:wall.a[1],x1:wall.b[0],z1:wall.b[1],y0:0,y1:wall.profile?Math.max(...wall.profile.map(([,height])=>height)):wall.h??data.clearH},data.wallRecesses(wall)),passages:wall.openings.filter((opening,index)=>{
    const model=data.buildOpening(wall,opening,index);
    return !opening.sill&&opening.h>=1.9&&(!model||model.opening.kind!=='window'||model.doorMotion);
  }).map(opening=>opening.reveal&&data.buildOpening(wall,opening,wall.openings.indexOf(opening))?.opening.kind==='entrance'?{...opening,at:opening.at+(opening.w-opening.reveal.width)/2,w:opening.reveal.width}:opening)}));
  const sightWalls=walls.map(wall=>{
    const alongX=wall.b[0]-wall.a[0]>wall.b[1]-wall.a[1],axis=alongX?'x':'z',cross=alongX?'z':'x';
    const rect={x0:wall.a[0],x1:wall.b[0],z0:wall.a[1],z1:wall.b[1]},cuts=[...(data.wallRecesses?.(wall)||[])];
    for(const opening of wall.openings){
      const start=wall.a[alongX?0:1]+opening.at,y0=opening.sill||0,y1=y0+opening.h;
      cuts.push({...rect,[`${axis}0`]:start,[`${axis}1`]:start+opening.w,y0,y1});
      if(opening.reveal)cuts.push({...rect,[`${axis}0`]:start+(opening.w-opening.reveal.width)/2,
        [`${axis}1`]:start+(opening.w+opening.reveal.width)/2,
        [`${cross}0`]:opening.reveal.depth0,[`${cross}1`]:opening.reveal.depth1,y0,y1});
    }
    if(wall.profile)for(const glazing of wall.glazing||[])cuts.push({...rect,x0:glazing.x0,x1:glazing.x1,y0:glazing.sill,y1:glazing.sill+glazing.h});
    const profile=wall.profile||[[rect.x0,wall.h??data.clearH],[rect.x1,wall.h??data.clearH]];
    const pieces=profile.slice(1).flatMap(([bx,by],index)=>{
      const [ax,ay]=profile[index],x0=Math.max(ax,rect.x0),x1=Math.min(bx,rect.x1);
      if(x1<=x0)return [];
      const slope=(by-ay)/(bx-ax);
      return [{...rect,x0,x1,y0:0,y1:Math.max(ay,by),slope,intercept:ay-slope*ax}];
    });
    return {pieces,cuts};
  });
  function rayInterval(rect,point,vector,limit){
    let near=0,far=limit;
    for(const axis of ['x','y','z']){
      const p=point[axis],d=vector[axis],lo=rect[`${axis}0`],hi=rect[`${axis}1`];
      if(Math.abs(d)<1e-12){if(p<lo||p>hi)return null;continue;}
      const a=(lo-p)/d,b=(hi-p)/d;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
      if(far<=near)return null;
    }
    if(rect.slope!==undefined){
      const offset=point.y-rect.slope*point.x-rect.intercept,rate=vector.y-rect.slope*vector.x;
      if(Math.abs(rate)<1e-12){if(offset>0)return null;}
      else if(rate>0)far=Math.min(far,-offset/rate);
      else near=Math.max(near,-offset/rate);
    }
    return far>near?[near,far]:null;
  }
  function wallOccludes(camera,distance){
    const point={x:camera.position.x-origin.x,y:camera.position.y-floorY,z:camera.position.z-origin.z};
    for(const wall of sightWalls){
      const cuts=wall.cuts.map(cut=>rayInterval(cut,point,direction,distance)).filter(Boolean);
      for(const piece of wall.pieces){
        const interval=rayInterval(piece,point,direction,distance);
        if(!interval)continue;
        let solid=[interval];
        for(const [a,b]of cuts)solid=solid.flatMap(([lo,hi])=>{
          if(b<=lo||a>=hi)return [[lo,hi]];
          return [[lo,Math.min(hi,a)],[Math.max(lo,b),hi]].filter(([start,end])=>end>start);
        });
        if(solid.some(([start,end])=>end-start>1e-8&&start<distance-1e-8))return true;
      }
    }
    return false;
  }
  const overlap=(x,z,x0,z0,x1,z1)=>Math.hypot(x-Math.max(x0,Math.min(x1,x)),z-Math.max(z0,Math.min(z1,z)))<radius-1e-7;
  function partBlocks(part,x,z,bodyBottom,bodyTop){
    const [px,pz,py]=part.position,[w,d,h]=part.size;
    if(py+h/2<=bodyBottom||py-h/2>=bodyTop)return false;
    return overlap(x,z,px-w/2,pz-d/2,px+w/2,pz+d/2);
  }
  function doorBlocks(group,x,z,progress=group.userData.walkDoor.open?1:0,eyeY=floorY+eyeHeight){
    const door=group.userData.walkDoor;
    group.updateWorldMatrix(true,false);
    scratch.set(x,eyeY,z).applyMatrix4(inverse.copy(group.matrixWorld).invert());
    const localX=scratch.x,localZ=scratch.z,bodyTop=scratch.y,bodyBottom=bodyTop-eyeHeight+.12;
    if(door.fixed.some(part=>partBlocks(part,localX,localZ,bodyBottom,bodyTop)))return true;
    const motion=door.model.doorMotion;
    if(motion.kind==='slide')return door.movingPanels.some(part=>partBlocks(part,localX-motion.offset[0]*progress,localZ-motion.offset[2]*progress,bodyBottom,bodyTop));
    const angle=motion.angle*progress;
    const pivot=door.model.doorMotion.pivot,dx=localX-pivot[0],dz=localZ-pivot[2];
    return door.movingPanels.some(part=>partBlocks(part,pivot[0]+Math.cos(angle)*dx-Math.sin(angle)*dz,pivot[2]+Math.sin(angle)*dx+Math.cos(angle)*dz,bodyBottom,bodyTop));
  }
  function wallTop(wall,x){
    if(!wall.profile)return wall.h??data.clearH;
    const sample=at=>{
      for(let i=1;i<wall.profile.length;i++){
        const [ax,ay]=wall.profile[i-1],[bx,by]=wall.profile[i];
        if(at>=ax&&at<=bx)return ay+(by-ay)*(at-ax)/(bx-ax);
      }
      return 0;
    };
    return Math.max(sample(x-radius),sample(x),sample(x+radius),...wall.profile.filter(([at])=>Math.abs(at-x)<=radius).map(([,height])=>height));
  }
  function canStandAt(x,z,y=floorY+eyeHeight){
    const bodyTop=y-floorY,bodyBottom=bodyTop-eyeHeight+.12;
    if(bodyTop<=0)return true;
    const lx=x-origin.x,lz=z-origin.z;
    for(const wall of walls){
      const [x0,z0]=wall.a,[x1,z1]=wall.b;
      if(!overlap(lx,lz,x0,z0,x1,z1))continue;
      if(bodyBottom>=wallTop(wall,lx))continue;
      if(wall.cells&&!wall.cells.some(cell=>bodyTop>cell.y0&&bodyBottom<cell.y1&&overlap(lx,lz,cell.x0,cell.z0,cell.x1,cell.z1)))continue;
      const alongX=x1-x0>z1-z0,start=alongX?x0:z0,along=alongX?lx:lz;
      if(!wall.passages.some(o=>along-radius>=start+o.at&&along+radius<=start+o.at+o.w&&bodyBottom>=(o.sill??0)&&bodyTop<=(o.sill??0)+o.h))return false;
    }
    return !doors.some(group=>doorBlocks(group,x,z,undefined,y));
  }
  function aimedDoor(camera){
    camera.getWorldDirection(direction);
    raycaster.set(camera.position,direction);
    let closest=null,distance=Infinity;
    for(const group of doors){
      group.updateWorldMatrix(true,true);
      const door=group.userData.walkDoor;
      let hit=raycaster.intersectObject(door.leaf,true)[0];
      if(door.opening.pocket&&door.open){
        const point=raycaster.ray.clone().applyMatrix4(inverse.copy(group.matrixWorld).invert()).intersectBox(door.closedBounds,scratch);
        if(point){
          const targetDistance=point.applyMatrix4(group.matrixWorld).distanceTo(camera.position);
          if(targetDistance<=raycaster.far&&(!hit||targetDistance<hit.distance))hit={distance:targetDistance};
        }
      }
      if(hit&&hit.distance<distance){closest=group;distance=hit.distance;}
    }
    if(!closest)return null;
    if(wallOccludes(camera,distance))return null;
    for(const group of doors)if(raycaster.intersectObject(group,true).some(hit=>hit.distance<distance-1e-7))return null;
    return closest;
  }
  function toggle(group,camera){
    const door=group.userData.walkDoor,target=door.open?0:1;
    const start=door.open?1:0;
    for(let i=1;i<=18;i++)if(doorBlocks(group,camera.position.x,camera.position.z,start+(target-start)*i/18,camera.position.y))return false;
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
