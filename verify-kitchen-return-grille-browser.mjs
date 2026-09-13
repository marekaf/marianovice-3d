import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.GRILLE_OUTPUT||'/tmp/kitchen-return-grille';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:8781')+'/interior.html#house-kitchen');
  await page.waitForFunction(()=>window.DEBUG?.hou?.furniture,{timeout:180000});
  await page.screenshot({path:output+'/kitchen.png'});
  const actual=await page.evaluate(async()=>{
    const THREE=await import('three');
    const louverHits=[];
    DEBUG.scene.updateMatrixWorld(true);
    const meshes=[];DEBUG.hou.root.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
    const upper=HOUSE_INTERIOR.furniture.find(f=>f.label==='kuchyň uppers 1050');
    const world=v=>DEBUG.hou.root.localToWorld(new THREE.Vector3(...v));
    const ray=new THREE.Raycaster(),hits=[];
    for(let i=0;i<4;i++){
      const p=world([upper.x1+.05,upper.y0+upper.h-.18+.025+i*.019,(upper.z0+upper.z1)/2]);
      ray.set(p,new THREE.Vector3(-1,0,0));
      const hit=ray.intersectObjects(meshes,false).find(h=>h.object.visible);
      hits.push({distance:hit?.distance,name:hit?.object.name});
    }
    for(let i=0;i<5;i++){ray.set(world([upper.x1+.05,upper.y0+upper.h-.18+.015+i*.019,(upper.z0+upper.z1)/2]),new THREE.Vector3(-1,0,0));const hit=ray.intersectObjects(meshes,false).find(h=>h.object.visible);louverHits.push(hit?.distance);}
    const panelHits=[];for(const height of [upper.y0+upper.h-.20,upper.y0+upper.h-.06]){ray.set(world([upper.x1+.05,height,(upper.z0+upper.z1)/2]),new THREE.Vector3(-1,0,0));panelHits.push(ray.intersectObjects(meshes,false)[0]?.distance);}
    const canvas=document.createElement('canvas');canvas.id='grilleCloseup';canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:10000';document.body.append(canvas);
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setSize(1440,1000);renderer.toneMapping=THREE.ACESFilmicToneMapping;
    const camera=new THREE.PerspectiveCamera(48,1.44,.005,100);camera.position.copy(world([9.60,2.32,4.86]));camera.lookAt(world([9.455,2.36,4.40]));
    renderer.render(DEBUG.scene,camera);
    return {louverHits,hits,panelHits};
  });
  assert(actual.panelHits.every(d=>Math.abs(d-.05)<1e-5),'Surrounding end panel remains present');assert.equal(actual.louverHits.length,5);assert(actual.louverHits.every(d=>d>.049&&d<.07),'All five louver surfaces are physically present');assert(actual.hits.every(h=>h.distance>.10),'Actual end opening passes liner and carcass');
  await page.screenshot({path:output+'/end-closeup.png'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({...actual,errors,output}));
}finally{await browser.close();}
