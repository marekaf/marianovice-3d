export function createBathroomFinishes(THREE,data) {
  const rooms=data.rooms.filter(r=>['1.03','1.10','sprcha'].includes(r.id));
  function material(width,height){
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=Math.round(256*height/width);
    const context=canvas.getContext('2d'),pixels=context.createImageData(canvas.width,canvas.height);
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const i=(y*canvas.width+x)*4;
      const cloud=2.5*Math.sin(x*.025+y*.031)+1.5*Math.sin(x*.11-y*.079)+Math.sin(x*1.37+y*2.17);
      const grout=x<1||y<1;
      pixels.data[i]=grout?193:222+cloud;pixels.data[i+1]=grout?190:221+cloud;pixels.data[i+2]=grout?184:215+cloud;pixels.data[i+3]=255;
    }
    context.putImageData(pixels,0,0);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    const mat=new THREE.MeshStandardMaterial({color:'#ffffff',map:texture,roughness:.84});
    mat.name='Azuma UP white preview';return mat;
  }
  const wallMaterial=material(.6,1.2),floorMaterial=material(.6,.6);
  const mappedPlane=(width,height,u0,v0,tileW,tileH,mat)=>{
    const geometry=new THREE.PlaneGeometry(width,height),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(u0+uv.getX(i)*width)/tileW,(v0+uv.getY(i)*height)/tileH);
    uv.needsUpdate=true;
    const mesh=new THREE.Mesh(geometry,mat);mesh.receiveShadow=true;return mesh;
  };
  function decorateWallMesh(mesh){
    mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox.clone().translate(mesh.position);
    const bottom=Math.max(0,b.min.y),top=Math.min(data.clearH,b.max.y);
    if(top-bottom<1e-6)return;
    for(const room of rooms)for(const[axis,sign]of[['x',-1],['x',1],['z',-1],['z',1]]){
      const across=axis==='x'?'z':'x',face=sign>0?b.max[axis]:b.min[axis],sample=face+sign*.001;
      if(sample<room[`${axis}0`]||sample>room[`${axis}1`])continue;
      const start=Math.max(b.min[across],room[`${across}0`]),end=Math.min(b.max[across],room[`${across}1`]);
      if(end-start<1e-6)continue;
      const panel=mappedPlane(end-start,top-bottom,start,bottom,.6,1.2,wallMaterial);
      panel.name=`bathroom-tile-${room.id}-${axis}-${sign}`;
      if(axis==='x'){panel.rotation.y=sign*Math.PI/2;panel.position.set(face+sign*.0009,(bottom+top)/2,(start+end)/2);}
      else{panel.rotation.y=sign>0?0:Math.PI;panel.position.set((start+end)/2,(bottom+top)/2,face+sign*.0009);}
      panel.position.sub(mesh.position);mesh.add(panel);
    }
  }
  function attach(house){
    const floors=new THREE.Group();floors.name='Bathroom tiled floors';
    for(const room of rooms){
      const plane=mappedPlane(room.x1-room.x0,room.z1-room.z0,room.x0,-room.z1,.6,.6,floorMaterial);
      plane.rotation.x=-Math.PI/2;plane.position.set((room.x0+room.x1)/2,house.dims.floorY+.004,(room.z0+room.z1)/2);
      plane.name=`bathroom-floor-${room.id}`;floors.add(plane);
    }
    house.floor.add(floors);return floors;
  }
  return {decorateWallMesh,attach,rooms};
}
