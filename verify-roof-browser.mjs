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
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();',
    'window.roofReview={scene,camera,controls,renderer,houseRoofSpec,houseMesh,houseInteriorBacking,houseTerrainY,loadWalkInterior,get house(){return walkHouse;},requestRender};ViewerLoading.finish();');
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(path)]||'application/octet-stream'}).end(data);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>window.roofReview,null,{timeout:120000});
  await page.waitForFunction(()=>!document.querySelector('#viewerLoading'));
  const verifyCaps=async()=>page.evaluate(async()=>{
    const THREE=await import('three'),r=roofReview,point=new THREE.Vector3();
    r.scene.updateMatrixWorld(true);
    let cappedMeshes=0,vertices=0,excess=0;
    r.scene.traverse(mesh=>{
      if(!mesh.userData.roofWallCap)return;
      cappedMeshes++;
      const positions=mesh.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
        const cap=Math.min(r.houseTerrainY+3.07,r.houseRoofSpec.westWing.undersideHeightAt(point.x));
        excess=Math.max(excess,point.y-cap);vertices++;
      }
    });
    return{cappedMeshes,vertices,excess};
  });
  const initial=await verifyCaps();
  assert(initial.cappedMeshes>1,'The facade and wall backing must both meet the soffit');
  assert(initial.excess<1e-5,JSON.stringify(initial));
  for(const [name,position,target]of[
    ['west',[8.4,4.2,24],[11,5.5,22]],
    ['north',[14,4.3,4.5],[14,5.7,8]],
    ['atrium',[9,4.2,17.5],[13.5,5.65,17.5]],
    ['east',[25,4.3,9],[21.3,5.5,9]],
  ]){
    await page.evaluate(({position,target})=>{
      const r=roofReview;r.controls.enableDamping=false;r.controls.maxPolarAngle=Math.PI;
      r.controls.minDistance=.1;r.camera.position.set(...position);
      r.controls.target.set(...target);r.controls.update();r.requestRender();
    },{position,target});
    await page.waitForTimeout(250);
    if(process.env.ROOF_SCREENSHOT_DIR)await page.screenshot({path:resolve(process.env.ROOF_SCREENSHOT_DIR,`roof-${name}.png`)});
  }
  await page.evaluate(()=>roofReview.loadWalkInterior());
  const furnished=await verifyCaps();
  assert(furnished.cappedMeshes>initial.cappedMeshes,'Furnished walking walls must meet the same roof profile');
  assert(furnished.excess<1e-5,JSON.stringify(furnished));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({initial,furnished,errors},null,2));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
