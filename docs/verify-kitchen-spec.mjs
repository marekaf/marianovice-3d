import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareLivingData} from './living-interior.js';

const require=createRequire(import.meta.url),{HOUSE_INTERIOR}=require('../house-interior.js');
const before=JSON.stringify(HOUSE_INTERIOR),data=prepareLivingData(HOUSE_INTERIOR);
const island=data.furniture.find(f=>f.label.startsWith('ostrov'));
assert(Math.abs(island.h+island.worktop.th-.910)<1e-9,'Island finished top must be 910 mm');
for(const f of data.furniture.filter(f=>f.kind==='cab'&&['1.06','nika'].includes(f.room)&&!f.y0&&!f.label.startsWith('TV'))){
  assert.equal(f.plinth,.125,`${f.label}: kitchen plinth must be 125 mm`);
  if(!f.label.startsWith('ostrov'))assert.equal(f.h,HOUSE_INTERIOR.furniture.find(source=>source.label===f.label).h,'Other counter and cabinet heights stay unchanged');
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
      return {tap:color('tap_riser'),sink:color('sink_bottom'),ledY:led.children[0].position.y};
    });
    assert.equal(actual.tap,'404746');assert.equal(actual.sink,'827565');
    assert(Math.abs(actual.ledY-.868)<1e-9,'Island LED must follow lowered underside');
    assert.deepEqual(errors,[]);console.log('Live kitchen: graphite tap, tartufo-like sink, lowered island LED; no browser errors.');
  }finally{await browser.close();}
}
