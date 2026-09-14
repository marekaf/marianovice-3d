import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('.',import.meta.url));
const hook=`window.vrReview={THREE,scene,camera,renderer,controls,vrWalk,houseTerrainY,localHouseData,get house(){return walkHouse;},get shown(){return [roofGroup,walkHouse.furniture,walkHouse.loft.furniture];},hidden:[treesGroup,vehiclesGroup,furnitureGroup,outdoorLoungeGroup,cotoneasterGroup]};ViewerLoading.finish();`;
const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+path);
  let data=await readFile(file);
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();',hook);
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'}[extname(file)]||'application/octet-stream'});res.end(data);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[];
  async function open(supported){
    const page=await browser.newPage({viewport:{width:1000,height:700}}),requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>requests.push(request.url()));
    await page.addInitScript(supported=>{
      window.vrSessionRequests=[];
      Object.defineProperty(navigator,'xr',{configurable:true,value:{
        isSessionSupported:async mode=>supported&&mode==='immersive-vr',
        requestSession:async(mode,options)=>{window.vrSessionRequests.push({mode,options});throw new Error('Headset request rejected by test');},
        addEventListener(){},removeEventListener(){},
      }});
    },supported);
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    try{await page.waitForFunction(()=>window.vrReview,null,{timeout:120000});}
    catch(error){throw new Error(`${error.message}; page errors: ${JSON.stringify(errors)}`);}
    console.log(`Desktop ready; mocked XR support: ${supported}`);
    assert(!requests.some(url=>url.includes('/docs/walk-interior.js')),'Initial desktop rendering must not load furnished interiors');
    assert(await page.evaluate(()=>vrReview.renderer.info.render.triangles>0),'Initial desktop scene renders geometry');
    return page;
  }
  const unsupported=await open(false);
  await unsupported.locator('#vrButton').click();
  assert.equal(await unsupported.locator('#enterVR').isDisabled(),true);
  assert.match(await unsupported.locator('#vrStatus').textContent(),/Meta Quest Browser/);
  assert.equal(await unsupported.evaluate(()=>vrSessionRequests.length),0);
  assert.equal(await unsupported.evaluate(()=>!!vrReview.house),false);
  await unsupported.keyboard.press('Escape');
  assert.equal(await unsupported.locator('#vrPanel').isVisible(),false);
  for(const width of [320,390,1000]){
    await unsupported.setViewportSize({width,height:844});
    for(const button of await unsupported.locator('#viewerToolbar button:visible').all()){
      const bounds=await button.boundingBox();
      assert(bounds.x>=0&&bounds.x+bounds.width<=width,`${await button.textContent()} fits the ${width}px toolbar`);
    }
  }
  await unsupported.locator('#vrButton').click();
  await unsupported.locator('[data-panel="views"]').click();
  assert.equal(await unsupported.locator('#vrPanel').isVisible(),false,'Opening another panel closes VR');
  await unsupported.locator('#vrButton').click();
  assert.equal(await unsupported.locator('.viewer-panel:visible').count(),1,'VR closes other panels');
  await unsupported.screenshot({path:'/tmp/quest-vr-ui.png'});
  await unsupported.close();

  const page=await open(true);
  await page.locator('#vrButton').click();
  await page.waitForFunction(()=>!document.querySelector('#enterVR').disabled,null,{timeout:120000});
  assert.equal(await page.locator('#enterVR').textContent(),'Enter VR');
  assert.equal(await page.locator('#walkInteriorStatus').getAttribute('data-state'),'ready');
  await page.evaluate(()=>{for(const object of vrReview.shown)object.visible=false;});
  async function desktop(){return page.evaluate(()=>{
    const r=vrReview;
    return {position:r.camera.position.toArray(),quaternion:r.camera.quaternion.toArray(),parent:r.camera.parent?.name??null,
      projection:[r.camera.fov,r.camera.aspect,r.camera.near,r.camera.far],shadows:r.renderer.shadowMap.enabled,
      visibility:r.hidden.map(object=>object.visible),shown:r.shown.map(object=>object.visible),controls:r.controls.enabled};
  });}
  const before=await desktop();
  await page.locator('#enterVR').click();
  await page.waitForFunction(()=>document.querySelector('#vrStatus').textContent.includes('Headset request rejected by test'));
  assert.deepEqual(await desktop(),before,'Rejected session preserves the desktop camera and scene');
  assert.equal(await page.locator('#enterVR').isDisabled(),false,'Rejected session can be retried');
  assert.deepEqual(await page.evaluate(()=>vrSessionRequests),[{mode:'immersive-vr',options:{requiredFeatures:['local-floor']}}]);

  await page.evaluate(()=>{
    const r=vrReview;
    window.vrHarness={loop:null,renderCalls:0,offset:[.35,1.65,.25],tracked:[.3,1.65,.2]};
    const harness=window.vrHarness,render=r.renderer.render.bind(r.renderer);
    r.renderer.render=(...args)=>{harness.renderCalls++;return render(...args);};
    r.renderer.setAnimationLoop=callback=>{harness.loop=callback;};
    r.renderer.xr.setSession=async session=>{harness.session=session;};
    r.renderer.xr.getReferenceSpace=()=>({});
    r.renderer.xr.updateCamera=camera=>{camera.position.fromArray(harness.offset);camera.updateMatrixWorld(true);};
    navigator.xr.requestSession=async()=>({visibilityState:'visible',end:async()=>r.renderer.xr.dispatchEvent({type:'sessionend'})});
    harness.frame=()=>harness.loop(0,{getViewerPose:()=>({transform:{position:new r.THREE.Vector3().fromArray(harness.tracked)}})});
    harness.head=()=>new r.THREE.Vector3().fromArray(harness.tracked).applyMatrix4(r.scene.getObjectByName('VR player').matrixWorld).toArray();
  });
  await page.locator('#enterVR').click();
  await page.waitForFunction(()=>!!vrHarness.loop);
  const entry=await page.evaluate(()=>{
    const r=vrReview,h=vrHarness;
    h.frame();
    const rig=r.scene.getObjectByName('VR player');
    return {head:h.head(),scale:rig.scale.toArray(),floor:rig.position.y,
      spawn:[r.localHouseData.originPlot.x+6,r.houseTerrainY+1.65,r.localHouseData.originPlot.z+10.3],
      hidden:r.hidden.every(object=>!object.visible),shown:r.shown.every(object=>object.visible),shadows:r.renderer.shadowMap.enabled,controls:r.controls.enabled,renderCalls:h.renderCalls};
  });
  assert.deepEqual(entry.scale,[1,1,1],'VR retains metre scale');
  entry.head.forEach((value,index)=>assert(Math.abs(value-entry.spawn[index])<1e-8,'Tracked room offset is removed from initial landing'));
  assert(Math.abs(entry.floor-(entry.spawn[1]-1.65))<1e-8,'Rig sits at floor height without a second eye-height offset');
  assert(entry.hidden);assert(entry.shown,'VR shows the furnished house even when desktop layers were hidden');assert.equal(entry.shadows,false);assert.equal(entry.controls,false);assert(entry.renderCalls>0);
  const turn=await page.evaluate(()=>{
    const r=vrReview,h=vrHarness,controller=r.renderer.xr.getController(0),rig=r.scene.getObjectByName('VR player');
    const source={gamepad:{mapping:'xr-standard',axes:[0,0,1,0]}};
    controller.dispatchEvent({type:'connected',data:source});controller.visible=true;
    const position=()=>h.head();
    const yaw=()=>{const direction=new r.THREE.Vector3(0,0,1).applyQuaternion(rig.quaternion);return Math.atan2(direction.x,direction.z);};
    const before=position(),angle=yaw();
    h.frame();const after=position(),turned=yaw();
    h.frame();const held=yaw();
    source.gamepad.axes[2]=0;h.frame();source.gamepad.axes[2]=1;h.frame();
    return {before,after,angle,turned,held,second:yaw()};
  });
  turn.before.forEach((value,index)=>assert(Math.abs(value-turn.after[index])<1e-8,'Snap turn preserves tracked head position'));
  const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  assert(Math.abs(angleDifference(turn.turned,turn.angle)+Math.PI/6)<1e-8);
  assert.equal(turn.held,turn.turned,'Holding the thumbstick must not turn repeatedly');
  assert(Math.abs(angleDifference(turn.second,turn.turned)+Math.PI/6)<1e-8,'Releasing the stick permits the next snap turn');
  const teleport=await page.evaluate(()=>{
    const r=vrReview,h=vrHarness,controller=r.renderer.xr.getController(0),rig=r.scene.getObjectByName('VR player');
    controller.dispatchEvent({type:'connected',data:{gamepad:{mapping:'xr-standard',axes:[0,0,0,0]}}});controller.visible=true;
    const marker=r.scene.getObjectByName('VR teleport destination'),o=r.localHouseData.originPlot;
    function aim(x,z,height=1.2){
      rig.updateMatrixWorld(true);
      controller.position.copy(rig.worldToLocal(new r.THREE.Vector3(o.x+x,r.houseTerrainY+height,o.z+z)));
      controller.quaternion.copy(rig.quaternion).invert().multiply(new r.THREE.Quaternion().setFromAxisAngle(new r.THREE.Vector3(1,0,0),-Math.PI/2));
      controller.updateMatrix();
      h.frame();
      return marker.visible;
    }
    const spawnClear=aim(6,10.3);
    let destination=null;const probes=[];
    for(const [x,z]of [[6,10.8],[5.5,10.8],[5.5,10.3],[6,10.3]]){
      if(aim(x,z)){destination=marker.position.clone();break;}
      const ray=new r.THREE.Raycaster(new r.THREE.Vector3(o.x+x,r.houseTerrainY+1.8,o.z+z),new r.THREE.Vector3(0,-1,0),0,2);
      const meshes=[];r.scene.traverseVisible(object=>{if(object.isMesh)meshes.push(object);});
      const hit=ray.intersectObjects(meshes,false).find(hit=>{for(let p=hit.object;p;p=p.parent)if(!p.visible||p===rig)return false;return hit.object.material?.visible;});
      probes.push({x,z,hit:hit&&{name:hit.object.name,material:hit.object.material?.name,point:hit.point.toArray(),parent:hit.object.parent?.name},controller:controller.getWorldPosition(new r.THREE.Vector3()).toArray(),direction:controller.getWorldDirection(new r.THREE.Vector3()).negate().toArray()});
    }
    if(!destination)return {found:false,spawnClear,probes};
    controller.dispatchEvent({type:'select'});h.frame();
    const landed=h.head(),wall=r.localHouseData.intWalls[0];
    const wallTarget=aim((wall.a[0]+wall.b[0])/2,(wall.a[1]+wall.b[1])/2,3.5);
    const beforeBlocked=h.head();controller.dispatchEvent({type:'select'});h.frame();
    return {found:true,spawnClear,destination:destination.toArray(),landed,wallTarget,beforeBlocked,afterBlocked:h.head()};
  });
  assert(teleport.found,`Controller ray finds a clear landing on actual furnished-house floor geometry: ${JSON.stringify(teleport)}`);
  console.log(JSON.stringify({teleport}));
  assert(teleport.spawnClear,'Initial living-room spawn has clear standing space on the actual floor geometry');
  assert(Math.hypot(teleport.landed[0]-entry.head[0],teleport.landed[2]-entry.head[2])>=.49,'Teleport changes tracked head position rather than accepting a no-op');
  for(const axis of [0,2])assert(Math.abs(teleport.landed[axis]-teleport.destination[axis])<1e-7,'Trigger places tracked head above the chosen floor point');
  assert.equal(teleport.wallTarget,false,'A wall surface must not become a teleport destination');
  assert.deepEqual(teleport.afterBlocked,teleport.beforeBlocked,'Trigger on an obstruction leaves the rig in place');
  await page.evaluate(()=>{document.getElementById('viewerUI').hidden=true;vrHarness.frame();});
  await page.screenshot({path:'/tmp/quest-vr-preview.png'});
  await page.evaluate(()=>{document.getElementById('viewerUI').hidden=false;});
  await page.evaluate(()=>vrHarness.session.end());
  assert.deepEqual(await desktop(),before,'Session exit restores the desktop camera, visibility, projection and controls');
  assert.equal(await page.evaluate(()=>vrReview.scene.getObjectByName('VR player')===undefined),true);
  assert.equal(await page.evaluate(()=>vrHarness.loop),null);
  assert.equal(await page.locator('#enterVR').isDisabled(),false);
  assert(await page.evaluate(()=>{vrReview.renderer.render(vrReview.scene,vrReview.camera);return vrReview.renderer.info.render.triangles>0;}),'Desktop geometry renders after XR exit');
  await page.locator('#enterVR').click();
  await page.waitForFunction(()=>!!vrHarness.loop);
  await page.evaluate(()=>{vrHarness.frame();return vrHarness.session.end();});
  assert.deepEqual(await desktop(),before,'A second session also restores desktop state');
  assert.deepEqual(errors,[]);
  await page.close();
  console.log('VR browser regression passed: unsupported UI, lazy interiors, rejected request retry, mocked session entry/exit, metre scale, tracked snap turns, actual-floor teleport and wall rejection. Preview: /tmp/quest-vr-preview.png. Headset runtime and performance remain untested.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
