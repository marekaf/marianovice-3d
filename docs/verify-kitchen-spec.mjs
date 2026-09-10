import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareLivingData} from './living-interior.js';

const require=createRequire(import.meta.url),{HOUSE_INTERIOR}=require('../house-interior.js');
const before=JSON.stringify(HOUSE_INTERIOR),data=prepareLivingData(HOUSE_INTERIOR);
const niche=data.furniture.find(f=>f.label==='nika base');
assert(Math.abs(niche.h+niche.worktop-.91)<1e-9,'Coffee niche finished worktop includes its 38 mm top');
assert.equal(data.coffeeNicheUpper.y0,1.46);
assert(!data.furniture.some(f=>f.label==='nika uppers'),'Custom niche upper must not overlap a generic cabinet');
const base=data.furniture.find(f=>f.label.startsWith('kuchyň base run'));
const sinkCenter=base.x0+base.modules[0]+base.modules[1]/2;
const cut=base.worktop.cutouts[0];
assert(Math.abs((cut.x0+cut.x1)/2-sinkCenter)<1e-9,'Sink opening follows the waste cabinet rather than a fixed scene coordinate');
const island=data.furniture.find(f=>f.label.startsWith('ostrov'));
assert(Math.abs(island.h+island.worktop.th-.910)<1e-9,'Island finished top must be 910 mm');
assert(Math.abs(island.worktop.x1-island.worktop.x0-2)<1e-9,'Island finished top must be 2000 mm long');
assert.equal(island.worktop.x0,island.x0,'Island top must be flush with its left side panel');
assert.equal(island.worktop.x1,island.x1,'Island top must be flush with its right side panel');
assert.equal(island.worktop.z0,island.z0,'Island top must be flush with the work-side cabinet edge');
assert(Math.abs(island.worktop.z1-island.worktop.z0-.9)<1e-9,'Island finished depth must be 900 mm');
assert(Math.abs(island.worktop.z1-island.z1-.3)<1e-9,'Seating overhang must remain 300 mm');
assert.equal(island.worktop.z1,6.85,'Seating edge must not move');
const {FurnitureModel}=require('../furniture-model.js');
const top=FurnitureModel.build([island]).parts.find(part=>part.name.endsWith('_worktop'));
assert(Math.abs(top.size[1]-.9)<1e-9,'Built worktop must retain the specified 900 mm depth');
assert(Math.abs(top.position[1]-top.size[1]/2-5.95)<1e-9,'Built work-side finish must be at 5.95 m');
for(const f of data.furniture.filter(f=>f.kind==='cab'&&['1.06','nika'].includes(f.room)&&!f.y0&&!f.label.startsWith('TV'))){
  assert.equal(f.plinth,.125,`${f.label}: kitchen plinth must be 125 mm`);
  if(f.label.startsWith('kuchyň base run')||f.label.startsWith('kuchyň L-leg'))assert(Math.abs(f.h+f.worktop.th-.91)<1e-9,'Main run and window counter finished top are 910 mm');
  else if(f.label.startsWith('kuchyň roh filler'))assert(Math.abs(f.h-.872)<1e-9,'Corner fillers finish below the 38 mm worktop');
  else if(f.label==='nika base')assert(Math.abs(f.h+f.worktop-.91)<1e-9);
  else if(!f.label.startsWith('ostrov'))assert.equal(f.h,HOUSE_INTERIOR.furniture.find(source=>source.label===f.label).h,'Other counter and cabinet heights stay unchanged');
}
assert.equal(JSON.stringify(HOUSE_INTERIOR),before,'Preparation must not mutate source geometry');
console.log('Kitchen specification: 910 mm finished island top; source data preserved.');
if(process.env.PLAYWRIGHT_MODULE){
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const url=new URL(process.env.INTERIOR_URL??'http://127.0.0.1:8765/interior.html');
    url.hash='house-kitchen';
    await page.goto(url.href);
    await page.waitForFunction(()=>window.DEBUG?.livingFitout);
    const actual=await page.evaluate(()=>{
      const meshes=[];DEBUG.livingFitout.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
      const color=name=>meshes.find(o=>o.material.name===DEBUG.livingFitout.parts.find(p=>p.name===name)?.material)?.material.color.getHexString();
      const led=DEBUG.hou.root.getObjectByName('Island overhang strip');
      const stools=DEBUG.livingFitout.parts.filter(p=>/^bar_stool_\d_seat$/.test(p.name));
      return {tap:color('tap_riser'),sink:color('sink_bottom'),ledY:led.children[0].position.y,ledZ:led.children[0].position.z,
        stoolFronts:stools.map(p=>p.position[1]-p.size[1]/2)};
    });
    assert.equal(actual.tap,'404746');assert.equal(actual.sink,'827565');
    assert(Math.abs(actual.ledY-.868)<1e-9,'Island LED must follow lowered underside');
    assert(Math.abs(actual.ledZ-6.805)<1e-9,'Island LED must stay attached to the unchanged seating edge');
    assert.equal(actual.stoolFronts.length,3);
    assert(actual.stoolFronts.every(z=>Math.abs(z-6.855)<1e-9),'Bar seating must stay in place');
    assert.deepEqual(errors,[]);console.log('Live kitchen: graphite tap, tartufo-like sink, lowered island LED; no browser errors.');
  }finally{await browser.close();}
}
