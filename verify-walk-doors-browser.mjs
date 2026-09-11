import assert from 'node:assert/strict';
import {prepareReviewFloor,captureReview} from './scripts/review-floor.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('.',import.meta.url));
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+pathname);
    if(!file.startsWith(root))throw new Error('Invalid path');
    let body=await readFile(file);
    if(pathname==='/index.html')body=body.toString().replace('ViewerLoading.finish();',`window.doorReview={THREE,scene,camera,fpState,loadWalkInterior,get doors(){return walkDoors;},aim(group,side=1){const b=new THREE.Box3().setFromObject(group.userData.walkDoor.leaf),c=b.getCenter(new THREE.Vector3());camera.position.set(c.x+side*1.4,houseTerrainY+1.7,c.z);fpYaw=side*Math.PI/2;fpPitch=0;fpUpdate(0);requestRender();},aimPocket(group,side){const p=group.userData.walkDoor.panel.position,c=group.localToWorld(new THREE.Vector3(p[0],1.7,p[1]));camera.position.copy(c);camera.position.z+=side*.8;fpYaw=side===1?0:Math.PI;fpPitch=0;fpUpdate(0);requestRender();},update(){fpUpdate(0);requestRender();},tick(dt){fpUpdate(dt);requestRender();}};ViewerLoading.finish();`);
    if(pathname==='/index.html')body=body.replace('ViewerLoading.finish();',`doorReview.aimWindow=function(group){const door=group.userData.walkDoor,b=new THREE.Box3().setFromObject(door.leaf),c=b.getCenter(new THREE.Vector3());camera.position.set(c.x,houseTerrainY+1.7,c.z+(door.opening.hinge==='north'?1:-1)*.9);fpYaw=door.opening.hinge==='north'?0:Math.PI;fpPitch=0;fpUpdate(0);requestRender();};ViewerLoading.finish();`);
    res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(file)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  await prepareReviewFloor(page);
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>window.doorReview,null,{timeout:120000});
  await page.locator('#walkButton').click();
  await page.waitForFunction(()=>document.querySelector('#walkInteriorStatus').dataset.state==='ready',null,{timeout:120000});
  assert(await page.locator('#toggleFP').isChecked());
  const spawn=await page.evaluate(()=>{const r=doorReview;return r.doors.canStandAt(r.camera.position.x,r.camera.position.z,r.camera.position.y);});
  assert(spawn,'Lazy completion leaves the walker at a valid position');
  const before=await page.evaluate(()=>{
    const r=doorReview,g=r.doors.doors.find(group=>group.name==='opening_W22_0');r.aim(g);
    return{frame:new r.THREE.Box3().setFromObject(g.userData.categories.openings),count:r.doors.doors.length};
  });
  await page.waitForFunction(()=>!document.querySelector('#walkDoorPrompt').hidden);
  assert.match(await page.locator('#walkDoorPrompt').textContent(),/E · Open/);
  await page.keyboard.press('e');
  const opened=await page.evaluate(()=>{
    const r=doorReview,g=r.doors.doors.find(group=>group.name==='opening_W22_0');
    return{open:g.userData.walkDoor.open,angle:g.userData.walkDoor.pivot.rotation.y,frame:new r.THREE.Box3().setFromObject(g.userData.categories.openings)};
  });
  assert(opened.open);assert.equal(opened.angle,-Math.PI/2);assert.deepEqual(opened.frame,before.frame);
  await captureReview(page,{path:process.env.DOOR_SCREENSHOT||'/tmp/garden-door-open.png'});
  const passage=await page.evaluate(()=>{
    const r=doorReview,g=r.doors.doors.find(group=>group.name==='opening_W22_0'),p=g.userData.walkDoor.panel.position;
    const center=g.localToWorld(new r.THREE.Vector3(p[0],1.7,p[1]));
    r.camera.position.copy(center).add(new r.THREE.Vector3(.9,0,0));
    r.fpState.keys={w:true};for(let frame=0;frame<90;frame++)r.tick(1/60);r.fpState.keys={};
    return{x:r.camera.position.x,center:center.x,valid:r.doors.canStandAt(r.camera.position.x,r.camera.position.z)};
  });
  assert(passage.x<passage.center);assert(passage.valid);
  const closing=await page.evaluate(()=>{
    const r=doorReview,g=r.doors.doors.find(group=>group.name==='opening_W22_0'),p=g.userData.walkDoor.panel.position;
    r.camera.position.copy(g.localToWorld(new r.THREE.Vector3(p[0],1.7,p[1])));
    return{allowed:r.doors.toggle(g,r.camera),open:g.userData.walkDoor.open};
  });
  assert(!closing.allowed);assert(closing.open);
  const entrance=await page.evaluate(()=>{const g=doorReview.doors.doors.find(group=>group.name==='opening_W9_2');return{y:g.position.y,hinge:g.userData.walkDoor.opening.hinge};});
  assert.equal(entrance.y,2.465);assert.equal(entrance.hinge,'south');
  for(const name of ['opening_W7_0','opening_W9_1']){
    await page.evaluate(name=>{const r=doorReview,g=r.doors.doors.find(g=>g.name===name);r.aim(g);},name);
    await page.waitForFunction(()=>document.querySelector('#walkDoorPrompt').textContent.includes('Open sliding portal'));
    await page.keyboard.press('e');
    assert.equal(await page.evaluate(name=>doorReview.doors.doors.find(g=>g.name===name).userData.walkDoor.open,name),true);
    if(process.env.PORTAL_SCREENSHOT_DIR)await captureReview(page,{path:resolve(process.env.PORTAL_SCREENSHOT_DIR,`${name}-open.png`)});
    const passage=await page.evaluate(name=>{
      const r=doorReview,g=r.doors.doors.find(g=>g.name===name);
      const p=g.userData.walkDoor.model.parts.find(p=>p.name===`${name}_north_glass`).position;
      const center=g.localToWorld(new r.THREE.Vector3(p[0],1.7,p[1]));
      r.camera.position.copy(center).add(new r.THREE.Vector3(.8,0,0));
      r.fpState.keys={w:true};for(let frame=0;frame<90;frame++)r.tick(1/60);r.fpState.keys={};
      return{x:r.camera.position.x,center:center.x,valid:r.doors.canStandAt(r.camera.position.x,r.camera.position.z)};
    },name);
    assert(passage.x<passage.center,`${name}: walk through the open portal`);assert(passage.valid);
    await page.evaluate(name=>{const r=doorReview,g=r.doors.doors.find(g=>g.name===name);r.aim(g,name==='opening_W7_0'?1:-1);},name);
    await page.waitForFunction(()=>document.querySelector('#walkDoorPrompt').textContent.includes('Close sliding portal'));
    await page.keyboard.press('e');
    assert.equal(await page.evaluate(name=>doorReview.doors.doors.find(g=>g.name===name).userData.walkDoor.open,name),false);
  }
  for(const name of ['opening_W3_0','opening_W3_1','opening_W4_0','opening_W4_1']){
    await page.evaluate(name=>{const r=doorReview;r.aim(r.doors.doors.find(g=>g.name===name));},name);
    await page.waitForFunction(()=>!document.querySelector('#walkDoorPrompt').hidden&&document.querySelector('#walkDoorPrompt').textContent.includes('Open hinged window'));
    await page.keyboard.press('e');
    assert(await page.evaluate(name=>doorReview.doors.doors.find(g=>g.name===name).userData.walkDoor.open,name));
    if(process.env.WINDOW_SCREENSHOT_DIR)await captureReview(page,{path:resolve(process.env.WINDOW_SCREENSHOT_DIR,`${name}-open.png`)});
    const passage=await page.evaluate(name=>{
      const r=doorReview,g=r.doors.doors.find(g=>g.name===name),door=g.userData.walkDoor;
      const p=door.model.parts.find(p=>p.name===`${name}_${door.opening.movingHalf}_glass`).position;
      const center=g.localToWorld(new r.THREE.Vector3(p[0],1.7,p[1]));
      r.camera.position.copy(center).add(new r.THREE.Vector3(.8,0,0));
      r.fpState.keys={w:true};for(let frame=0;frame<90;frame++)r.tick(1/60);r.fpState.keys={};
      return{x:r.camera.position.x,center:center.x,valid:r.doors.canStandAt(r.camera.position.x,r.camera.position.z)};
    },name);
    assert(passage.x<passage.center,`${name}: walk through the open hinged sash`);assert(passage.valid);
    await page.evaluate(name=>{const r=doorReview;r.aimWindow(r.doors.doors.find(g=>g.name===name));},name);
    await page.waitForFunction(()=>!document.querySelector('#walkDoorPrompt').hidden&&document.querySelector('#walkDoorPrompt').textContent.includes('Close hinged window'));
    await page.keyboard.press('e');
    assert.equal(await page.evaluate(name=>doorReview.doors.doors.find(g=>g.name===name).userData.walkDoor.open,name),false);
  }
  for(const [name,approach]of [['opening_W15_0',1],['opening_W24_0',-1]]){
    await page.evaluate(([name,side])=>{const r=doorReview;r.aimPocket(r.doors.doors.find(g=>g.name===name),side);},[name,approach]);
    await page.waitForFunction(()=>!document.querySelector('#walkDoorPrompt').hidden&&document.querySelector('#walkDoorPrompt').textContent.includes('Open pocket door'));
    if(process.env.POCKET_SCREENSHOT_DIR)await captureReview(page,{path:resolve(process.env.POCKET_SCREENSHOT_DIR,`${name}-closed.png`)});
    await page.keyboard.press('e');
    assert(await page.evaluate(name=>doorReview.doors.doors.find(g=>g.name===name).userData.walkDoor.open,name));
    if(process.env.POCKET_SCREENSHOT_DIR)await captureReview(page,{path:resolve(process.env.POCKET_SCREENSHOT_DIR,`${name}-open.png`)});
    for(const side of [approach,-approach]){
      const passage=await page.evaluate(([name,side])=>{
        const r=doorReview,g=r.doors.doors.find(g=>g.name===name),p=g.userData.walkDoor.panel.position;
        const center=g.localToWorld(new r.THREE.Vector3(p[0],1.7,p[1]));
        r.aimPocket(g,side);r.camera.position.z=center.z+side*.8;
        r.fpState.keys={w:true};for(let frame=0;frame<70;frame++)r.tick(1/60);r.fpState.keys={};
        return{z:r.camera.position.z,center:center.z,valid:r.doors.canStandAt(r.camera.position.x,r.camera.position.z)};
      },[name,side]);
      assert((passage.z-passage.center)*side<0,`${name}: pocket passage works from side ${side}`);assert(passage.valid);
    }
    await page.evaluate(([name,side])=>{const r=doorReview;r.aimPocket(r.doors.doors.find(g=>g.name===name),side);},[name,-approach]);
    await page.waitForFunction(()=>!document.querySelector('#walkDoorPrompt').hidden&&document.querySelector('#walkDoorPrompt').textContent.includes('Close pocket door'));
    assert.match(await page.locator('#walkDoorPrompt').textContent(),/provisional dimensions/);
    await page.keyboard.press('e');
    assert.equal(await page.evaluate(name=>doorReview.doors.doors.find(g=>g.name===name).userData.walkDoor.open,name),false);
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({doors:before.count,passage,entrance,errors}));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
