const pitch = .071;
const materials = {
  white: {color:'#f4f3ef',roughness:.38}, ivory: {color:'#e4e2dc',roughness:.55},
  recess: {color:'#27282a',roughness:.85}, metal: {color:'#a9adb0',roughness:.3,metalness:.85},
};

export function electricalFacePoint(point, [u,v,depth]) {
  const [nx,ny,nz] = point.normal;
  return ny ? [point.position[0]+u,point.position[1]+depth*ny,point.position[2]-v*ny]
    : [point.position[0]+u*nz+depth*nx,point.position[1]+v,point.position[2]-u*nx+depth*nz];
}

export function buildElectricalOutlet(point) {
  if (!['power','data','coax'].includes(point.kind) || !Number.isInteger(point.count) || point.count < 1
    || !Number.isInteger(point.switchCount??0) || (point.switchCount??0)<0
    || !['horizontal','vertical'].includes(point.orientation)
    || point.position?.length !== 3 || !point.position.every(Number.isFinite)
    || point.normal?.length !== 3 || !point.normal.every(n=>[-1,0,1].includes(n))
    || point.normal.reduce((sum,n)=>sum+Math.abs(n),0) !== 1) throw new Error(`Invalid electrical point ${point.id}`);
  const parts=[], devices=[], frames=[];
  const vertical=point.orientation==='vertical';
  const frameCount=Math.ceil(point.count/5), totalLength=point.count*pitch+.009+(frameCount-1)*.019;
  let cursor=-totalLength/2, deviceIndex=0;
  const panel=(name,u,v,z,w,h,d,material='white',holes=[])=>parts.push({name,type:'panel',position:[u,v,z],size:[w,h,d],radius:Math.min(.005,w/4,h/4),material,holes});
  const circle=(name,u,v,z,radius,depth,material)=>parts.push({name,type:'circle',position:[u,v,z],radius,depth,material});
  for(let frame=0;frame<frameCount;frame++){
    const count=Math.min(5,point.count-deviceIndex),length=count*pitch+.009,center=cursor+length/2;
    const u=vertical?0:center,v=vertical?-center:0;
    panel(`frame_${frame}`,u,v,.001,vertical?.080:length,vertical?length:.080,.004);
    frames.push({index:frame,count,center:[u,v],size:vertical?[.080,length]:[length,.080]});
    for(let slot=0;slot<count;slot++,deviceIndex++){
      const along=cursor+.040+slot*pitch,x=vertical?0:along,y=vertical?-along:0,n=`device_${deviceIndex}`;
      devices.push({index:deviceIndex,frame,kind:point.kind,center:[x,y],ports:1});
      if(point.kind==='power'){
        panel(`${n}_face`,x,y,.005,.064,.064,.005,'white',[{type:'circle',x:0,y:0,radius:.019}]);
        circle(`${n}_recess`,x,y,.0051,.019,.0005,'recess');
        parts.push({name:`${n}_socket`,type:'disc',position:[x,y,.006],radius:.0185,depth:.0015,material:'ivory',holes:[{type:'circle',x:-.0095,y:0,radius:.0023},{type:'circle',x:.0095,y:0,radius:.0023}]});
        circle(`${n}_earth_pin`,x,y+.0095,.0075,.002,.004,'metal');
      }else if(point.kind==='data'){
        panel(`${n}_face`,x,y,.005,.064,.064,.005,'white',[{type:'rect',x:0,y:0,w:.014,h:.012}]);
        panel(`${n}_port`,x,y,.0051,.014,.012,.0005,'recess');
        for(let pin=0;pin<8;pin++)panel(`${n}_contact_${pin}`,x-.0049+pin*.0014,y+.003,.006,.0005,.004,.0005,'metal');
      }else{
        panel(`${n}_face`,x,y,.005,.064,.064,.005);
        circle(`${n}_connector`,x,y,.0101,.005,.003,'metal');
        circle(`${n}_bore`,x,y,.0132,.0036,.0005,'recess');
        circle(`${n}_center`,x,y,.0138,.0009,.001,'metal');
      }
    }
    cursor+=length+.010;
  }
  return {name:`Electrical ${point.id}`,parts,frames,devices,frameCount,deviceCount:point.count,materials,
    note:'Illustrative 80 mm frames on 71 mm pitch; one physical socket or connector per counted module.'};
}

function roundedPath(THREE,width,height,radius) {
  const shape=new THREE.Shape(),x=-width/2,y=-height/2,r=radius;
  shape.moveTo(x+r,y);shape.lineTo(x+width-r,y);shape.quadraticCurveTo(x+width,y,x+width,y+r);
  shape.lineTo(x+width,y+height-r);shape.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
  shape.lineTo(x+r,y+height);shape.quadraticCurveTo(x,y+height,x,y+height-r);
  shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
  return shape;
}

