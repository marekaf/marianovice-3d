import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildShowerFittings} from './shower-fittings.js';
const {HOUSE_INTERIOR:data}=createRequire(import.meta.url)('../house-interior.js');
const before=JSON.stringify(data),model=buildShowerFittings(data);
const screen=data.furniture.find(f=>f.kind==='glass'&&f.room==='sprcha');
const backing=data.intWalls.find(w=>w.id==='W32');
const window=data.extWalls.find(w=>w.id==='W2').openings[0];
const revealLeft=window.at+window.w/2-window.reveal.width/2;
assert(Math.abs(screen.x0-4.70-1)<1e-9,'Guest shower clear width must be 1000 mm');
assert(Math.abs(screen.x1-screen.x0-.008)<1e-9,'Guest screen must be 8 mm thick');
assert.equal(backing.b[0],screen.x1,'Screen anchors to the backing wall edge');
assert(backing.b[0]<revealLeft,'Shower backing must clear the complete window reveal');
assert.equal(JSON.stringify(data),before);
assert.equal(model.showers.length,2);
assert.deepEqual(model.showers.map(s=>s.mixer),[[.60,.93,1.10],[5.20,18.65,1.10]]);
for(const shower of model.showers){
  assert(Math.abs(shower.hoseLength-1.75)<.001);
  assert(shower.hosePoints.every(p=>p[2]>.10));
  assert.equal(shower.handshowerDiameter,.13);
}
const mainScreen=data.furniture.find(f=>f.kind==='glass'&&f.room==='1.10');
const mainBacking=data.intWalls.find(w=>w.id==='W33');
assert(Math.abs(mainScreen.z0-.45-1)<1e-9,'Main shower depth is 1000 mm, independently of panel width');
assert(Math.abs(mainScreen.x1-mainScreen.x0-.98)<1e-9,'Main glass panel retains its 980 mm span');
assert.equal(mainScreen.z0,mainBacking.b[1],'Main screen meets the installation wall end');
assert.equal(model.drains.length,2);
for(const drain of model.drains){
  assert.equal(drain.length,1);
  assert.equal(drain.width,.055);
  assert(Math.abs(drain.sideClearance)<1e-9);
}
assert(!model.notes.some(n=>n.includes('not drawn')));
for(const part of model.parts){
  assert(model.materials[part.material],part.name);
  if(part.position)assert(part.position.every(Number.isFinite),part.name);
  if(part.vertices)assert(part.vertices.flat().every(Number.isFinite),part.name);
}
console.log('Showers: source mixer positions, 130mm heads, 1750mm continuous hoses, drain-fit checks and immutable input pass.');
if(process.env.SHOWER_BROWSER==='1'){
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.INTERIOR_URL||'http://127.0.0.1:8765/interior.html',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.DEBUG?.livingFitout);
    const result=await page.evaluate(async()=>{
      const THREE=await import('three'),{buildModel}=await import('./model3d.js'),{buildShowerFittings}=await import('./docs/shower-fittings.js');
      const model=buildShowerFittings(data),group=buildModel(THREE,model);
      const meshes=[];group.traverse(o=>{if(o.isMesh)meshes.push(o);});group.updateMatrixWorld(true);
      const bounds=name=>{const single=buildModel(THREE,{...model,parts:model.parts.filter(p=>p.name===name)}),box=new THREE.Box3().setFromObject(single);return {min:box.min.toArray(),max:box.max.toArray()};};
      return {finite:meshes.every(m=>[...m.geometry.attributes.position.array].every(Number.isFinite)),main:bounds('main_shower_mixer_rosette'),guest:bounds('guest_shower_mixer_rosette')};
    });
    assert(result.finite);
    assert(result.main.min[0]>.60&&result.main.max[0]<.62);
    assert(result.guest.max[2]<18.65&&result.guest.min[2]>18.63);
    assert(await page.evaluate(()=>{
      const group=DEBUG.livingFitout.showers;
      return group?.parent===DEBUG.hou.furniture&&group.children.some(category=>category.children.some(mesh=>mesh.isMesh));
    }),'Detailed showers must be attached to house furniture');
    for(const preset of ['mainShower','guestShower']){
      const button=page.locator(`[data-view="${preset}"]`);
      await button.click();
      assert(await button.evaluate(element=>element.classList.contains('active')),`${preset} preset must activate`);
      assert(await page.locator('#showerNotes').isVisible(),`${preset} must expose shower fit notes`);
      assert(await page.evaluate(()=>DEBUG.camera.isPerspectiveCamera));
      assert((await page.locator('#viewlabel').textContent()).includes(preset.toUpperCase()));
    }
    assert.deepEqual(errors,[]);
    console.log('Browser: finite shower meshes, wall-mounted mixers, live attachment, both preset buttons and visible notes pass.');
  }finally{await browser.close();}
}
