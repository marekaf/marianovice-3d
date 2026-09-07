export const GravelSurfaceModel = {
  create(THREE, { surface, bounds, exclusions = [], seed = 41 }) {
    let state=seed;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#77766e';ctx.fillRect(0,0,512,512);
    for(let i=0;i<12500;i++){
      const shade=106+Math.floor(random()*82),x=random()*512,y=random()*512,r=1+random()*3.5;
      ctx.fillStyle=`rgb(${shade+3},${shade+2},${shade-3})`;ctx.beginPath();ctx.ellipse(x,y,r,r*(.55+random()*.4),random()*Math.PI,0,Math.PI*2);ctx.fill();
    }
    const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(2,2);texture.colorSpace=THREE.SRGBColorSpace;
    surface.material=new THREE.MeshStandardMaterial({color:0xffffff,map:texture,bumpMap:texture,bumpScale:.003,roughness:1,side:THREE.DoubleSide});
    surface.updateMatrixWorld(true);
    const position=surface.geometry.attributes.position,uv=surface.geometry.attributes.uv,normal=surface.geometry.attributes.normal;
    const world=new THREE.Vector3();
    for(let i=0;i<position.count;i++){
      world.fromBufferAttribute(position,i).applyMatrix4(surface.matrixWorld);
      if(Math.abs(normal.getY(i))>.5)uv.setXY(i,world.x,world.z);
      else if(Math.abs(normal.getX(i))>.5)uv.setXY(i,world.z,world.y);
      else uv.setXY(i,world.x,world.y);
    }
    uv.needsUpdate=true;
    const count=Math.round((bounds.x1-bounds.x0)*(bounds.z1-bounds.z0)*55),parts=[];
    const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
    for(let attempt=0;attempt<count*2&&parts.length<count;attempt++){
      const radius=.008+random()*.01,x=bounds.x0+radius+random()*(bounds.x1-bounds.x0-2*radius),
        z=bounds.z0+radius+random()*(bounds.z1-bounds.z0-2*radius);
      if(exclusions.some(b=>x+radius>b.x0&&x-radius<b.x1&&z+radius>b.z0&&z-radius<b.z1))continue;
      const heights=[];
      for(const dx of [-radius,0,radius])for(const dz of [-radius,0,radius]){
        ray.set(new THREE.Vector3(x+dx,20,z+dz),down);
        const hit=ray.intersectObject(surface,false)[0];if(hit)heights.push(hit.point.y);
      }
      if(heights.length!==9)continue;
      const halfHeight=radius*.5,y=Math.min(...heights)+halfHeight*.1;
      parts.push({x,y,z,radius,halfHeight,rotation:random()*Math.PI*2});
    }
    const stones=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),
      new THREE.MeshStandardMaterial({roughness:1}),parts.length);
    const dummy=new THREE.Object3D();
    parts.forEach((p,i)=>{
      dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.set(p.radius,p.halfHeight,p.radius);
      dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);stones.setColorAt(i,new THREE.Color().setHSL(.1,.04,.22+random()*.18));
    });
    stones.name='facade-gravel-stones';stones.castShadow=stones.receiveShadow=true;
    stones.userData={bounds,exclusions,parts,surfaceId:surface.uuid};
    return stones;
  },
};
