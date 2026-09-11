import assert from 'node:assert/strict';
import {prepareReviewFloor,waitForReviewFloor,captureReview} from './scripts/review-floor.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('.',import.meta.url));
const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://localhost').pathname;
  const file=resolve(root,'.'+path);
  let data=await readFile(file);
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();',`window.walkReview={scene,camera,renderer,fpState,fpUpdate,loadWalkInterior,houseInteriorBacking,houseTerrainY,get navigation(){return walkNavigation;},get house(){return walkHouse;},lookAt(x,z,pitch=0){fpYaw=Math.atan2(camera.position.x-x,camera.position.z-z);fpPitch=pitch;fpUpdate(0);requestRender();},aim(x,z,yaw,pitch=0){camera.position.set(x,walkingHeight(x,z)+1.7,z);walkNavigation?.reset(camera.position);fpYaw=yaw;fpPitch=pitch;fpUpdate(0);requestRender();}};ViewerLoading.finish();`);
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(file)]||'application/octet-stream'});res.end(data);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[],requests=[];
  await prepareReviewFloor(page);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>window.walkReview,null,{timeout:120000});
  assert(!requests.some(url=>url.includes('/docs/walk-interior.js')),'Initial garden must not request interiors');
  assert.equal(await page.evaluate(()=>walkReview.scene.getObjectByName('Roof flue before furnished interior')?.visible),true,'Initial garden retains the roof chimney without loading interiors');
  await page.locator('#toggleFurniture').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change'));});
  await page.locator('#toggleFP').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change'));});
  await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#walkInteriorStatus').dataset.state),null,{timeout:120000});
  assert.equal(await page.locator('#walkInteriorStatus').getAttribute('data-state'),'ready',await page.locator('#walkInteriorStatus').textContent());
  assert.equal(await page.evaluate(()=>walkReview.scene.getObjectByName('Roof flue before furnished interior').visible),false,'Furnished flue replaces the overlapping initial roof segment');
  assert.equal(await page.evaluate(()=>walkReview.scene.getObjectByName('Roof flue terminal').visible),true,'The roof terminal remains visible after interiors load');
  const hallwayHits=await page.evaluate(async()=>{
    const THREE=await import('three'),r=walkReview;
    r.scene.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(18.6,r.houseTerrainY+1.7,22),new THREE.Vector3(-1,0,0),0,2.2);
    ray.camera=r.camera;
    return ray.intersectObjects(r.scene.children,true).filter(hit=>{
      if(!hit.object.isMesh)return false;
      for(let o=hit.object;o;o=o.parent)if(!o.visible)return false;
      return true;
    }).map(hit=>({name:hit.object.name,point:hit.point.toArray()}));
  });
  assert.deepEqual(hallwayHits,[],'The entrance hallway passage must not contain an exterior chimney');
  const showerRevealHits=await page.evaluate(async()=>{
    const THREE=await import('three'),r=walkReview;
    const ray=new THREE.Raycaster(new THREE.Vector3(16.28,r.houseTerrainY+1.7,25.18),new THREE.Vector3(0,0,1),0,.79);
    ray.camera=r.camera;
    return ray.intersectObjects(r.scene.children,true).filter(hit=>{
      if(!hit.object.isMesh)return false;
      for(let o=hit.object;o;o=o.parent)if(!o.visible)return false;
      return true;
    }).map(hit=>({name:hit.object.name,point:hit.point.toArray()}));
  });
  assert.deepEqual(showerRevealHits,[],'Shower backing must not block the window reveal at eye height');
  await waitForReviewFloor(page);
  const metrics=await page.evaluate(()=>{
    const r=walkReview,house=r.scene.getObjectByName('garden-walk-interior');
    let meshes=0,lights=0,bytes=0;const geometries=new Set(),floors=[];
    house.traverse(o=>{if(o.isMesh)meshes++;if(o.isLight&&o.visible)lights++;if(o.geometry)geometries.add(o.geometry);});
    house.traverse(o=>{if(o.isMesh&&o.material.name==='floorWood')floors.push({name:o.name,
      color:o.material.color.getHexString(),map:o.material.map?.name,
      roomEnvironment:!!o.material.envMap&&o.material.envMap!==r.scene.environment});});
    for(const g of geometries)for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;
    return {meshes,lights,geometryMB:bytes/1024/1024,position:house.position.toArray(),floorY:r.houseTerrainY,backingVisible:r.houseInteriorBacking.visible,floors};
  });
  assert(metrics.meshes>100);assert.equal(metrics.backingVisible,false);assert.equal(metrics.position[1],metrics.floorY);
  assert.equal(metrics.floors.length,4);
  const loftFloor=await page.evaluate(async()=>{
    const THREE=await import('three'),r=walkReview,meshes=[];
    r.scene.updateMatrixWorld(true);
    r.scene.traverse(mesh=>{if(mesh.isMesh){let visible=true;for(let p=mesh;p;p=p.parent)visible&&=p.visible;if(visible)meshes.push(mesh);}});
    const hit=new THREE.Raycaster(new THREE.Vector3(18.88,r.houseTerrainY+4.5,21.98),new THREE.Vector3(0,-1,0)).intersectObjects(meshes,false)[0];
    return {material:hit.object.material.name,height:hit.point.y-r.houseTerrainY};
  });
  assert.equal(loftFloor.material,'floorWood','The exterior placeholder lid must not hide the loft vinyl');
  assert(Math.abs(loftFloor.height-2.92375)<1e-6);
  const stairWalk=await page.evaluate(()=>{
    const r=walkReview;r.aim(15.78,20.68,-Math.PI/2);
    const move=(x,z)=>{const oldX=r.camera.position.x,oldZ=r.camera.position.z;r.camera.position.x=x;r.camera.position.z=z;r.navigation.constrain(r.camera.position,oldX,oldZ);};
    move(19.28,20.68);const upstairs={position:r.camera.position.toArray(),state:r.navigation.levels.state};
    move(18.98,20.68);move(18.98,21.78);const landing=r.camera.position.toArray();
    move(18.98,20.68);move(15.78,20.68);const downstairs={position:r.camera.position.toArray(),state:r.navigation.levels.state};
    return {upstairs,landing,downstairs};
  });
  assert.equal(stairWalk.upstairs.state.surface,'loft');assert(Math.abs(stairWalk.upstairs.position[1]-metrics.floorY-4.62375)<1e-6);
  assert(Math.abs(stairWalk.landing[2]-21.78)<1e-6);
  assert.equal(stairWalk.downstairs.state.surface,'ground');assert(Math.abs(stairWalk.downstairs.position[1]-metrics.floorY-1.7)<1e-6);
  for(const floor of metrics.floors){
    assert.equal(floor.color,'ffffff');assert.equal(floor.map,process.env.FLOOR_REFERENCE?'Local Floorify Champagne reference':'Floorify Champagne');
    assert(floor.roomEnvironment,`${floor.name}: enclosed flooring must use a room environment, not outdoor sky`);
  }
  assert.equal(await page.evaluate(()=>walkReview.house.furniture.visible),false);
  assert.equal(await page.evaluate(()=>walkReview.house.loft.furniture.visible),false);
  await page.locator('#toggleFurniture').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change'));});
  assert.equal(await page.evaluate(()=>walkReview.house.furniture.visible),true);
  assert.equal(await page.evaluate(()=>walkReview.house.loft.furniture.visible),true);
  await page.locator('#toggleFurniture').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change'));});
  const floorPixel=await page.evaluate(async()=>{
    const THREE=await import('three'),r=walkReview;
    r.aim(12,22.3,0,-.7);
    const ray=new THREE.Raycaster(new THREE.Vector3(12,r.houseTerrainY+.4,21),new THREE.Vector3(0,-1,0));
    const meshes=[];r.house.floor.traverse(o=>{if(o.isMesh)meshes.push(o);});
    const hit=ray.intersectObjects(meshes,false)[0];
    r.renderer.render(r.scene,r.camera);
    const point=hit.point.clone().project(r.camera),size=r.renderer.getDrawingBufferSize(new THREE.Vector2());
    const pixel=new Uint8Array(4),gl=r.renderer.getContext();
    gl.readPixels(Math.floor((point.x+1)*size.x/2),Math.floor((point.y+1)*size.y/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    return{material:hit.object.material.name,height:hit.point.y-r.houseTerrainY,rgb:[...pixel.slice(0,3)],projected:point.toArray()};
  });
  assert.equal(floorPixel.material,'floorWood');
  assert(Math.abs(floorPixel.height-.003)<1e-7);
  assert(floorPixel.rgb[0]>floorPixel.rgb[2],`Champagne vinyl must render warm, not with the outdoor cyan cast: ${JSON.stringify(floorPixel)}`);
  await page.locator('#toggleFurniture').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change'));});
  const reviewFov=await page.evaluate(()=>{const camera=walkReview.camera,previous=camera.fov;camera.fov=75;camera.updateProjectionMatrix();return previous;});
  for(const [name,x,z,yaw,pitch] of [
    ['living',17.5,18,0,0],['office',13,22.3,0,-.2],['bedroom',18.5,10.3,0,-.2],
    ['entrance',15.8,21.4,-Math.PI/2,-.15],
    ['utility',18.5,23.6,-Math.PI/2,-.2],
    ['guest-bathroom',16.85,23.6,Math.PI,-.2],
    ['guest-bedroom',14.1,23.4,2.4,-.35],
    ['north-office',13.5,12.6,Math.PI/2,-.2],
    ['kitchen',17,14,-Math.PI/2,-.2],
    ['pantry',14.4,12.3,0,-.4],
    ['main-bathroom',13,10.5,0,-.45],
    ['dressing-west-upper',15.4,8.48,Math.PI/2,.25],
    ['dressing-west-lower',15.4,8.48,Math.PI/2,-.85],
    ['dressing-east-upper',14.65,8.48,-Math.PI/2,.25],
    ['dressing-east-lower',14.65,8.48,-Math.PI/2,-.85],
  ]){
    await page.evaluate(([x,z,yaw,pitch])=>walkReview.aim(x,z,yaw,pitch),[x,z,yaw,pitch]);
    await page.waitForTimeout(350);
    if(process.env.WALK_SCREENSHOT_DIR)await captureReview(page,{path:resolve(process.env.WALK_SCREENSHOT_DIR,`garden-interior-${name}.png`)});
  }
  await page.evaluate(async()=>{await walkReview.loadWalkInterior();await walkReview.loadWalkInterior();});
  await page.evaluate(fov=>{walkReview.camera.fov=fov;walkReview.camera.updateProjectionMatrix();},reviewFov);
  await page.evaluate(async()=>{
    const THREE=await import('three'),r=walkReview;
    r.aim(15.78,20.68,-Math.PI/2);
    const move=(x,z)=>{const oldX=r.camera.position.x,oldZ=r.camera.position.z;r.camera.position.x=x;r.camera.position.z=z;r.navigation.constrain(r.camera.position,oldX,oldZ);};
    move(19.28,20.68);move(18.98,20.68);move(18.98,21.78);
    const door=r.house.loft.doors[0];
    if(!r.navigation.toggle(door,r.camera))throw new Error('Loft door did not open');
    move(17.18,21.78);
    const target=new THREE.Box3().setFromObject(door.userData.walkDoor.leaf).getCenter(new THREE.Vector3());
    r.lookAt(target.x,target.z);
  });
  await page.waitForFunction(()=>!document.querySelector('#walkDoorPrompt').hidden&&document.querySelector('#walkDoorPrompt').textContent.includes('Close'));
  assert(await page.evaluate(()=>walkReview.navigation.aimedDoor(walkReview.camera)===walkReview.house.loft.doors[0]),'Oblique loft approach targets the visible open leaf');
  if(process.env.WALK_SCREENSHOT_DIR)await captureReview(page,{path:resolve(process.env.WALK_SCREENSHOT_DIR,'garden-interior-loft-door-oblique.png')});
  if(process.env.WALK_SCREENSHOT_DIR){
    for(const [name,x,z,targetX,targetZ] of [
      ['loft-gym',17.6,23,16.6,25],
      ['loft-hobby',18.3,23,19.6,25.4],
    ]){
      const pose=await page.evaluate(([x,z,targetX,targetZ])=>{
        const r=walkReview;
        r.camera.position.set(x,r.houseTerrainY+4.62375,z);
        r.camera.fov=75;r.camera.updateProjectionMatrix();
        r.lookAt(targetX,targetZ,-.35);
        return {height:r.camera.position.y-r.houseTerrainY,furniture:r.house.loft.furniture.visible,surface:r.navigation.levels.state.surface};
      },[x,z,targetX,targetZ]);
      assert.equal(pose.furniture,true);
      assert.equal(pose.surface,'loft');
      assert(Math.abs(pose.height-4.62375)<1e-6,'Loft review camera remains at upstairs eye height');
      await page.waitForTimeout(350);
      await captureReview(page,{path:resolve(process.env.WALK_SCREENSHOT_DIR,`garden-interior-${name}.png`)});
    }
    await page.evaluate(fov=>{walkReview.camera.fov=fov;walkReview.camera.updateProjectionMatrix();},reviewFov);
  }
  await page.evaluate(()=>{walkReview.aim(17.5,19,0);walkReview.fpState.keys.w=true;});
  await page.waitForTimeout(150);
  const movement=await page.evaluate(()=>{walkReview.fpState.keys={};return walkReview.camera.position.toArray();});
  assert(movement[2]<19,'W moves through the furnished house');
  const distances=await page.evaluate(()=>{
    const distances=[];
    for(const keys of [['w'],['w','Shift'],['w','d']]){
      walkReview.aim(17.5,19,0);
      for(const key of keys)document.dispatchEvent(new KeyboardEvent('keydown',{key}));
      for(let frame=0;frame<60;frame++)walkReview.fpUpdate(1/60);
      for(const key of keys)document.dispatchEvent(new KeyboardEvent('keyup',{key}));
      distances.push(Math.hypot(walkReview.camera.position.x-17.5,walkReview.camera.position.z-19));
    }
    return distances;
  });
  for(const [i,expected]of [1.4,3,1.4].entries())assert(Math.abs(distances[i]-expected)<1e-8);
  assert.equal(await page.evaluate(()=>walkReview.scene.children.filter(o=>o.name==='garden-walk-interior').length),1);
  const environmentLifecycle=await page.evaluate(()=>{
    const r=walkReview;let material;r.house.floor.traverse(o=>{if(o.material?.name==='floorWood')material=o.material;});
    const roomEnvironment=material.envMap,skyEnvironment=r.scene.environment;
    const slider=document.getElementById('timeSlider');slider.value=0;slider.dispatchEvent(new Event('input'));
    const independent=material.envMap===roomEnvironment&&r.scene.environment!==skyEnvironment;
    r.renderer.render(r.scene,r.camera);const before=r.renderer.info.memory.textures;
    r.house.root.removeFromParent();r.house.dispose();
    r.renderer.render(r.scene,r.camera);const after=r.renderer.info.memory.textures;
    return{independent,before,after};
  });
  assert(environmentLifecycle.independent,'Outdoor time changes must not replace the enclosed room environment');
  assert(environmentLifecycle.after<environmentLifecycle.before,'Disposing the interior releases its GPU textures');
  console.log(JSON.stringify({metrics,floorPixel,environmentLifecycle,errors},null,2));assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(done=>server.close(done));}
