// Stereo 360 still tour. Each still is a top-bottom equirectangular image; the left eye
// sees the top half on layer 1 and the right eye the bottom half on layer 2, the layout
// three.js's WebXR panorama example uses. Outside VR only the left half is shown.
export function tourState(tour,index){
  const still=tour.stills[index];
  return {
    index,name:still.name,file:still.file,
    hasPrevious:index>0,hasNext:index<tour.stills.length-1,
    hotspots:still.hotspots.map(hotspot=>({...hotspot,radians:hotspot.azimuth*Math.PI/180})),
  };
}

// Equirectangular u runs from the image's left edge; the panorama centre (u=0.5) is the
// shot heading, so an azimuth of +90 degrees (a right turn) sits at u=0.75.
export function hotspotPosition(azimuthDegrees,distanceM,eyeHeightM){
  const radians=azimuthDegrees*Math.PI/180;
  const radius=Math.max(1.5,Math.min(distanceM,6));
  const drop=Math.min(eyeHeightM,1.6)*0.6;
  return [Math.sin(radians)*radius,-drop,-Math.cos(radians)*radius];
}

export function mountTour(THREE,VRButton,{source}){
  const status=document.getElementById('tourStatus');
  const select=document.getElementById('tourSelect');
  const previous=document.getElementById('tourPrev'),next=document.getElementById('tourNext');
  const renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.xr.enabled=true;
  renderer.xr.setReferenceSpaceType('local');
  document.body.append(renderer.domElement,VRButton.createButton(renderer));
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,.1,100);
  camera.layers.enable(1);
  const geometry=new THREE.SphereGeometry(50,64,32);
  geometry.scale(-1,1,1);
  const eyes=[1,2].map(layer=>{
    const material=new THREE.MeshBasicMaterial();
    const mesh=new THREE.Mesh(geometry,material);
    // SphereGeometry puts the texture centre on -X; turn it to -Z, where the camera looks.
    mesh.rotation.y=-Math.PI/2;
    mesh.layers.set(layer);
    scene.add(mesh);
    return {mesh,material};
  });
  const hotspotGroup=new THREE.Group();
  scene.add(hotspotGroup);
  const ray=new THREE.Raycaster();
  const loader=new THREE.TextureLoader();
  let tour=null,current=null,textures=new Map();
  function setTexture(texture,stereo){
    texture.colorSpace=THREE.SRGBColorSpace;
    eyes.forEach(({material},index)=>{
      const eye=texture.clone();
      eye.needsUpdate=true;
      if(stereo){eye.repeat.set(1,.5);eye.offset.set(0,index===0?.5:0);}
      material.map=eye;material.needsUpdate=true;
    });
  }
  function ring(hotspot,still){
    const mesh=new THREE.Mesh(new THREE.CircleGeometry(.3,32),new THREE.MeshBasicMaterial({color:0x55dd99,side:THREE.DoubleSide,transparent:true,opacity:.85}));
    mesh.position.set(...hotspotPosition(hotspot.azimuth,hotspot.distanceM,still.eyeHeightM));
    mesh.lookAt(0,mesh.position.y,0);
    mesh.userData.to=hotspot.to;
    mesh.name=`Go to ${hotspot.label}`;
    return mesh;
  }
  function show(index){
    if(!tour||index<0||index>=tour.stills.length)return;
    const still=tour.stills[index];
    current=tourState(tour,index);
    status.textContent=`Loading ${still.name}…`;
    hotspotGroup.clear();
    for(const hotspot of still.hotspots)hotspotGroup.add(ring(hotspot,still));
    select.value=String(index);
    previous.disabled=!current.hasPrevious;next.disabled=!current.hasNext;
    const url=new URL(still.file,source).href;
    const apply=texture=>{setTexture(texture,tour.stereo);status.textContent=still.name;};
    if(textures.has(url))apply(textures.get(url));
    else loader.load(url,texture=>{textures.set(url,texture);apply(texture);},undefined,()=>{status.textContent=`Could not load ${still.file}`;});
  }
  previous.onclick=()=>show(current.index-1);
  next.onclick=()=>show(current.index+1);
  select.onchange=()=>show(Number(select.value));
  let dragging=null;
  const look={yaw:0,pitch:0};
  function orient(){camera.rotation.set(look.pitch,look.yaw,0,'YXZ');}
  renderer.domElement.addEventListener('pointerdown',event=>{dragging={x:event.clientX,y:event.clientY,yaw:look.yaw,pitch:look.pitch};});
  window.addEventListener('pointermove',event=>{
    if(!dragging)return;
    look.yaw=dragging.yaw+(event.clientX-dragging.x)*.004;
    look.pitch=Math.max(-1.4,Math.min(1.4,dragging.pitch+(event.clientY-dragging.y)*.004));
    orient();
  });
  window.addEventListener('pointerup',event=>{
    if(dragging&&Math.hypot(event.clientX-dragging.x,event.clientY-dragging.y)<4){
      ray.setFromCamera(new THREE.Vector2(event.clientX/window.innerWidth*2-1,-(event.clientY/window.innerHeight)*2+1),camera);
      const hit=ray.intersectObjects(hotspotGroup.children)[0];
      if(hit)show(hit.object.userData.to);
    }
    dragging=null;
  });
  const controllers=[0,1].map(index=>{
    const controller=renderer.xr.getController(index);
    controller.addEventListener('select',()=>{
      ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      ray.ray.direction.set(0,0,-1).applyMatrix4(new THREE.Matrix4().extractRotation(controller.matrixWorld));
      const hit=ray.intersectObjects(hotspotGroup.children)[0];
      if(hit)show(hit.object.userData.to);
    });
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0x99ddff}));
    line.scale.z=6;controller.add(line);scene.add(controller);
    return controller;
  });
  window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
  renderer.setAnimationLoop(()=>{
    const t=performance.now()/600;
    for(const mesh of hotspotGroup.children)mesh.material.opacity=.6+.25*Math.sin(t);
    renderer.render(scene,camera);
  });
  fetch(source).then(response=>{if(!response.ok)throw new Error(`${response.status} for tour.json`);return response.json();}).then(data=>{
    tour=data;
    select.replaceChildren(...tour.stills.map(still=>Object.assign(document.createElement('option'),{value:String(still.index),textContent:still.name})));
    show(0);
  }).catch(error=>{status.textContent=`${error.message}. Export the tour first with node unreal/export-tour.mjs.`;});
  return {show,get current(){return current;},controllers,look,orient,camera,hotspots:()=>hotspotGroup.children.map(mesh=>({to:mesh.userData.to,position:mesh.position.toArray()}))};
}
