import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const element = id => GARDEN.elements.find(item => item.id === id);
const rect = id => element(id).parts.find(part => part.kind === 'rect');
const footprint = id => {
  const { x, y, w, d } = rect(id);
  return [x, y, w, d];
};
const fixedIds = ['house', 'garage', 'carport', 'driveway', 'eastTerrace', 'westTerrace', 'northPassage'];
const fixed = GARDEN.elements.filter(item => fixedIds.includes(item.id));
assert.equal(createHash('sha256').update(JSON.stringify(fixed)).digest('hex'),
  'a987da7fd6f269925bc7996a9acfb0496bc702cbc2df3ffd352ba16f5221ceb4',
  'The approved garden layout must not change buildings, terraces or the north passage');
assert.deepEqual(footprint('pergola'), [25, 6.8, 6, 4]);
assert.deepEqual(footprint('sauna'), [5.3, 2, 4, 3]);
assert.deepEqual(footprint('saunaShelter'), [2.3, 2, 3, 3]);
assert.deepEqual(footprint('greenhouse'), [2.2, 12.5, 2, 3]);
const greenhouse = rect('greenhouse');
for (const tree of ['northTrees', 'orchard'].flatMap(id => element(id).parts).filter(part => part.kind === 'circle')) {
  const dx = tree.cx - Math.max(greenhouse.x, Math.min(tree.cx, greenhouse.x + greenhouse.w));
  const dy = tree.cy - Math.max(greenhouse.y, Math.min(tree.cy, greenhouse.y + greenhouse.d));
  assert.ok(Math.hypot(dx, dy) > (tree.canopyRadius ?? tree.r), 'Tree crowns must clear the greenhouse');
}
assert.deepEqual(footprint('compost'), [2.2, 9.7, 2, 1]);
assert(rect('compost').y+rect('compost').d<11.3,'Compost must leave the greenhouse forecourt and access route clear');
assert.deepEqual(footprint('zasivarna'), [31.66, 18.2, 1.28, .7]);
assert.deepEqual(['raisedBed1','raisedBed2','raisedBed3','raisedBed4'].map(footprint),
  [[5.2,10.5,1,2],[7.2,10.5,1,2],[5.2,13.5,1,2],[7.2,13.5,1,2]]);
const table = element('pergola').parts.find(part => part.role === 'table');
assert.deepEqual([table.w, table.d], [2.4, 1.1]);
assert.equal(element('pergola').meta.grading.level, 1.915);
assert.equal(element('firePit').meta.grading.level, 1.515);
const fire = element('firePit').parts.filter(part => part.kind === 'circle');
assert.deepEqual(fire.map(part => [part.cx, part.cy, part.r]), [[34.5,7.5,2],[34.5,7.5,.5],[34.5,7.5,.496]]);
const pond = element('pond').parts[0];
assert.deepEqual([pond.cx,pond.cy,pond.rx,pond.ry], [34.8,14,1.5,1]);
assert.equal(new Set(GARDEN.elements.map(item => item.id)).size, GARDEN.elements.length);
assert.equal(GARDEN.gardenRoutes.length, 9);
assert.deepEqual(GARDEN.gardenRoutes.find(route => route.id === 'Gathering connection'),
  {id:'Gathering connection',points:[[30.5,10.6],[30.5,11.8],[31.8,11.8],[31.8,9.6],[32.6,8.0]],width:1.2});
