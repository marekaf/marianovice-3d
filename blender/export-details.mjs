import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {resolve,dirname,extname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createExportInputs} from '../unreal/export-inputs.mjs';

const {values}=parseArgs({options:{'source-root':{type:'string'},output:{type:'string'}},allowPositionals:false});
if(!values['source-root']||!values.output)throw new Error('Use --source-root <viewer> --output <ignored directory>');
const toolRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=resolve(values.output);
execFileSync('git',['check-ignore','--quiet',resolve(output,'garden-details.json')],{cwd:toolRoot});
const inputs=await createExportInputs({sourceRoot:values['source-root'],toolRoot});
await mkdir(output,{recursive:true});
const assetsDir=await mkdtemp(resolve(output,'assets-'));
const marker='ViewerLoading.finish();';
const injection='window.gardenDetailSource={THREE,scene,GARDEN,siteTerrain,treesGroup,pondModel,portalDrainGroup,perennialPlants,PerennialModel,seasonalPlanting,overlapsStructureAccess};';
const errors=[];
const server=createServer(async(req,res)=>{
  try{
    if(req.method==='POST'&&/^\/__export\/garden-details-\d{3}\.glb$/.test(req.url)){
      await pipeline(req,createWriteStream(resolve(assetsDir,basename(req.url))));res.writeHead(200).end();return;
    }
    const input=await inputs.resolveRequest(req.url),bytes=await readFile(input.file);inputs.recordFile(input,bytes);
    let body=bytes;
    if(input.pathname==='/index.html'){
      body=body.toString();assert.equal(body.split(marker).length,2);body=body.replace(marker,injection+marker);
    }
    if(['.html','.js','.mjs'].includes(extname(input.file)))body=body.toString().replaceAll('https://unpkg.com/three@0.160.0/','/node_modules/three/');
    res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.jpg':'image/jpeg','.png':'image/png'}[extname(input.file)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1280,height:900}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.text().startsWith('Garden details '))console.log(message.text());});
  await page.addInitScript(()=>{let seed=1986;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>window.gardenDetailSource,null,{timeout:120000});
  console.log('Viewer loaded; batching garden details');
  const manifest=await page.evaluate(async()=>{
    const s=window.gardenDetailSource,{THREE}=s;
    const [{GLTFExporter},{GLTFLoader},{prepareGardenDetails}]=await Promise.all([
      import('three/addons/exporters/GLTFExporter.js'),import('three/addons/loaders/GLTFLoader.js'),import('/unreal/garden-detail-scene.mjs')]);
    s.treesGroup.visible=true;s.seasonalPlanting.update(196);
    for(const plant of s.perennialPlants)s.PerennialModel.update(plant,7);
    const decks=s.scene.children.filter(object=>object.name==='east-cedar-deck');
    if(!decks.length)throw new Error('East cedar deck is missing');
    const roots=[{name:'planting',object:s.treesGroup},{name:'pond',object:s.pondModel.group},
      ...decks.map((object,i)=>({name:`deck_${i}`,object})),{name:'drain',object:s.portalDrainGroup}];
    for(const root of roots)if(!root.object?.visible)throw new Error('Missing or hidden detail root '+root.name);
    const boundsOf=object=>{const b=new THREE.Box3().setFromObject(object);return{min:b.min.toArray(),max:b.max.toArray()};};
    console.log('Garden details '+JSON.stringify({stage:'batch-start',time:Date.now()}));
    const exported=prepareGardenDetails(THREE,roots,[0,0,0]);
    console.log('Garden details '+JSON.stringify({stage:'batch-done',time:Date.now(),meshes:exported.manifest.meshes,vertices:exported.manifest.vertices}));
    for(const [name,coverage]of Object.entries(exported.manifest.coverage))if(!coverage.vertices)throw new Error('Empty detail category '+name);
    const categories={},bounds=boundsOf(exported.scene);
    for(const root of roots){
      const meshes=exported.scene.children.filter(mesh=>mesh.userData.detailCategory===root.name);
      const box=new THREE.Box3();meshes.forEach(mesh=>box.expandByObject(mesh));
      const sample=meshes[0],p=sample.geometry.attributes.position;
      categories[root.name]={meshes:meshes.map(mesh=>mesh.name),bounds:{min:box.min.toArray(),max:box.max.toArray()},
        probes:{mesh:sample.name,points:[0,Math.floor(p.count/2),p.count-1].map(i=>[p.getX(i),p.getY(i),p.getZ(i)])}};
    }
    const controlPoints=s.treesGroup.children.filter(root=>root.userData.treeForm).map(root=>({kind:'tree',position:root.position.toArray(),ground:s.siteTerrain.height(root.position.x,root.position.z)}));
    const treeAnchors=s.GARDEN.elements.filter(e=>['orchard','northTrees','eastTrees'].includes(e.id)).flatMap(e=>e.parts.filter(p=>p.kind==='circle')).filter(p=>!s.overlapsStructureAccess(p.cx,p.cy,.35));
    if(!treeAnchors.length||controlPoints.length!==treeAnchors.length||treeAnchors.some(a=>!controlPoints.some(p=>Math.hypot(p.position[0]-a.cx,p.position[2]-a.cy)<1e-6)))throw new Error('Garden tree anchor coverage changed');
    if(controlPoints.some(p=>Math.abs(p.position[1]-p.ground)>1e-6))throw new Error('Tree anchors differ from the shared terrain');
    const assets=[];
    while(exported.scene.children.length){
      const part=new THREE.Scene();let vertexCount=0;
      while(exported.scene.children.length&&(!vertexCount||vertexCount+exported.scene.children[0].geometry.attributes.position.count<=1400000)){
        const mesh=exported.scene.children[0];vertexCount+=mesh.geometry.attributes.position.count;part.add(mesh);
      }
      const file=`garden-details-${String(assets.length+1).padStart(3,'0')}.glb`;
      console.log('Garden details '+JSON.stringify({stage:'encode',file,time:Date.now(),vertices:vertexCount}));
      const buffer=await new GLTFExporter().parseAsync(part,{binary:true,onlyVisible:true,maxTextureSize:2048});
      console.log('Garden details '+JSON.stringify({stage:'roundtrip',file,time:Date.now(),bytes:buffer.byteLength}));
      const loaded=await new GLTFLoader().parseAsync(buffer,'');
      const before=new THREE.Box3().setFromObject(part),after=new THREE.Box3().setFromObject(loaded.scene);
      if(before.min.distanceTo(after.min)>1e-4||before.max.distanceTo(after.max)>1e-4)throw new Error('Garden GLB roundtrip changed bounds');
      const response=await fetch('/__export/'+file,{method:'POST',body:buffer});if(!response.ok)throw new Error('Garden asset upload failed');
      assets.push({file,bytes:buffer.byteLength,meshes:part.children.length});
      part.traverse(object=>object.geometry?.dispose());loaded.scene.traverse(object=>object.geometry?.dispose());
      console.log('Garden details '+JSON.stringify({stage:'asset-saved',file,time:Date.now()}));
    }
    return {...exported.manifest,categories,controlPoints,treeAnchors,layout:s.GARDEN,terrain:s.siteTerrain.spec,
      waterLevel:s.pondModel.waterLevel,season:'summer',planting:'established',bounds,roundtrip:'passed',assets,bytes:assets.reduce((sum,a)=>sum+a.bytes,0)};
  });
  assert.deepEqual(errors,[]);
  inputs.recordFile({owner:'tooling',pathname:'/blender/export-details.mjs'},await readFile(fileURLToPath(import.meta.url)));
  const assets=await Promise.all(manifest.assets.map(async asset=>({...asset,file:basename(assetsDir)+'/'+asset.file,sha256:createHash('sha256').update(await readFile(resolve(assetsDir,asset.file))).digest('hex')})));
  const result={...manifest,assets,formatVersion:1,sources:await inputs.provenance()};
  await writeFile(resolve(output,'garden-details.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({output,meshes:result.meshes,sourceInstances:result.sourceInstances,bytes:result.bytes,roundtrip:result.roundtrip}));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
