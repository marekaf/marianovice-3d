import assert from 'node:assert/strict';
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
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();',`window.walkReview={scene,camera,renderer,fpState,loadWalkInterior,houseInteriorBacking,houseTerrainY,get house(){return walkHouse;},aim(x,z,yaw,pitch=0){camera.position.set(x,walkingHeight(x,z)+1.7,z);fpYaw=yaw;fpPitch=pitch;fpUpdate(0);requestRender();}};ViewerLoading.finish();`);
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(file)]||'application/octet-stream'});res.end(data);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>window.walkReview,null,{timeout:120000});
  assert(!requests.some(url=>url.includes('/docs/walk-interior.js')),'Initial garden must not request interiors');
  await page.locator('#toggleFurniture').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change'));});
  await page.locator('#toggleFP').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change'));});
  await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#walkInteriorStatus').dataset.state),null,{timeout:120000});
  assert.equal(await page.locator('#walkInteriorStatus').getAttribute('data-state'),'ready',await page.locator('#walkInteriorStatus').textContent());
  const metrics=await page.evaluate(()=>{
    const r=walkReview,house=r.scene.getObjectByName('garden-walk-interior');
    let meshes=0,lights=0,bytes=0;const geometries=new Set();
    house.traverse(o=>{if(o.isMesh)meshes++;if(o.isLight&&o.visible)lights++;if(o.geometry)geometries.add(o.geometry);});
    for(const g of geometries)for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;
    return {meshes,lights,geometryMB:bytes/1024/1024,position:house.position.toArray(),floorY:r.houseTerrainY,backingVisible:r.houseInteriorBacking.visible};
  });
  assert(metrics.meshes>100);assert.equal(metrics.backingVisible,false);assert.equal(metrics.position[1],metrics.floorY);
  assert.equal(await page.evaluate(()=>walkReview.house.furniture.visible),false);
  await page.locator('#toggleFurniture').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change'));});
  assert.equal(await page.evaluate(()=>walkReview.house.furniture.visible),true);
  for(const [name,x,z,yaw,pitch] of [['living',17.5,18,0,0],['office',13,22.3,0,-.2],['bedroom',18.5,10.3,0,-.2]]){
    await page.evaluate(([x,z,yaw,pitch])=>walkReview.aim(x,z,yaw,pitch),[x,z,yaw,pitch]);
    await page.waitForTimeout(350);
    if(process.env.WALK_SCREENSHOT_DIR)await page.screenshot({path:resolve(process.env.WALK_SCREENSHOT_DIR,`garden-interior-${name}.png`)});
  }
  await page.evaluate(async()=>{await walkReview.loadWalkInterior();await walkReview.loadWalkInterior();});
  await page.evaluate(()=>{walkReview.aim(17.5,19,0);walkReview.fpState.keys.w=true;});
  await page.waitForTimeout(150);
  const movement=await page.evaluate(()=>{walkReview.fpState.keys={};return walkReview.camera.position.toArray();});
  assert(movement[2]<19,'W moves through the furnished house');
  assert.equal(await page.evaluate(()=>walkReview.scene.children.filter(o=>o.name==='garden-walk-interior').length),1);
  console.log(JSON.stringify({metrics,errors},null,2));assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(done=>server.close(done));}
