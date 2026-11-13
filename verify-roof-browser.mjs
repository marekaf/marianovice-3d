// browser-ci {"shard":"roof"}
import assert from 'node:assert/strict';
import {prepareReviewFloor,captureReview} from './scripts/review-floor.mjs';
import {launchChrome,serveRepo} from './scripts/browser.mjs';
import {resolve} from 'node:path';
const server=await serveRepo({rewrite(path,data){
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();',
    'window.roofReview={scene,camera,controls,renderer,houseRoofSpec,houseMesh,houseInteriorBacking,houseTerrainY,loadWalkInterior,get house(){return walkHouse;},requestRender};ViewerLoading.finish();');
  return data;
}});
let browser;
try{
  browser=await launchChrome();
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  await prepareReviewFloor(page);
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${server.origin}/index.html`);
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
    ['garage-south',[36,7.5,31],[30.8,5,23]],
    ['garage-north',[36,7.5,15],[30.8,5,22]],
  ]){
    await page.evaluate(({position,target})=>{
      const r=roofReview;r.controls.enableDamping=false;r.controls.maxPolarAngle=Math.PI;
      r.controls.minDistance=.1;r.camera.position.set(...position);
      r.controls.target.set(...target);r.controls.update();r.requestRender();
    },{position,target});
    await page.waitForTimeout(250);
    if(process.env.ROOF_SCREENSHOT_DIR)await captureReview(page,{path:resolve(process.env.ROOF_SCREENSHOT_DIR,`roof-${name}.png`)});
  }
  await page.evaluate(()=>roofReview.loadWalkInterior());
  const furnished=await verifyCaps();
  assert(furnished.cappedMeshes>initial.cappedMeshes,'Furnished walking walls must meet the same roof profile');
  assert(furnished.excess<1e-5,JSON.stringify(furnished));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({initial,furnished,errors},null,2));
}finally{await browser?.close();await server.close();}
