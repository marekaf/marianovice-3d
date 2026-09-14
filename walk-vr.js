import {placeVRHead,rotateVRRig,createVRTeleportValidator} from './walk-vr-locomotion.js';

export function mountVRWalk(THREE,{scene,camera,renderer,loadInterior,getContext,onStart,onEnd,closePanels}) {
  const button=document.createElement('button');
  button.id='vrButton';button.type='button';button.textContent='VR';button.title='Quest VR walkthrough';button.setAttribute('aria-controls','vrPanel');button.setAttribute('aria-expanded','false');
  document.getElementById('viewerToolbar').append(button);
  const panel=document.createElement('section');
  panel.id='vrPanel';panel.className='viewer-panel';panel.hidden=true;
  panel.innerHTML='<div class="panel-heading"><h2>Quest walkthrough</h2><button type="button">Close</button></div><p>Explore the furnished ground floor at life size.</p><p>Point at the floor and press a trigger to teleport to the green ring. Move either thumbstick sideways to turn. Point at a door and squeeze the grip to open or close it.</p><p>Stairs and outdoor teleportation are unavailable in this prototype. Use the headset menu to exit VR.</p><p id="vrStatus" role="status" aria-live="polite"></p><button id="enterVR" type="button" disabled>Checking VR support…</button>';
  document.getElementById('viewerUI').append(panel);
  const closePanel=()=>{panel.hidden=true;button.setAttribute('aria-expanded','false');};
  panel.querySelector('.panel-heading button').onclick=closePanel;
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closePanel();});
  document.getElementById('viewerToolbar').addEventListener('click',event=>{if(event.target!==button)closePanel();});
  renderer.domElement.addEventListener('pointerdown',closePanel);
  const enter=panel.querySelector('#enterVR'),status=panel.querySelector('#vrStatus');
  let supported=false,ready=false,loading=false,session=null,saved=null,context=null,validate=null;
  let firstPose=true,pendingTeleport=null,pendingDoor=null;
  const rig=new THREE.Group();rig.name='VR player';
  const head=new THREE.Vector3(),direction=new THREE.Vector3(),origin=new THREE.Vector3();
  const ray=new THREE.Raycaster(),aimCamera=new THREE.PerspectiveCamera();
  const marker=new THREE.Mesh(new THREE.RingGeometry(.15,.22,32),new THREE.MeshBasicMaterial({color:0x55dd99,side:THREE.DoubleSide,depthWrite:false}));
  marker.name='VR teleport destination';marker.rotation.x=-Math.PI/2;marker.visible=false;
  const controllers=[0,1].map(index=>{
    const controller=renderer.xr.getController(index);
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0x99ddff}));
    line.name='VR pointer';line.scale.z=6;controller.add(line);rig.add(controller);
    const destination=marker.clone();scene.add(destination);
    const state={controller,line,marker:destination,source:null,latched:false,target:null};
    controller.addEventListener('connected',event=>{state.source=event.data;});
    controller.addEventListener('disconnected',()=>{state.source=null;state.target=null;state.latched=false;});
    controller.addEventListener('select',()=>{pendingTeleport=state;});
    controller.addEventListener('squeeze',()=>{pendingDoor=state;});
    return state;
  });
  function available(){enter.disabled=!supported||!ready||!!session;enter.textContent=ready?'Enter VR':'Load interiors';}
  async function prepare(){
    if(loading||ready||!supported)return;
    loading=true;enter.disabled=true;status.textContent='Loading furnished interiors…';
    try{
      const house=await loadInterior();
      if(!house)throw new Error('Interiors could not be loaded. Close this panel and try again.');
      ready=true;status.textContent='Ready. Enter VR to begin in the living room.';
    }catch(error){status.textContent=error.message;}
    finally{loading=false;available();}
  }
  button.onclick=()=>{closePanels();panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)void prepare();};
  async function checkSupport(){
    if(!window.isSecureContext){status.textContent='Open this site over HTTPS in Meta Quest Browser to enter VR.';enter.textContent='HTTPS required';return;}
    try{supported=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');}
    catch{supported=false;}
    status.textContent=supported?'Open this panel to load the furnished interiors.':'Open this site in Meta Quest Browser to enter VR. The desktop viewer remains available.';
    available();
    if(!supported)enter.textContent='VR unavailable';
    else if(!panel.hidden)void prepare();
  }
  renderer.xr.enabled=true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFramebufferScaleFactor(.8);
  function restore(){
    renderer.setAnimationLoop(null);
    pendingTeleport=null;pendingDoor=null;
    for(const state of controllers){state.target=null;state.latched=false;state.source=null;state.marker.visible=false;}
    if(saved){
      camera.removeFromParent();saved.parent?.add(camera);
      camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);
      camera.fov=saved.fov;camera.aspect=saved.aspect;camera.near=saved.near;camera.far=saved.far;camera.updateProjectionMatrix();
      for(const [object,visible]of saved.visibility)object.visible=visible;
      renderer.shadowMap.enabled=saved.shadows;renderer.shadowMap.needsUpdate=true;
      rig.removeFromParent();saved=null;onEnd();
    }
    session=null;available();status.textContent='VR ended. You can enter again.';
  }
  enter.onclick=async()=>{
    if(!ready||!supported||session)return;
    enter.disabled=true;
    try{
      session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
      context=getContext();
      validate=createVRTeleportValidator({data:context.data,floorY:context.floorY,canStandAt:context.doors.canStandAt});
      saved={parent:camera.parent,position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,shadows:renderer.shadowMap.enabled,
        visibility:[...context.hidden,...context.shown].map(object=>[object,object.visible])};
      onStart();
      for(const object of context.hidden)object.visible=false;
      for(const object of context.shown)object.visible=true;
      renderer.shadowMap.enabled=false;
      rig.position.set(context.data.originPlot.x+6,context.floorY,context.data.originPlot.z+10.3);
      rig.rotation.set(0,Math.atan2(-2,-1.5),0);scene.add(rig);rig.add(camera);
      camera.position.set(0,0,0);camera.quaternion.identity();camera.near=.05;camera.updateProjectionMatrix();
      firstPose=true;
      await renderer.xr.setSession(session);
      renderer.setAnimationLoop(frame);
      status.textContent='VR active. Use the headset menu to exit.';
    }catch(error){
      const failed=session;
      if(failed)try{await failed.end();}catch{}
      restore();status.textContent=`Could not enter VR: ${error.message}. Try again.`;
    }
  };
  renderer.xr.addEventListener('sessionend',restore);
  function visibleMesh(object){
    if(!object.isMesh||controllers.some(state=>state.marker===object))return false;
    for(let parent=object;parent;parent=parent.parent)if(!parent.visible||parent===rig)return false;
    return [object.material].flat().some(material=>material?.visible&&material.opacity>0);
  }
  function floorObject(object){
    for(let parent=object;parent;parent=parent.parent)if(parent===context.house.floor)return true;
    return false;
  }
  function clearLanding(point,meshes){
    if(!validate(point))return false;
    for(let index=0;index<9;index++){
      const angle=index*Math.PI/4,radius=index===8?0:.22;
      origin.set(point.x+Math.cos(angle)*radius,context.floorY+1.8,point.z+Math.sin(angle)*radius);
      ray.set(origin,direction.set(0,-1,0));ray.far=1.85;
      const hit=ray.intersectObjects(meshes,false)[0];
      if(!hit||!floorObject(hit.object)||Math.abs(hit.point.y-context.floorY)>.08)return false;
    }
    return true;
  }
  function frame(time,xrFrame){
    if(!xrFrame||!session)return;
    const pose=xrFrame.getViewerPose(renderer.xr.getReferenceSpace());
    if(!pose){
      pendingTeleport=null;pendingDoor=null;
      for(const state of controllers){state.marker.visible=false;state.latched=true;}
      return;
    }
    const trackedHead=()=>head.copy(pose.transform.position).applyMatrix4(rig.matrixWorld);
    rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);trackedHead();
    if(firstPose){
      placeVRHead(THREE,rig,head,new THREE.Vector3(context.data.originPlot.x+6,context.floorY,context.data.originPlot.z+10.3));
      firstPose=false;
      rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);
    }
    if(session.visibilityState!=='visible'){
      pendingTeleport=null;pendingDoor=null;
      for(const state of controllers){state.marker.visible=false;state.latched=true;}
      renderer.render(scene,camera);return;
    }
    for(const state of controllers){
      const stick=state.source?.gamepad?.mapping==='xr-standard'?(state.source.gamepad.axes[2]??0):0;
      if(Math.abs(stick)<.25)state.latched=false;
      if(Math.abs(stick)>.65&&!state.latched){
        trackedHead();rotateVRRig(THREE,rig,head,-Math.sign(stick)*Math.PI/6);state.latched=true;
        rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);
      }
    }
    scene.updateMatrixWorld(true);
    const meshes=[];scene.traverseVisible(object=>{if(visibleMesh(object))meshes.push(object);});
    for(const state of controllers){
      state.target=null;state.marker.visible=false;
      if(!state.source||!state.controller.visible)continue;
      state.controller.getWorldPosition(origin);state.controller.getWorldDirection(direction).negate();
      ray.set(origin,direction);ray.far=6;
      const hit=ray.intersectObjects(meshes,false)[0];
      state.line.scale.z=hit?.distance??6;
      if(hit&&floorObject(hit.object)&&clearLanding(hit.point,meshes))state.target=hit.point.clone();
      state.line.material.color.setHex(state.target?0x55dd99:0x99ddff);
      if(state.target){state.marker.position.copy(state.target);state.marker.position.y+=.012;state.marker.visible=true;}
    }
    if(pendingDoor?.source){
      const controller=pendingDoor.controller;
      controller.getWorldPosition(aimCamera.position);controller.getWorldQuaternion(aimCamera.quaternion);aimCamera.updateMatrixWorld(true);
      const door=context.doors.aimedDoor(aimCamera);
      if(door){aimCamera.position.copy(trackedHead());context.doors.toggle(door,aimCamera);}
    }
    if(pendingTeleport?.target&&clearLanding(pendingTeleport.target,meshes)){
      trackedHead();placeVRHead(THREE,rig,head,pendingTeleport.target.clone().setY(context.floorY));
      for(const state of controllers)state.marker.visible=false;
    }
    pendingTeleport=null;pendingDoor=null;
    renderer.render(scene,camera);
  }
  void checkSupport();
  return {get active(){return !!session;}};
}
