import assert from 'node:assert/strict';
import {ELECTRICAL_POINTS as points} from './electrical-points.js';
import {buildElectricalFrame} from './electrical-model.js';
import {outletOnFinishedSurface} from './electrical-view.js';

assert.equal(points.length,84);
assert.equal(new Set(points.map(p=>p.id)).size,84);
assert.equal(points.filter(p=>p.kind==='power').length,73);
assert.equal(points.filter(p=>p.kind==='power').reduce((sum,p)=>sum+p.count,0),165);
assert.equal(points.reduce((sum,p)=>sum+p.count,0),180);
for(const [id,x] of [['1.12-V02',6.37],['1.12-V03',8.67]]){
  const point=points.find(p=>p.id===id);
  assert.deepEqual(point.position,[x,.8,.45]);
  const model=buildElectricalFrame([point]);
  assert.equal(model.socketCount,0);
  assert.equal(model.switchCount,1);
  assert(model.parts.some(p=>p.name.endsWith('_rocker')));
}
for(const [id,count] of [['1.06-S02',2],['1.06-Z-pending-fireplace',1]]){
  const point=points.find(p=>p.id===id);
  assert(point,id);
  assert.equal(point.kind,'power',id);
  assert.equal(point.count,count,id);
  assert.equal(point.resolved,false,id);
  assert.equal(point.position,undefined,id);
  assert.equal(point.normal,undefined,id);
  assert.equal(point.source.document,'electrical/mains-power.md',id);
}
const frames=new Map();
for(const point of points){
  assert.equal(point.resolved,Array.isArray(point.position),point.id);
  if(!point.resolved){assert(point.reason?.length>10,point.id);continue;}
  const key=point.frameId??point.id;
  if(!frames.has(key))frames.set(key,[]);
  frames.get(key).push(point);
}
for(const records of frames.values())buildElectricalFrame(records);
const surfacePoint={resolved:true,position:[1,1.1,2],normal:[1,0,0]};
const surfacePanel={position:[1.0125,2,1.1],size:[.025,1,.5]};
assert.equal(outletOnFinishedSurface(surfacePoint,[surfacePanel]).position[0],1.025);
assert.equal(surfacePoint.position[0],1);
assert.equal(outletOnFinishedSurface({...surfacePoint,position:[1,.3,2]},[surfacePanel]).position[0],1);
assert(Math.abs(outletOnFinishedSurface({...surfacePoint,position:[1.025,1.1,2],normal:[-1,0,0]},[surfacePanel]).position[0]-1)<1e-9);
console.log(`${points.filter(p=>p.resolved).length}/${points.length} electrical records resolved; all unresolved records retained with reasons.`);

if(process.env.ELECTRICAL_BROWSER==='1'){
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.INTERIOR_URL||'http://127.0.0.1:8765/interior.html',{waitUntil:'networkidle'});
    assert.equal(await page.locator('#electricalError').count(),0);
    await page.waitForFunction(()=>window.DEBUG?.electrical);
    assert(await page.evaluate(()=>DEBUG.electrical.groups.house.children.find(g=>g.userData.recordIds.includes('1.06-Z11')).position.x>=4.125),'Coffee outlets must mount on the finished backsplash face');
    assert.equal(await page.locator('#electricalPoint option').count(),84);
    await page.locator('#electrical summary').click();
    await page.locator('#electrical-power').uncheck();
    assert(await page.evaluate(()=>Object.values(DEBUG.electrical.groups).every(g=>g.children.filter(o=>o.userData.kind==='power').every(o=>!o.visible))));
    await page.locator('#electrical-power').check();
    const mapped=points.find(p=>p.resolved&&p.building==='house'&&!p.occupiedBy&&p.normal[1]===0);
    await page.locator('#electricalPoint').selectOption(mapped.id);
    await page.locator('#electricalFocus').click();
    assert(await page.evaluate(()=>DEBUG.camera.isPerspectiveCamera));
    await page.locator('#electricalPoint').selectOption('0.01-Z05');
    await page.locator('#electricalFocus').click();
    assert.equal(await page.locator('#electricalPoint').inputValue(),'0.01-Z05');
    const unresolved=points.find(p=>!p.resolved);
    await page.locator('#electricalPoint').selectOption(unresolved.id);
    assert(await page.locator('#electricalFocus').isDisabled());
    assert((await page.locator('#electricalDescription').textContent()).includes(unresolved.reason));
    for(const id of ['1.06-S02','1.06-Z-pending-fireplace']){
      await page.locator('#electricalPoint').selectOption(id);
      assert(await page.locator('#electricalFocus').isDisabled(),id);
      assert((await page.locator('#electricalDescription').textContent()).includes(points.find(p=>p.id===id).reason),id);
    }
    assert.deepEqual(errors,[]);
    console.log('Browser: all records listed, power toggle, point focus and unresolved explanations pass.');
  }finally{await browser.close();}
}
