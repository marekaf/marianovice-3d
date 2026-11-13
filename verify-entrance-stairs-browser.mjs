// browser-ci {"status":"ci-skipped","reason":"allows 30 s for the loading panel to close, and CPU rendering needs longer"}
import assert from 'node:assert/strict';
import {launchChrome,serveRepo} from './scripts/browser.mjs';
import {mkdir} from 'node:fs/promises';
const server=await serveRepo({rewrite(path,data){
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();','window.entranceCheck={THREE,scene,camera,renderer,controls,walkingHeight,siteTerrain,localHouseData,houseTerrainY,GardenRouteModel,ground};ViewerLoading.finish();');
  return data;
}});
let browser;
try{
  browser=await launchChrome();
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const output=process.env.ENTRANCE_OUTPUT||'/tmp/entrance-stairs';await mkdir(output,{recursive:true});
  for(const variant of ['aligned','straight','sketch']){
    await page.goto(`${server.origin}/index.html?entrance=${variant}`);
    await page.waitForFunction(()=>window.entranceCheck,null,{timeout:180000});
    await page.locator('#viewerLoading').waitFor({state:'detached',timeout:30000});
    const measurements=await page.evaluate(async variant=>{
      const {buildEntranceLuneta,entranceLunetaPavingDatum}=await import('./entrance-luneta-model.js');
      const {THREE,scene,walkingHeight,camera,controls,renderer,siteTerrain,localHouseData,houseTerrainY,GardenRouteModel,ground}=entranceCheck;
      const datum=entranceLunetaPavingDatum(localHouseData,GARDEN,(x,z)=>SiteTerrain.drivewayFinish(siteTerrain.spec,x,z),{variant});
      const model=buildEntranceLuneta(localHouseData,GARDEN,houseTerrainY,datum,{variant});
      const stairs=scene.getObjectByName(model.name),ray=new THREE.Raycaster();
      const posts=scene.getObjectByName('carport_posts');
      if(!posts)throw new Error('Carport supports missing');
      if(!stairs)throw new Error('Entrance model missing from scene');
      const driveway=scene.getObjectByName('driveway-paving');
      scene.updateMatrixWorld(true);
      let pavingMeshes=0;
      stairs.traverse(mesh=>{
        if(!mesh.isMesh||!/_paving(?:_cut_\d+)?$/.test(mesh.name))return;
        if(mesh.material!==driveway.material)throw new Error('Entrance paving must share the driveway material object');
        const {position,uv}=mesh.geometry.attributes;
        const point=new THREE.Vector3();
        for(let i=0;i<position.count;i++){
          point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
          if(Math.abs(point.x-uv.getX(i))>2e-6||Math.abs(point.z-uv.getY(i))>2e-6)throw new Error('Paving pattern must retain driveway world-coordinate alignment');
        }
        pavingMeshes++;
      });
      if(!pavingMeshes)throw new Error('Entrance driveway paving is missing');
      for(const part of model.parts.filter(p=>p.material==='paving')){
        ray.set(new THREE.Vector3(part.position[0],houseTerrainY+.1,part.position[1]),new THREE.Vector3(0,-1,0));
        const hit=ray.intersectObject(stairs,true)[0];
        if(!hit||hit.object.material!==driveway.material)throw new Error(`Paving part does not use driveway material: ${part.name}`);
      }
      const {carportPostLayout}=await import('./carport-posts-model.js');
      for(const post of carportPostLayout(GARDEN)){
        ray.set(new THREE.Vector3(post.x,20,post.z),new THREE.Vector3(0,-1,0));
        const hit=ray.intersectObject(posts,true)[0];
        if(!hit||hit.point.y<houseTerrainY+2)throw new Error(`Missing full-height carport post: ${post.id}`);
      }
      if(variant!=='straight'){
        const post=carportPostLayout(GARDEN).find(p=>p.id==='entrance');
        for(const dx of [-.085,0,.085])for(const dz of [-.085,0,.085]){
          if(dx===0&&dz===0)continue;
          ray.set(new THREE.Vector3(post.x+dx,houseTerrainY+.1,post.z+dz),new THREE.Vector3(0,-1,0));
          const hit=ray.intersectObject(stairs,true)[0];
          if(!hit||Math.abs(hit.point.y-(houseTerrainY-model.dimensions.rise))>2e-6)throw new Error('The whole timber post must emerge from the second tread from below');
        }
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
        count++;
      }
      for(const [i,offset] of [.35,.96,1.26].entries()){
        const x=model.dimensions.facadeX+offset,z=(model.dimensions.zNorth+model.dimensions.zSouth)/2;
        walkError=Math.max(walkError,Math.abs(walkingHeight(x,z)-(houseTerrainY-i*model.dimensions.rise)));
      }
      for(const surface of [model.proposedFill]){
        const x=(surface.x0+surface.x1)/2,z=(surface.z0+surface.z1)/2;
        const groundY=siteTerrain.height(x,z);
        if(Math.abs(groundY-surface.y)>1e-7)throw new Error('Shared grass terrain must meet the terrace-board datum');
        const walkY=GardenRouteModel.distance(GARDEN.gardenRoutes,x,z)<=0?siteTerrain.routeHeight(x,z):groundY;
        walkError=Math.max(walkError,Math.abs(walkingHeight(x,z)-walkY));
        ray.set(new THREE.Vector3(x,houseTerrainY+.1,z),new THREE.Vector3(0,-1,0));
        const groundHit=ray.intersectObject(ground,true)[0];
        if(!groundHit||Math.abs(groundHit.point.y-groundY)>.002)throw new Error('Rendered shared lawn must meet its grading datum');
        if(ray.intersectObject(stairs,true).length)throw new Error('The entrance model must not cap the shared grass terrain');
      }
      const toggle=document.getElementById('toggleVehicles');toggle.checked=false;toggle.dispatchEvent(new Event('change',{bubbles:true}));
      camera.position.set(24.2,4.4,24.5);controls.target.set(21.8,2.1,21);controls.update();renderer.render(scene,camera);
      return {variant,count,maxError,walkError,rise:model.dimensions.rise,datum};
    },variant);
    assert(measurements.count>=(variant==='straight'?6:8));assert(measurements.maxError<2e-6,JSON.stringify(measurements));assert(measurements.walkError<1e-7,JSON.stringify(measurements));
    await page.screenshot({path:`${output}/entrance-${variant}.png`});
    console.log(JSON.stringify(measurements));
  }
  assert.deepEqual(errors,[]);
  console.log(`Entrance variants rendered without browser errors: ${output}`);
}finally{await browser?.close();await server.close();}
