import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/index.html',async route=>{
    const response=await route.fetch();
    const html=(await response.text())
      .replace('ground.geometry=cutGroundUnderRoutes(THREE,groundGeom,gardenRoutes.geometry);','const clipStarted=performance.now();ground.geometry=cutGroundUnderRoutes(THREE,groundGeom,gardenRoutes.geometry);window.clipMs=performance.now()-clipStarted;')
      .replace('groundGeom.dispose();','window.connectionMs=performance.now()-clipStarted-window.clipMs;groundGeom.dispose();')
      .replace('ViewerLoading.finish();','window.routeReview={THREE,ground,groundGeom,gardenRoutes,gardenRouteEdges,terrainPreview,hiddenBenchModel,scene,renderer,camera,controls}; ViewerLoading.finish();');
    await route.fulfill({response,body:html});
  });
  await page.goto(process.env.GARDEN_URL||'http://127.0.0.1:8765/index.html');
  await page.waitForFunction(()=>window.routeReview,null,{timeout:60000});
  const result=await page.evaluate(()=>{
    const {THREE,ground,groundGeom,gardenRoutes,gardenRouteEdges,terrainPreview,hiddenBenchModel}=routeReview;
    function sampler(geometry){
      const attribute=geometry.attributes.position,bins=new Map(),triangles=[];
      let area=0;
      for(let i=0;i<(geometry.index?.count??attribute.count);i+=3){
        const triangle=[0,1,2].map(j=>{const k=geometry.index?geometry.index.getX(i+j):i+j;return [attribute.getX(k),attribute.getY(k),attribute.getZ(k)];});
        const [a,b,c]=triangle;area+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;
        triangles.push(triangle);
        const xs=triangle.map(p=>p[0]),zs=triangle.map(p=>p[2]);
        for(let x=Math.floor(Math.min(...xs));x<=Math.floor(Math.max(...xs));x++)for(let z=Math.floor(Math.min(...zs));z<=Math.floor(Math.max(...zs));z++){
          const key=`${x},${z}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(triangle);
        }
      }
      return {triangles,area,height(x,z){
        for(const [a,b,c] of bins.get(`${Math.floor(x)},${Math.floor(z)}`)||[]){
          const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-15)continue;
          const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
          if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)return u*a[1]+v*b[1]+(1-u-v)*c[1];
        }
      }};
    }
    const original=sampler(groundGeom),cut=sampler(ground.geometry),routes=sampler(gardenRoutes.geometry);
    let samples=0,oldPenetrations=0,newPenetrations=0,maxOldPenetration=0;
    for(const triangle of routes.triangles)for(const weights of [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]]){
      const [x,y,z]=[0,1,2].map(axis=>triangle.reduce((sum,p,i)=>sum+weights[i]*p[axis],0));
      samples++;
      const before=original.height(x,z)-y,after=cut.height(x,z)-y;
      if(before>.001)oldPenetrations++;
      if(after>.001)newPenetrations++;
      maxOldPenetration=Math.max(maxOldPenetration,before);
    }
    const contacts=hiddenBenchModel.feet.flatMap(foot=>foot.bottomCorners).map(([x,z])=>({before:original.height(x,z),after:cut.height(x,z)}));
    let seamSamples=0,seamMisses=0;const misses=[];
    gardenRouteEdges.updateMatrixWorld(true);
    for(const triangle of routes.triangles)for(let edge=0;edge<3;edge++)for(const t of [.2,.5,.8]){
      const a=triangle[edge],b=triangle[(edge+1)%3],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);if(length<1e-5)continue;
      const x=a[0]+dx*t,z=a[2]+dz*t,y=a[1]+(b[1]-a[1])*t,nx=-dz/length,nz=dx/length;
      if((routes.height(x+nx*.00005,z+nz*.00005)!==undefined)===(routes.height(x-nx*.00005,z-nz*.00005)!==undefined))continue;
      const bottom=original.height(x,z);if(bottom===undefined||Math.abs(y-bottom)<.0001)continue;
      seamSamples++;
      const ray=new THREE.Raycaster(new THREE.Vector3(x+nx*.01,(bottom+y)/2,z+nz*.01),new THREE.Vector3(-nx,0,-nz),0,.02);
      if(!ray.intersectObject(gardenRouteEdges).length){seamMisses++;if(misses.length<5)misses.push({x,z,gap:y-bottom});}
    }
    const edgePositions=gardenRouteEdges.geometry.attributes.position;let largestConnection;
    for(let i=0;i<edgePositions.count;i+=6)for(const [bottom,top] of [[i,i+5],[i+1,i+2]]){
      const gap=Math.abs(edgePositions.getY(top)-edgePositions.getY(bottom));
      if(!largestConnection||gap>largestConnection.gap)largestConnection={x:edgePositions.getX(bottom),z:edgePositions.getZ(bottom),bottom:edgePositions.getY(bottom),top:edgePositions.getY(top),gap};
    }
    let outsideSamples=0,maxOutsideError=0;
    for(let i=0;i<original.triangles.length;i+=13){
      const triangle=original.triangles[i],x=triangle.reduce((s,p)=>s+p[0],0)/3,z=triangle.reduce((s,p)=>s+p[2],0)/3;
      if(routes.height(x,z)!==undefined)continue;
      outsideSamples++;const after=cut.height(x,z);
      maxOutsideError=Math.max(maxOutsideError,after===undefined?Infinity:Math.abs(after-original.height(x,z)));
    }
    const bytes=geometry=>Object.values(geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+(geometry.index?.array.byteLength||0);
    return {samples,oldPenetrations,newPenetrations,maxOldPenetration,outsideSamples,maxOutsideError,contacts,seamSamples,seamMisses,misses,largestConnection,
      areaError:Math.abs(original.area-cut.area-routes.area),beforeBytes:bytes(groundGeom),afterBytes:bytes(ground.geometry),edgeBytes:bytes(gardenRouteEdges.geometry),edgeStats:gardenRouteEdges.geometry.userData,clipMs:window.clipMs,connectionMs:window.connectionMs,
      previewTriangles:terrainPreview.comparison.geometry.index.count/3,originalTriangles:groundGeom.index.count/3};
  });
  console.log(JSON.stringify(result));
  assert(result.samples>40000);
  assert(result.oldPenetrations>0,'Rendered original terrain must reproduce the grass penetration');
  assert.equal(result.newPenetrations,0);
  assert(result.seamSamples>1000);
  assert.equal(result.seamMisses,0,'Rendered connector faces close the path/ground boundary at multiple edge samples');
  assert(result.outsideSamples>1000);
  assert(result.maxOutsideError<1e-5,'Ground outside actual path footprints keeps its height and coverage');
  assert(result.areaError<.001,'Clipping removes only the actual route area, without cracks or extra holes');
  assert(result.afterBytes<result.beforeBytes*1.2,'Local clipping must not densify the entire terrain');
  assert.equal(result.previewTriangles,result.originalTriangles,'Existing and cut/fill comparison remain complete');
  for(const contact of result.contacts)assert(Math.abs(contact.before-contact.after)<1e-6,'Bench supports keep their ground contact');
  await page.waitForFunction(()=>!document.getElementById('viewerLoading'));
  if(process.env.GROUND_SCREENSHOT){
    await page.evaluate(()=>{
      const {scene,renderer,camera,controls,ground,gardenRoutes,gardenRouteEdges}=routeReview;
      for(const object of scene.children)object.visible=object.isLight||object===ground||object===gardenRoutes||object===gardenRouteEdges;
      camera.position.set(30.896,4.4603,17.302);controls.target.set(30.896,1.4603,17.292);controls.update();renderer.render(scene,camera);
    });
    await page.screenshot({path:process.env.GROUND_SCREENSHOT});
  }
  if(process.env.GROUND_EYE_SCREENSHOT){
    await page.evaluate(()=>{
      const {scene,renderer,camera,controls}=routeReview;
      camera.position.set(28.7,3.16,17.8);controls.target.set(31.2,1.4,17.2);controls.update();renderer.render(scene,camera);
    });
    await page.screenshot({path:process.env.GROUND_EYE_SCREENSHOT});
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
