import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('.',import.meta.url));
const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://localhost').pathname;
  let data=await readFile(resolve(root,'.'+path));
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();',`window.egress={THREE,scene,camera,fpState,fpUpdate,walkingHeight,houseTerrainY,get doors(){return walkDoors;},get navigation(){return walkNavigation;},aim(x,z,yaw){camera.position.set(x,walkingHeight(x,z)+1.7,z);walkNavigation.reset(camera.position);fpYaw=yaw;fpPitch=0;fpUpdate(0);requestRender();}};ViewerLoading.finish();`);
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(path)]||'application/octet-stream'}).end(data);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>window.egress,null,{timeout:120000});
  await page.locator('#walkButton').click();
  await page.waitForFunction(()=>document.querySelector('#walkInteriorStatus').dataset.state==='ready',null,{timeout:120000});
  const approach=await page.evaluate(()=>{
    const r=egress,door=r.doors.doors.find(g=>g.name==='opening_W9_2');
    const center=new r.THREE.Box3().setFromObject(door.userData.walkDoor.leaf).getCenter(new r.THREE.Vector3());
    r.aim(center.x-1.4,center.z,-Math.PI/2);
    return {center:center.toArray(),camera:r.camera.position.toArray(),aimed:r.navigation.aimedDoor(r.camera)?.name};
  });
  const closed=await page.evaluate(()=>{const r=egress,start=r.camera.position.clone();r.fpState.keys={w:true};for(let i=0;i<150;i++)r.fpUpdate(1/60);r.fpState.keys={};const x=r.camera.position.x;r.aim(start.x,start.z,-Math.PI/2);return x;});
  assert(closed<approach.center[0],'Closed entrance still blocks passage');
  await page.keyboard.press('e');
  assert(await page.evaluate(()=>egress.doors.doors.find(g=>g.name==='opening_W9_2').userData.walkDoor.open),'Entrance opens from the hallway');
  const outward=await page.evaluate(()=>{
    const r=egress,start=r.camera.position.toArray(),samples=[];
    r.fpState.keys={w:true};
    for(let i=0;i<150;i++){r.fpUpdate(1/60);if(i%10===0)samples.push({position:r.camera.position.toArray(),state:r.navigation.levels.state,ground:r.walkingHeight(r.camera.position.x+.04,r.camera.position.z),stand:r.doors.canStandAt(r.camera.position.x+.04,r.camera.position.z,r.walkingHeight(r.camera.position.x+.04,r.camera.position.z)+1.7)});}
    r.fpState.keys={};return {start,end:r.camera.position.toArray(),samples};
  });
  await page.screenshot({path:process.env.ENTRANCE_SCREENSHOT||'/tmp/entrance-egress.png'});
  assert(outward.end[0]>22.12,'Walker clears the final tread and body radius onto the outside paving');
  assert(Math.abs(outward.end[1]-3.675)<1e-6,'Walker reaches the paving below the entrance steps');
  const inward=await page.evaluate(()=>{
    const r=egress;r.aim(r.camera.position.x,r.camera.position.z,Math.PI/2);
    r.fpState.keys={w:true};for(let i=0;i<150;i++)r.fpUpdate(1/60);r.fpState.keys={};
    return r.camera.position.toArray();
  });
  assert(inward[0]<19.5,'Walker returns through the entrance from the outside steps');
  assert(Math.abs(inward[1]-4.165)<1e-6,'Returning walker reaches house floor height');
  console.log(JSON.stringify({closed,outward:outward.end,inward,errors}));
  assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(done=>server.close(done));}
