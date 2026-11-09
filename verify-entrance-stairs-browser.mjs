import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('.',import.meta.url));
const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://localhost').pathname;
  let data=await readFile(resolve(root,'.'+path));
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();','window.entranceCheck={THREE,scene,camera,renderer,controls,walkingHeight,siteTerrain,localHouseData,houseTerrainY};ViewerLoading.finish();');
  if(['.html','.js','.mjs'].includes(extname(path)))data=data.toString().replaceAll('https://unpkg.com/three@0.186.0/','/node_modules/three/');
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'}[extname(path)]||'application/octet-stream'}).end(data);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const output=process.env.ENTRANCE_OUTPUT||'/tmp/entrance-stairs';await mkdir(output,{recursive:true});
  for(const variant of ['straight','aligned','sketch']){
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?entrance=${variant}`);
    await page.waitForFunction(()=>window.entranceCheck,null,{timeout:180000});
    await page.locator('#viewerLoading').waitFor({state:'detached',timeout:30000});
    const measurements=await page.evaluate(async variant=>{
      const {buildEntranceLuneta,entranceLunetaPavingDatum}=await import('./entrance-luneta-model.js');
      const {THREE,scene,walkingHeight,camera,controls,renderer,siteTerrain,localHouseData,houseTerrainY}=entranceCheck;
      const datum=entranceLunetaPavingDatum(localHouseData,GARDEN,(x,z)=>SiteTerrain.drivewayFinish(siteTerrain.spec,x,z),{variant});
      const model=buildEntranceLuneta(localHouseData,GARDEN,houseTerrainY,datum,{variant});
      const stairs=scene.getObjectByName(model.name),ray=new THREE.Raycaster();
      const posts=scene.getObjectByName('carport_posts');
      if(!posts)throw new Error('Carport supports missing');
      if(!stairs)throw new Error('Entrance model missing from scene');
      scene.updateMatrixWorld(true);
      const {carportPostLayout}=await import('./carport-posts-model.js');
      for(const post of carportPostLayout(GARDEN)){
        ray.set(new THREE.Vector3(post.x,20,post.z),new THREE.Vector3(0,-1,0));
        const hit=ray.intersectObject(posts,true)[0];
        if(!hit||hit.point.y<houseTerrainY+2)throw new Error(`Missing full-height carport post: ${post.id}`);
      }
      let count=0,maxError=0,walkError=0;
      for(const surface of model.walkSurfaces){
        const x=(surface.x0+surface.x1)/2,z=(surface.z0+surface.z1)/2;
        ray.set(new THREE.Vector3(x,houseTerrainY+.1,z),new THREE.Vector3(0,-1,0));
        const hit=ray.intersectObject(stairs,true)[0];
        if(!hit)throw new Error('Missing walk surface');
        let bestError=Math.abs(hit.point.y-surface.y);
        for(const dx of [-.013,.013]){
          ray.set(new THREE.Vector3(x+dx,houseTerrainY+.1,z+.017),new THREE.Vector3(0,-1,0));
          const probe=ray.intersectObject(stairs,true)[0];
          if(probe)bestError=Math.min(bestError,Math.abs(probe.point.y-surface.y));
        }
        maxError=Math.max(maxError,bestError);
        const walkX=surface.name.startsWith('entrance_east_')?surface.x1-.04:x;
        const walkZ=surface.name.startsWith('entrance_south_')?surface.z1-.04:z;
        walkError=Math.max(walkError,Math.abs(walkingHeight(walkX,walkZ)-surface.y));
        count++;
      }
      for(const surface of [model.soil,model.proposedFill]){
        const x=(surface.x0+surface.x1)/2,z=(surface.z0+surface.z1)/2;
        walkError=Math.max(walkError,Math.abs(walkingHeight(x,z)-surface.y));
      }
      const toggle=document.getElementById('toggleVehicles');toggle.checked=false;toggle.dispatchEvent(new Event('change',{bubbles:true}));
      camera.position.set(24.2,4.4,24.5);controls.target.set(21.8,2.1,21);controls.update();renderer.render(scene,camera);
      return {variant,count,maxError,walkError,rise:model.dimensions.rise,datum};
    },variant);
    assert(measurements.count>=(variant==='straight'?4:6));assert(measurements.maxError<2e-6,JSON.stringify(measurements));assert(measurements.walkError<1e-7,JSON.stringify(measurements));
    await page.screenshot({path:`${output}/entrance-${variant}.png`});
    console.log(JSON.stringify(measurements));
  }
  assert.deepEqual(errors,[]);
  console.log(`Entrance variants rendered without browser errors: ${output}`);
}finally{await browser?.close();await new Promise(done=>server.close(done));}