const paving=element('pergola').parts.find(p=>p.role==='paving');
const dining=GARDEN.gardenRoutes.find(r=>r.id==='Daily dining');
assert.ok(Math.abs(dining.points.at(-1)[1]-dining.width/2-(paving.y+paving.d))<1e-7,'Dining route must reach the paving, not stop at the roof footprint');
assert.ok(GARDEN.gardenRoutes.every(route => route.width >= 1 && route.points.length >= 2));
assert.ok(!GARDEN.elements.some(e=>e.id==='steppingPaths'));
for (const id of ['westBackbone','productiveBorder','quietGardenBorder','eastGatheringBorder','terraceFrontage','orchardMeadow','arrivalStrip','officeViewBorder','tankCover']) {
  assert.equal(element(id).parts[0].kind, 'polygon');
  assert.ok(element(id).meta.plant);
}
for (const id of ['pondFringe','bedTerrace','prairieIsland','saunaBed','pergolaBeds','eastUnderstory','southFoundation','garageFaceBed','rainGarden']) {
  assert.equal(element(id), undefined, `${id} must not survive as an isolated legacy bed`);
}
const trees = ['orchard','northTrees','eastTrees'].flatMap(id => element(id).parts);
assert.ok(trees.some(tree=>tree.cx===6&&tree.cy===20.8&&tree.form==='multistem'));
assert.equal(element('officeWestPrivacy'),undefined);
assert.equal(element('atriumWestPrivacy'),undefined);
assert.deepEqual(footprint('guestBathroomPrivacy'),[15.7,28.05,2.4,.14]);
assert.equal(element('guestBathroomPrivacy').meta.screen.h,2.3);
const bathroomScreen=rect('guestBathroomPrivacy');
assert(bathroomScreen.x<=16.27&&bathroomScreen.x+bathroomScreen.w>=17.09,'Screen must span the actual guest-bathroom window');
assert(bathroomScreen.y>=26.43+1.5&&bathroomScreen.x+bathroomScreen.w<21.28,'Screen must leave passage and driveway clear');
assert.equal(trees.filter(tree => tree.form === 'evergreen').length, 6);
assert(trees.some(t=>t.cx===15&&t.cy===3.8&&t.form==='multistem'));
const northShrubs=element('dressingNorthShrubs');
assert.equal(northShrubs.meta.leafHabit,'evergreen');
assert.equal(northShrubs.parts.length,3);
assert(northShrubs.parts.every(p=>p.cy+p.r*.72<5.53),'Dressing-room shrubs must leave the north passage clear');
assert(trees.filter(t=>t.cx>12&&t.cx<18&&t.cy<5).every(t=>t.cy+t.canopyRadius<5.53));
const westShrubs=element('westEvergreenShrubs');
assert.equal(westShrubs.meta.leafHabit,'evergreen');
assert.equal(westShrubs.parts.length,9);
for(const shrub of westShrubs.parts){
  const spread=shrub.r*.72;
  const dx=Math.max(greenhouse.x-shrub.cx,0,shrub.cx-greenhouse.x-greenhouse.w);
  const dy=Math.max(greenhouse.y-shrub.cy,0,shrub.cy-greenhouse.y-greenhouse.d);
  assert(Math.hypot(dx,dy)>spread,'West shrub crowns must clear the greenhouse');
  assert(shrub.cx+spread<2.4,'Privacy planting must remain at the west boundary, away from office foreground and passage');
}
assert(trees.some(t=>t.cx===2&&t.cy===28.5));assert(trees.some(t=>t.cx===4.4&&t.cy===28.6));
assert.ok(trees.every(tree => Math.hypot(tree.cx - fire[0].cx, tree.cy - fire[0].cy) > tree.canopyRadius + fire[0].r),
  'Tree crowns must not overhang the occupied fire apron');
