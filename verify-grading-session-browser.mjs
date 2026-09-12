import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {GARDEN}=createRequire(import.meta.url)('./layout.js');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
  page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message);});
  await page.route('**/index.html',async route=>route.fulfill({contentType:'text/html',body:(await readFile(new URL('./index.html',import.meta.url),'utf8')).replace('ViewerLoading.finish();','window.gradingSession={THREE,scene,ground,gardenRoutes,firepitGroup,firepitModel,siteTerrain,gradingOverlay,renderer,camera,controls,pergolaModel,greenhouseModel,houseRoof,houseRoofSpec,boundaryFence,existingGround,gar,requestRender};ViewerLoading.finish();')}));
  await page.goto(process.env.MODEL_URL||'http://127.0.0.1:8765/index.html');
  await page.locator('#viewerLoading').waitFor({state:'hidden',timeout:120000});
  assert.deepEqual(errors,[]);
  await page.waitForFunction(()=>window.gradingSession?.renderer.info.render.calls>0);
  const restored=await page.evaluate(()=>{
    const t=gradingSession,d=t.houseRoofSpec,bounds=new t.THREE.Box3();
    t.scene.updateMatrixWorld(true);
    t.houseRoof.traverse(mesh=>{if(mesh.userData.roofSurface)bounds.expandByObject(mesh);});
    const dimensions=t.gradingOverlay.data.dimensions.filter(d=>['pergolaFenceGap','housePergolaGap'].includes(d.id)).map(d=>({id:d.id,distance:Math.hypot(d.to[0]-d.from[0],d.to[1]-d.from[1])}));
    const garageColors=[];for(const wall of Object.values(t.gar.walls))wall.traverse(mesh=>{if(mesh.isMesh&&mesh.material.name==='render')garageColors.push(mesh.material.color.getHexString());});
    const fencePosts=t.boundaryFence.models.flatMap(model=>model.parts.filter(part=>part.type==='cylinder'));
    return {roofBounds:[bounds.min.x,bounds.max.x,bounds.min.z,bounds.max.z],depths:[d.mainWest.normalThickness,d.mainEast.normalThickness,d.westWing.normalThickness],dimensions,measuredFenceCount:t.boundaryFence.segments.filter(s=>s.measured).length,renderedFenceCount:t.boundaryFence.models.filter(m=>t.scene.getObjectByName(m.name)).length,fenceModels:t.boundaryFence.models.length,fencePostError:Math.max(...fencePosts.map(p=>Math.abs(p.position[2]+p.height/2-t.existingGround(...p.position.slice(0,2))-2))),garageColors,garageFacade:GarageModel.facadeFinish.color};
  });
  restored.roofBounds.forEach((v,i)=>assert(Math.abs(v-[9.33,21.63,7.005,26.605][i])<1e-5,'Approved roof overhangs rendered'));
  assert.deepEqual(restored.depths,[.25,.25,.227]);
  assert.equal(restored.dimensions.length,2);
  restored.dimensions.forEach(d=>assert(Math.abs(d.distance-2)<1e-7,`${d.id} stays exactly 2 m`));
  assert.equal(restored.measuredFenceCount,14);assert.equal(restored.renderedFenceCount,restored.fenceModels);assert(restored.fencePostError<1e-8);
  assert.equal(restored.garageFacade,'#e2cec5','Approved HN3E facade retained');
  const pergolaGround=await page.evaluate(()=>{
    const t=gradingSession,p=t.pergolaModel.groundPatch,vertices=t.ground.geometry.attributes.position;
    let count=0,error=0;
    for(let i=0;i<vertices.count;i++)if(vertices.getX(i)>p.x+.1&&vertices.getX(i)<p.x+p.w-.1&&vertices.getZ(i)>p.y+.1&&vertices.getZ(i)<p.y+p.d-.1){count++;error=Math.max(error,Math.abs(vertices.getY(i)-p.level));}
    return {count,error};
  });
  assert(pergolaGround.count>100&&pergolaGround.error<1e-5,`Rendered soil is level beneath the pergola: ${JSON.stringify(pergolaGround)}`);
  const drainageGround=await page.evaluate(()=>{
    const t=gradingSession,ray=new t.THREE.Raycaster();let samples=0,missing=0,maximumError=0;
    for(const strip of t.siteTerrain.spec.drainageStrips??[])for(let x=strip.x0+.0001;x<strip.x1;x+=.1)for(let z=strip.z0+.0001;z<strip.z1;z+=.1){
      ray.set(new t.THREE.Vector3(x,strip.level+1,z),new t.THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(t.ground,false)[0];samples++;
      if(!hit)missing++;else maximumError=Math.max(maximumError,Math.abs(hit.point.y-strip.level));
    }
    return {samples,missing,maximumError};
  });
  assert(drainageGround.samples>1000&&!drainageGround.missing&&drainageGround.maximumError<2e-5,`Actual drainage mesh stays below the terrace: ${JSON.stringify(drainageGround)}`);
  assert(restored.garageColors.length&&restored.garageColors.every(color=>color==='e2cec5'),'Actual garage facade meshes use HN3E');
  const firepitSurface=await page.evaluate(()=>{
    const t=gradingSession,part=GARDEN.elements.find(e=>e.id==='firePit').parts.find(p=>p.kind==='circle');
    t.scene.updateMatrixWorld(true);
    const apron=t.firepitGroup.getObjectByName('Firepit_structure_gravel');
    const bounds=new t.THREE.Box3().setFromObject(apron),ray=new t.THREE.Raycaster();
    let samples=0,groundSamples=0,routeSamples=0,apronError=0,supportError=0,missing=0;
    const failures=[];
    for(let ring=0;ring<=10;ring++)for(let i=0;i<(ring?64:1);i++){
      const radius=part.r*.9999*ring/10,angle=i*Math.PI*2/64,x=part.cx+Math.cos(angle)*radius,z=part.cy+Math.sin(angle)*radius;
      ray.set(new t.THREE.Vector3(x,10,z),new t.THREE.Vector3(0,-1,0));
      const top=ray.intersectObject(apron,false)[0],ground=ray.intersectObject(t.ground,false)[0],route=ray.intersectObject(t.gardenRoutes,false)[0];
      samples++;
      if(!top||(!ground&&!route)){missing++;continue;}
      apronError=Math.max(apronError,Math.abs(top.point.y-1.965));
      const surface=ground??route,expected=ground?1.865:1.965;
      const error=Math.abs(surface.point.y-expected);
      supportError=Math.max(supportError,error);
      if(error>1e-4&&failures.length<5)failures.push({x,z,kind:ground?'ground':'route',height:surface.point.y,expected});
      if(ground)groundSamples++;else routeSamples++;
    }
    return {bounds:[bounds.min.x,bounds.max.x,bounds.min.z,bounds.max.z,bounds.max.y],circle:part,samples,groundSamples,routeSamples,apronError,supportError,missing,failures};
  });
  const fireCircle=GARDEN.elements.find(e=>e.id==='firePit').parts.find(p=>p.kind==='circle');
  const fireBounds=[fireCircle.cx-fireCircle.r,fireCircle.cx+fireCircle.r,fireCircle.cy-fireCircle.r,fireCircle.cy+fireCircle.r,1.965];
  assert(firepitSurface.bounds.every((value,i)=>Math.abs(value-fireBounds[i])<1e-4),'Actual firepit apron retains its 4 m diameter and zone C finish');
  assert(firepitSurface.samples>600&&firepitSurface.groundSamples===firepitSurface.samples&&firepitSurface.routeSamples===0,`The apron excludes paths and retains soil beneath every sample: ${JSON.stringify(firepitSurface)}`);
  assert(firepitSurface.missing===0&&firepitSurface.apronError<1e-4&&firepitSurface.supportError<1e-4,`Actual firepit disk is level and supported: ${JSON.stringify(firepitSurface)}`);
  const surfaces=await page.evaluate(()=>{
    const t=gradingSession,north=t.scene.getObjectByName('north-facade-gravel').geometry.attributes.position;
    const west=[],east=[];
    for(let i=0;i<north.count;i++){if(Math.abs(north.getX(i)-10.48)<1e-4)west.push(north.getY(i));if(Math.abs(north.getX(i)-21.28)<1e-4)east.push(north.getY(i));}
    const pad=t.scene.getObjectByName('heat-pump-pad'),bottom=pad.position.y-pad.geometry.parameters.height/2;
    let padGap=0;
    for(const dx of [-pad.geometry.parameters.width/2,0,pad.geometry.parameters.width/2])for(const dz of [-pad.geometry.parameters.depth/2,0,pad.geometry.parameters.depth/2])padGap=Math.max(padGap,bottom-t.siteTerrain.height(pad.position.x+dx,pad.position.z+dz));
    const lid=t.scene.getObjectByName('waterSource-lid');
    const tankLid=t.scene.getObjectByName('rainTank-lid');
    const paving=t.scene.getObjectByName('driveway-paving').geometry.attributes.position,flatPaving=[];
    for(let i=0;i<paving.count;i++)if(paving.getX(i)>21.5&&paving.getX(i)<34&&paving.getZ(i)>26.7&&paving.getZ(i)<30.2)flatPaving.push(paving.getY(i));
    const compost=t.scene.getObjectByName('composter'),posts=compost.children.slice(0,4);
    const removedScreens=[];t.scene.traverse(object=>{if(object.name.startsWith("garden_screen_32.4_5.63_")||object.name.startsWith("garden_screen_15.7_28.05_"))removedScreens.push(object.name);});
    return {removedScreens,northWest:west,northEast:east,padGap,flatPaving,bedFinish:t.scene.getObjectByName('Raised beds').position.y,lidOffset:lid.position.y-t.siteTerrain.height(lid.position.x,lid.position.z),waterLocation:[lid.position.x,lid.position.z],tankLocation:[tankLid.position.x,tankLid.position.z],compostCorners:posts.map(p=>[p.position.x,p.position.z])};
  });
  assert.deepEqual(surfaces.removedScreens,[],"Firepit and guest bathroom screens are absent from the rendered scene");
  assert(surfaces.northWest.length&&surfaces.northEast.length);
  assert(surfaces.northWest.every(h=>Math.abs(h-2.465)<1e-4),'North gravel starts at west terrace finish');
  assert(surfaces.northEast.every(h=>Math.abs(h-1.965)<1e-4),'North gravel falls 50 cm toward the east');
  const southGrade=await page.evaluate(()=>{
    const t=gradingSession,south=t.scene.getObjectByName('south-facade-gravel'),ray=new t.THREE.Raycaster();
    let samples=0,missing=0,error=0;
    for(let z=26.44;z<=27.44;z+=.04)for(let x=10.49;x<=16.2;x+=.1) {
      ray.set(new t.THREE.Vector3(x,5,z),new t.THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(south,false)[0];samples++;
      if(!hit){missing++;continue;}
      error=Math.max(error,Math.abs(hit.point.y-(2.465-.5*(x-10.48)/10.8)));
    }
    const ends=[10.4801,21.2799].map(x=>{
      ray.set(new t.THREE.Vector3(x,5,26.4301),new t.THREE.Vector3(0,-1,0));
      return ray.intersectObject(south,false)[0]?.point.y;
    });
    return {samples,missing,error,ends};
  });
  assert(southGrade.samples>1400&&southGrade.missing===0&&southGrade.error<1e-5,`Actual south gravel maintains the full-width west-to-east fall outside the service spur: ${JSON.stringify(southGrade)}`);
  assert(southGrade.ends.every((height,i)=>Math.abs(height-[2.465,1.965][i])<2e-5),'Actual south gravel joins the west terrace and east driveway with a 50 cm finished fall');
  assert(surfaces.padGap<1e-5,'Heat pump bearing pad reaches the graded soil');
  assert(surfaces.flatPaving.length&&surfaces.flatPaving.every(y=>Math.abs(y-1.965)<1e-5),'Rendered A paving has the common finished level');
  assert(Math.abs(surfaces.bedFinish-2.865)<1e-6,'Ground under the raised beds is 40 cm above the west terrace');
  assert(Math.abs(surfaces.lidOffset-.01)<1e-6,'Water lid follows the filled terrain');
  assert.deepEqual(surfaces.waterLocation,[41.25,23.45]);
  assert.deepEqual(surfaces.tankLocation,[37.13,17.8],'Rainwater tank lid is separate from the water-supply lid');
  const compost=GARDEN.elements.find(e=>e.id==='compost').parts.find(p=>p.kind==='rect');
  assert.deepEqual([compost.x,compost.y,compost.w,compost.d],[-1.25,.7,1,2]);
  const toolStore=GARDEN.elements.find(e=>e.id==="toolStore").parts.find(p=>p.kind==="rect");
  assert.equal(toolStore.x-compost.x-compost.w,.5,"Composter stands beside the plastic box");
  assert.deepEqual(surfaces.compostCorners,[[compost.x,compost.y],[compost.x+compost.w,compost.y],[compost.x,compost.y+compost.d],[compost.x+compost.w,compost.y+compost.d]],'Composter keeps its rotated footprint at the layout position');
  await page.click('[data-panel="more"]');
  await page.locator('#panel-more > details > summary').click();
  await page.locator('#terrainPreview summary').click();
  await page.check('#gradingAreas');
  assert.equal(await page.evaluate(()=>gradingSession.gradingOverlay.group.visible),true);
  const terrainMarks=await page.evaluate(()=>{
    const names=[];gradingSession.gradingOverlay.group.traverse(object=>names.push(object.name));
    return Object.fromEntries(['bank','downhill','flat','preserve'].map(kind=>[kind,names.filter(name=>name.startsWith('grading-'+kind+'-')).length]));
  });
  assert(terrainMarks.bank>=2&&terrainMarks.downhill>=9&&terrainMarks.flat>=5&&terrainMarks.preserve>=14,`Terrain instructions are present in the actual 3D overlay: ${JSON.stringify(terrainMarks)}`);
  assert.deepEqual(await page.evaluate(()=>gradingSession.gradingOverlay.data.zones.map(z=>z.id)),[...'ABCDEFGHIJKLM']);
  await page.check('#gradingDimensions');
  await page.selectOption('#terrainMode','existing');
  assert.equal(await page.evaluate(()=>gradingSession.gradingOverlay.group.visible),false);
  await page.selectOption('#terrainMode','proposed');
  await page.click('[data-panel="views"]');
  await page.click('[data-view="top"]');
  await page.screenshot({path:'/tmp/grading-session/3d-areas.png'});
  await page.click('[data-panel="more"]');
  await page.uncheck('#gradingAreas');
  await page.click('[data-panel="views"]');
  await page.click('[data-view="bedroomView"]');
  const pergolaBounds=await page.evaluate(()=>{const t=gradingSession,b=new t.THREE.Box3().setFromObject(t.scene.getObjectByName(t.pergolaModel.name));return {minX:b.min.x,maxX:b.max.x,maxZ:b.max.z};});
  assert(pergolaBounds.minX>=21.28-1e-6&&pergolaBounds.maxX<=34.13&&pergolaBounds.maxZ<7.18,'Pergola remains in C north of the house');
  await page.screenshot({path:'/tmp/grading-session/bedroom-view.png'});
  await page.click('[data-panel="layers"]');await page.uncheck('#toggleTrees');await page.keyboard.press('Escape');
  for(const [name,position,target] of [
    ['terrain-east',[38,13,36],[21,1.9,14]],
    ['terrain-west',[0,10,24],[8,2.2,12]],
    ['north-bank',[38,10,-4],[27,1.9,9]],
    ['tank-fill',[46,9,30],[39,1,24]],
  ]){
    await page.evaluate(({position,target})=>{const t=gradingSession;t.camera.position.set(...position);t.controls.target.set(...target);t.controls.update();t.renderer.render(t.scene,t.camera);},{position,target});
    await page.screenshot({path:`/tmp/grading-session/${name}.png`});
  }
  assert.deepEqual(errors,[]);
  console.log('3D grading: work areas, dimensions, existing-ground separation and bedroom preset pass; screenshots captured');
} finally {await browser.close();}