export function buildElectricalFrame(points) {
  const order={power:0,data:1,coax:2},records=[...points].sort((a,b)=>order[a.kind]-order[b.kind]||a.id.localeCompare(b.id));
  const anchor=records[0];
  if(!anchor)throw new Error('Electrical frame requires at least one point');
  for(const record of records){
    buildElectricalOutlet(record);
    if(record.orientation!==anchor.orientation || record.normal.some((n,i)=>n!==anchor.normal[i])
      || record.position.some((n,i)=>Math.abs(n-anchor.position[i])>1e-6)) throw new Error(`Electrical frame ${anchor.frameId} has inconsistent anchors`);
  }
  const socketCount=records.reduce((sum,p)=>sum+p.count,0),switchCount=records.reduce((sum,p)=>sum+(p.switchCount??0),0);
  const model=buildElectricalOutlet({...anchor,count:socketCount+switchCount});
  model.parts=model.parts.filter(part=>part.name.startsWith('frame_'));
  let index=0;
  for(const record of records){
    const single=buildElectricalOutlet({...record,count:1});
    for(let slot=0;slot<record.count;slot++,index++){
      const device=model.devices[index];device.kind=record.kind;device.id=record.id;
      for(const part of single.parts.filter(part=>!part.name.startsWith('frame_'))){
        model.parts.push({...part,name:part.name.replace('device_0',`device_${index}`),
          position:[part.position[0]+device.center[0],part.position[1]+device.center[1],part.position[2]],id:record.id,kind:record.kind});
      }
    }
  }
  for(const record of records)for(let slot=0;slot<(record.switchCount??0);slot++,index++){
    const device=model.devices[index];device.kind='switch';device.id=record.id;device.ports=0;
    const [u,v]=device.center;
    model.parts.push(
      {name:`device_${index}_switch_reveal`,type:'panel',position:[u,v,.005],size:[.064,.064,.003],radius:.004,material:'recess',id:record.id,kind:'switch'},
      {name:`device_${index}_rocker`,type:'panel',position:[u,v,.0081],size:[.059,.059,.003],radius:.003,material:'white',id:record.id,kind:'switch'},
    );
  }
  model.name=`Electrical ${anchor.frameId??anchor.id}`;
  if(anchor.normal[1]===1){
    model.parts=model.frames.flatMap(frame=>[
      {name:`floor_frame_${frame.index}`,type:'panel',position:[...frame.center,.0005],size:[...frame.size,.0015],radius:.005,material:'metal'},
      {name:`floor_lid_${frame.index}`,type:'panel',position:[...frame.center,.0021],size:[frame.size[0]-.006,frame.size[1]-.006,.001],radius:.003,material:'metal'},
    ]);
    model.note='Illustrative closed floor-box covers; contained socket counts retained in metadata. Cover dimensions and finish are not a selected product.';
  }
  return {...model,anchor,socketCount,switchCount,recordIds:records.map(p=>p.id),records:records.map(({id,kind,count,room,switchCount=0})=>({id,kind,count,room,switchCount}))};
}

export function attachElectricalPoints(THREE,house,points) {
  const group=new THREE.Group();group.name='Electrical outlets';group.position.y=house.dims.floorY;
  const palette=Object.fromEntries(Object.entries(materials).map(([key,value])=>[key,new THREE.MeshStandardMaterial(value)]));
  const ids=new Set(),frames=new Map();
  for(const point of points){
    if(ids.has(point.id))throw new Error(`Duplicate electrical point ${point.id}`);
    ids.add(point.id);
    const key=point.frameId?`frame:${point.frameId}`:`point:${point.id}`;
    if(!frames.has(key))frames.set(key,[]);
    frames.get(key).push(point);
  }
  const models=[...frames.values()].map(buildElectricalFrame);
  for(const model of models){
    const point=model.anchor,fixture=new THREE.Group();fixture.name=model.name;
    fixture.position.set(...electricalFacePoint(point,[0,0,.001]));
    const [nx,ny,nz]=point.normal;
    const right=new THREE.Vector3(...(ny?[1,0,0]:[nz,0,-nx])),up=new THREE.Vector3(...(ny?[0,0,-ny]:[0,1,0]));
    fixture.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,new THREE.Vector3(nx,ny,nz)));
    fixture.userData={id:point.id,kind:model.records.length===1?point.kind:'mixed',room:point.room,count:model.socketCount,moduleCount:model.deviceCount,switchCount:model.switchCount,
      frameId:point.frameId,recordIds:model.recordIds,records:model.records,frameCount:model.frameCount,note:model.note};
    for(const part of model.parts){
      const shape=part.type==='panel'?roundedPath(THREE,part.size[0],part.size[1],part.radius):new THREE.Shape();
      if(part.type!=='panel')shape.absarc(0,0,part.radius,0,Math.PI*2,false);
      for(const hole of part.holes??[]){
        const path=new THREE.Path();
        if(hole.type==='circle')path.absarc(hole.x,hole.y,hole.radius,0,Math.PI*2,true);
        else{path.moveTo(hole.x-hole.w/2,hole.y-hole.h/2);path.lineTo(hole.x-hole.w/2,hole.y+hole.h/2);path.lineTo(hole.x+hole.w/2,hole.y+hole.h/2);path.lineTo(hole.x+hole.w/2,hole.y-hole.h/2);path.closePath();}
        shape.holes.push(path);
      }
      const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:part.type==='panel'?part.size[2]:part.depth,bevelEnabled:false,curveSegments:12}),palette[part.material]);
      mesh.name=part.name;mesh.position.set(...part.position);mesh.castShadow=true;mesh.receiveShadow=true;
      if(part.id)mesh.userData={id:part.id,kind:part.kind};
      fixture.add(mesh);
    }
    group.add(fixture);
  }
  house.root.add(group);
  return group;
}