for (const [cx,cy] of [[3,25],[6.8,27],[24.7,3.6],[34.8,3.1],[40.2,14]]) {
  assert.ok(trees.some(tree => tree.cx === cx && tree.cy === cy));
}
for (const reserve of GARDEN.gardenReserves) {
  assert.ok(trees.every(tree => tree.cx < reserve.x || tree.cx > reserve.x + reserve.w || tree.cy < reserve.y || tree.cy > reserve.y + reserve.d));
}
const segmentDistance = (x,y,a,b) => {
  const dx=b[0]-a[0], dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
};
const inside = (x,y,points) => {
  let result=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [ax,ay]=points[i], [bx,by]=points[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax)result=!result;
  }
  return result;
};
const planting = GARDEN.elements.filter(item => item.meta?.plant).flatMap(item => item.parts).filter(part => part.kind === 'polygon');
for(const light of ['pathLights','gardenSpots'].flatMap(id => element(id).parts).filter(part => part.kind === 'circle')) {
  assert.ok(Math.hypot(light.cx-fire[0].cx,light.cy-fire[0].cy)>fire[0].r+light.r);
  assert.ok(((light.cx-pond.cx)/(pond.rx+light.r))**2+((light.cy-pond.cy)/(pond.ry+light.r))**2>1);
  for(const bed of planting) {
    assert.ok(!inside(light.cx,light.cy,bed.points), 'Lights must not be scattered inside planting masses');
    assert.ok(bed.points.every((point,i)=>segmentDistance(light.cx,light.cy,point,bed.points[(i+1)%bed.points.length])>light.r));
  }
  if(light.route) {
    const route=GARDEN.gardenRoutes.find(item=>item.id===light.route);
    assert.ok(route);
    const offset=Math.min(...route.points.slice(1).map((point,i)=>segmentDistance(light.cx,light.cy,route.points[i],point)))-route.width/2;
    assert.ok(offset>=.5-1e-6 && offset<1.3, 'Bollards should flank the named route with at least 0.5 m clearance');
  }
}
console.log('Approved A footprints, room planting, routes, lighting, reserves and fixed geometry verified');
if(process.env.GARDEN_BROWSER==='1'){
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/index.html',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:(await response.text()).replace('animate();','window.roomLayoutReview={scene,treesGroup,fenceGroup,camera,controls,deckTop,ground};animate();')});
    });
    await page.goto(process.env.GARDEN_URL||'http://127.0.0.1:8765/index.html',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.roomLayoutReview);
    const report=await page.evaluate(async()=>{
      const THREE=await import('three'),r=roomLayoutReview;
      r.scene.updateMatrixWorld(true);
      const shrubHabit=id=>GARDEN.elements.find(e=>e.id===id).parts.map(s=>{
        const root=r.treesGroup.children.find(t=>Math.hypot(t.position.x-s.cx,t.position.z-s.cy)<.001);
        return root?.userData.leafHabit==='evergreen'&&root.children.find(c=>c.name==='Individual shrub leaves')?.userData.leafHabit==='evergreen';
      });
      const screens=r.fenceGroup.children.filter(g=>{
        const c=new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3());
        return c.x>15.5&&c.x<18.2&&Math.abs(c.z-28.12)<.15;
      });
      const blocked=[16.35,16.68,17.0].map(x=>{
        const ray=new THREE.Raycaster(new THREE.Vector3(x,r.deckTop+1.55,26.44),new THREE.Vector3(0,0,1));
        return ray.intersectObjects(screens,true).length>0;
      });
      const slatClearances=screens.map(group=>{
        const bounds=new THREE.Box3();
        group.traverse(mesh=>{if(mesh.isMesh&&mesh.material.name.startsWith('privacy_timber_'))bounds.union(new THREE.Box3().setFromObject(mesh));});
        let highestGround=-Infinity;
        for(let i=0;i<=16;i++)for(const z of[bounds.min.z,bounds.max.z]){
          const x=bounds.min.x+(bounds.max.x-bounds.min.x)*i/16;
          const hit=new THREE.Raycaster(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0)).intersectObject(r.ground)[0];
          if(hit)highestGround=Math.max(highestGround,hit.point.y);
        }
        return bounds.min.y-highestGround;
      });
      return {west:shrubHabit('westEvergreenShrubs'),north:shrubHabit('dressingNorthShrubs'),screenCount:screens.length,blocked,slatClearances};
    });
    assert.equal(report.west.length,9);assert(report.west.every(Boolean));
    assert.equal(report.north.length,3);assert(report.north.every(Boolean));
    assert.equal(report.screenCount,2);assert(report.blocked.every(Boolean));
    assert(report.slatClearances.every(clearance=>clearance>.02),`Privacy blades must clear rendered soil: ${report.slatClearances}`);
    if(process.env.GARDEN_SCREENSHOTS){
      for(const preset of ['marekOfficeView','dressingRoomView']){
        await page.evaluate(p=>setPreset(p),preset);
        await page.screenshot({path:`${process.env.GARDEN_SCREENSHOTS}/${preset}.png`});
      }
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
  }finally{await browser.close();}
}
