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
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();','window.entranceCheck={THREE,scene,camera,renderer,controls,walkingHeight,siteTerrain};ViewerLoading.finish();');
  if(['.html','.js','.mjs'].includes(extname(path)))data=data.toString().replaceAll('https://unpkg.com/three@0.186.0/','/node_modules/three/');
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'}[extname(path)]||'application/octet-stream'}).end(data);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>window.entranceCheck,null,{timeout:180000});
  await page.locator('#viewerLoading').waitFor({state:'detached',timeout:30000});
  const center=await page.evaluate(()=>{
    const {THREE,scene}=entranceCheck;scene.updateMatrixWorld(true);const meshes=[];scene.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
    const hit=new THREE.Raycaster(new THREE.Vector3(20.92,2.7,21.84),new THREE.Vector3(0,-1,0)).intersectObjects(meshes,false)[0];
    return {height:hit?.point.y,name:hit?.object.name};
  });
  assert(Math.abs(center.height-2.465)<2e-6,`Large landing must be at door level: ${JSON.stringify(center)}`);
  const measurements=await page.evaluate(()=>{
    const {THREE,scene,walkingHeight,camera,controls,renderer,siteTerrain}=entranceCheck;
    const stairs=scene.getObjectByName('house_entrance_stairs'),ray=new THREE.Raycaster(),datum=1.9504609929078012,levels=[0,1,2].map(i=>2.465-(2.465-datum)*i/3),edges=[20.58,21.26,21.60,21.94];
    let count=0,maxError=0,walkError=0;
    for(let i=0;i<3;i++)for(let x=edges[i]+.01;x<edges[i+1]-.005;x+=.04)for(let z=19.41;z<22.595;z+=.04){
      ray.set(new THREE.Vector3(x,2.7,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(stairs,true)[0];
      if(!hit)throw new Error(`Missing stair surface at${x},${z}`);
      maxError=Math.max(maxError,Math.abs(hit.point.y-levels[i]));
      if(x>edges[i]+.181)walkError=Math.max(walkError,Math.abs(walkingHeight(x,z)-levels[i]));count++;
    }
    let supportSamples=0,maxGap=-Infinity,maxEmbed=0;
    stairs.traverse(mesh=>{if(!mesh.isMesh)return;const bounds=new THREE.Box3().setFromObject(mesh);
      for(let x=Math.max(bounds.min.x,21.28);x<=bounds.max.x+1e-8;x+=.02)for(let z=Math.max(bounds.min.z,19.4);z<=Math.min(bounds.max.z,22.6)+1e-8;z+=.02){
        const paving=SiteTerrain.drivewayFinish(siteTerrain.spec,x,z),gap=bounds.min.y-paving;maxGap=Math.max(maxGap,gap);maxEmbed=Math.max(maxEmbed,-gap);supportSamples++;
      }
    });
    camera.position.set(23.9,4.5,24.4);controls.target.set(20.85,2.35,21.45);controls.update();renderer.render(scene,camera);
    return {count,maxError,walkError,supportSamples,maxGap,maxEmbed,paving:walkingHeight(22.15,21.84)};
  });
  assert(measurements.maxError<2e-6);assert(measurements.walkError<1e-8);assert(Math.abs(measurements.paving-1.9515390070921985)<1e-8);assert(measurements.supportSamples>5000&&measurements.maxGap<2e-6&&measurements.maxEmbed<.00455,`Rendered stair bases meet the sloping pavement over their entire contact: ${JSON.stringify(measurements)}`);assert.deepEqual(errors,[]);
  const output=process.env.ENTRANCE_OUTPUT||'/tmp/entrance-stairs';await mkdir(output,{recursive:true});
  await page.evaluate(()=>{const toggle=document.getElementById("toggleVehicles");toggle.checked=false;toggle.dispatchEvent(new Event("change",{bubbles:true}));});
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await page.screenshot({path:output+'/entrance-stairs.png'});
  console.log(JSON.stringify({center,...measurements,errors,output}));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
