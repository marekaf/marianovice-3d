import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseExportArgs,createExportInputs} from './export-inputs.mjs';
import {createFloorReference} from './export-floor-reference.mjs';
const {sourceRoot,loftOnly,floorReferencePath}=parseExportArgs(process.argv.slice(2));
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),output=resolve(root,'unreal/generated');
const inputs=await createExportInputs({sourceRoot,toolRoot:root});
await inputs.provenance();
const floorReference=await createFloorReference(floorReferencePath);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const marker='ViewerLoading.finish();';
const artifact=loftOnly?'loft-walkthrough':'house-walkthrough';
const injection=`window.unrealSource={THREE,scene,renderer,localHouseData,loadWalkInterior,houseRoof,houseRoofSpec,gableFillMeshes,roofGroup,roofWindowRun,GABLE,HB,houseTerrainY,houseChimney,portalDrainGroup,outdoorLoungeModel,buildModel,buildWalkingDoor};`;
const server=createServer(async(req,res)=>{
  try{
    const requested=req.url.split(/[?#]/,1)[0];
    if(floorReference&&requested==='/docs/floor-texture.js'){
      res.writeHead(200,{'Content-Type':'text/javascript'});res.end(floorReference.module);return;
    }
    if(floorReference&&requested==='/__export/floor-reference.jpg'){
      res.writeHead(200,{'Content-Type':'image/jpeg'});res.end(floorReference.bytes);return;
    }
    const input=await inputs.resolveRequest(req.url),{pathname,file}=input;
    let body=await readFile(file);
    inputs.recordFile(input,body);
    if(pathname==='/index.html'){
      body=body.toString();assert.equal(body.split(marker).length,2);
      body=body.replace(marker,injection+marker);
    }
    if(['.html','.js','.mjs'].includes(extname(file)))body=body.toString().replaceAll('https://unpkg.com/three@0.160.0/','/node_modules/three/');
    res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png'}[extname(file)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{let seed=1986;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto(`http://127.0.0.1:${server.address().port}/${loftOnly?'interior':'index'}.html`);
  await page.waitForFunction(loftOnly?()=>window.DEBUG?.loft:()=>window.unrealSource,null,{timeout:120000});
  const downloadPromise=page.waitForEvent('download',{timeout:180000});
  const [manifest,download]=await Promise.all([page.evaluate(async({loftOnly})=>{
    const waitForFloor=async()=>{await (await import('/docs/floor-texture.js')).waitForFloorReference();};
    if(loftOnly){
      const THREE=await import('three');
      const [{GLTFExporter},{GLTFLoader},{prepareLoftExport}]=await Promise.all([
        import('three/addons/exporters/GLTFExporter.js'),import('three/addons/loaders/GLTFLoader.js'),import('./unreal/export-loft.mjs')]);
      await waitForFloor();
      const exported=prepareLoftExport(THREE,window.DEBUG.loft);
      const buffer=await new GLTFExporter().parseAsync(exported.scene,{binary:true,onlyVisible:true,maxTextureSize:2048});
      const loaded=await new GLTFLoader().parseAsync(buffer,'');
      const before=new THREE.Box3().setFromObject(exported.scene),after=new THREE.Box3().setFromObject(loaded.scene);
      if(before.min.distanceTo(after.min)>1e-4||before.max.distanceTo(after.max)>1e-4)throw new Error('Loft GLB roundtrip changed scene bounds');
      const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([buffer],{type:'model/gltf-binary'}));link.download='loft-walkthrough.glb';link.click();
      return {...exported.manifest,bytes:buffer.byteLength,bounds:{min:after.min.toArray(),max:after.max.toArray()},roots:['loft'],roundtrip:'passed',limitations:['Separate aligned loft supplement; retain the existing house import.','Roof, gable window and chimney are supplied by the existing house import.','Loft collision and camera routes require Unreal validation.']};
    }
    const s=window.unrealSource,{THREE}=s;
    const [{GLTFExporter},{GLTFLoader},{RoomEnvironment},{prepareExportScene,prepareIntegratedLoft},{clipApertures}]=await Promise.all([
      import('three/addons/exporters/GLTFExporter.js'),import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/environments/RoomEnvironment.js'),
      import('./unreal/export-scene.mjs'),import('./unreal/clip-apertures.mjs')]);
    const house=await s.loadWalkInterior();
    if(!house)throw new Error('Furnished interiors failed to load');
    await waitForFloor();
    house.root.visible=house.furniture.visible=house.ceiling.visible=true;
    for(const group of Object.values(house.walls))group.visible=true;
    const loftCoverage=prepareIntegratedLoft(house);
    const roots=[{name:'house',object:house.root},{name:'roof',object:s.houseRoof}];
    for(const {model}of s.localHouseData.exteriorOpenings()){
      const object=s.scene.children.find(o=>o.name===model.name);
      if(!object)throw new Error('Missing exterior opening '+model.name);
      roots.push({name:model.name,object});
    }
    const decks=s.scene.children.filter(o=>o.name==='east-cedar-deck');
    if(!decks.length)throw new Error('Missing east terrace');
    roots.push(...decks.map((object,i)=>({name:`east_deck_${i}`,object})),{name:'portal_drains',object:s.portalDrainGroup});
    const east=s.buildModel(THREE,{...s.outdoorLoungeModel,parts:s.outdoorLoungeModel.parts.filter(p=>/^(east_|outdoor_kitchen)/.test(p.name))});
    roots.push({name:'east_furniture',object:east},{name:'chimney',object:s.houseChimney.root});
    const roofWindows=window.RoofWindows.build({gable:s.GABLE,ridgeY:s.houseRoofSpec.ridgeY,eaveY:s.houseRoofSpec.ridgeY-s.roofWindowRun});
    const windowGroup=s.roofGroup.children.find(o=>o.name===roofWindows.name);
    if(!windowGroup)throw new Error('Missing roof windows');
    roots.push({name:'roof_windows',object:windowGroup});
    const gable=s.localHouseData.gableOpening(),origin=s.localHouseData.originPlot,o=gable.opening;
    const gableWindow=s.scene.children.find(object=>object.name===gable.name);
    if(!gableWindow)throw new Error('Missing gable window');
    roots.push({name:'gable_window',object:gableWindow});
    const overrides=new Map();
    s.houseRoof.updateWorldMatrix(true,true);
    s.houseRoof.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const boxes=roofWindows.cutouts.map(c=>{
        const flashing=mesh.geometry.type==='BoxGeometry';
        return{min:[c.x0-(flashing?.18*Math.abs(c.slopeAxis[0]):0),0,c.z0-(flashing?.12:0)],
          max:[c.x1+(flashing?.18*Math.abs(c.slopeAxis[0]):0),20,c.z1+(flashing?.12:0)]};
      });
      overrides.set(mesh,clipApertures(THREE,mesh.geometry,mesh.matrixWorld,boxes));
    });
    const hole={min:[origin.x+o.x-o.width/2,s.houseTerrainY+o.sill,s.HB[1]-.01],max:[origin.x+o.x+o.width/2,s.houseTerrainY+o.sill+o.height,s.HB[1]+.46]};
    s.gableFillMeshes.forEach((mesh,i)=>{
      mesh.updateWorldMatrix(true,false);overrides.set(mesh,clipApertures(THREE,mesh.geometry,mesh.matrixWorld,[hole]));
      roots.push({name:`gable_${i}`,object:mesh});
    });
    const exported=prepareExportScene(THREE,roots,[origin.x,s.houseTerrainY,origin.z],overrides);
    const buffer=await new GLTFExporter().parseAsync(exported.scene,{binary:true,onlyVisible:true,maxTextureSize:2048});
    const loaded=await new GLTFLoader().parseAsync(buffer,'');
    const before=new THREE.Box3().setFromObject(exported.scene),after=new THREE.Box3().setFromObject(loaded.scene);
    if(before.min.distanceTo(after.min)>1e-4||before.max.distanceTo(after.max)>1e-4)throw new Error('GLB roundtrip changed scene bounds');
    for(const cut of roofWindows.cutouts){
      const ray=new THREE.Raycaster(new THREE.Vector3((cut.x0+cut.x1)/2-origin.x,15,(cut.z0+cut.z1)/2-origin.z),new THREE.Vector3(0,-1,0));
      if(ray.intersectObject(loaded.scene.getObjectByName('roof'),true).length)throw new Error('Exported roof seals a roof window');
    }
    const preview=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});preview.setSize(1280,900);
    preview.toneMapping=THREE.ACESFilmicToneMapping;
    const room=new RoomEnvironment(),generator=new THREE.PMREMGenerator(preview),environment=generator.fromScene(room,.04);
    const previewScene=new THREE.Scene();previewScene.add(loaded.scene);
    previewScene.environment=environment.texture;previewScene.background=new THREE.Color('#dce2e5');
    previewScene.add(new THREE.AmbientLight('#ffffff',1));
    const camera=new THREE.PerspectiveCamera(65,1280/900,.05,100);
    camera.position.set(7.9,1.62,8.85);camera.lookAt(7.8,1.15,4.35);
    preview.render(previewScene,camera);
    const previewPng=preview.domElement.toDataURL('image/png').split(',')[1];
    environment.dispose();generator.dispose();room.dispose();preview.dispose();
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([buffer],{type:'model/gltf-binary'}));link.download='house-walkthrough.glb';link.click();
    return {...exported.manifest,ownership:{loft:'house',roofWindows:'house'},loftCoverage,previewPng,bytes:buffer.byteLength,bounds:{min:after.min.toArray(),max:after.max.toArray()},roots:roots.map(r=>r.name),roundtrip:'passed',
      limitations:['Unreal import, lighting, collision and door interaction await engine validation.','The full house envelope and adjacent rooms are retained for light occlusion; PoC review focuses on living/kitchen/east terrace.','Three.js environments and lights are excluded; glass, emissive lighting and materials require Unreal setup.']};
  },{loftOnly}),downloadPromise]);
  assert.deepEqual(errors,[]);
  if(loftOnly){
    assert.equal(manifest.meshes,manifest.sourceMeshes);
    for(const key of ['floor','ceiling','furniture','int'])assert(manifest.coverage[key]>0,`Loft ${key} geometry is missing`);
  }else{assert(manifest.meshes>100);assert(manifest.doors.some(d=>d.id==='opening_W9_1'));}
  await mkdir(output,{recursive:true});await download.saveAs(resolve(output,artifact+'.glb'));
  if(manifest.previewPng){await writeFile(resolve(output,'export-preview.png'),Buffer.from(manifest.previewPng,'base64'));delete manifest.previewPng;}
  await writeFile(resolve(output,loftOnly?'loft-manifest.json':'manifest.json'),JSON.stringify({...manifest,sources:await inputs.provenance(),floorFinish:floorReference?.metadata??{mode:'viewer-source'}},null,2)+'\n');
  console.log(JSON.stringify({output,meshes:manifest.meshes,megabytes:manifest.bytes/1024/1024,roundtrip:manifest.roundtrip,errors},null,2));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
