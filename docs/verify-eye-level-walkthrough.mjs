import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { canWalkAt, WALK_STARTS } from './eye-level-walkthrough.js';
const require = createRequire(import.meta.url);
const { HOUSE_INTERIOR: data } = require('../house-interior.js');
for (const preset of Object.values(WALK_STARTS)) assert(canWalkAt(data,...preset.position),preset.label);
assert(!canWalkAt(data,0,6));
assert(!canWalkAt(data,4.55,13));
assert(canWalkAt(data,4.55,14));
assert(!canWalkAt(data,2,10));
assert(!canWalkAt(data,9.8,5.5));
console.log('Walkthrough starts, walls, doorway, atrium and window boundaries pass');
if (process.env.WALKTHROUGH_BROWSER === '1') {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${process.env.INTERIOR_URL || 'http://127.0.0.1:8765/interior.html'}`);
    await page.waitForFunction(()=>window.DEBUG?.walkthrough);
    await page.locator('[data-panel="walk"]').click();
    await page.locator('#walkStart').click();
    assert(await page.evaluate(()=>window.DEBUG.walkthrough.active));
    assert(await page.locator('#walkTouchControls').isHidden(),'Desktop keeps keyboard and mouse controls');
    assert.equal(await page.evaluate(()=>window.DEBUG.camera.position.y-window.DEBUG.hou.dims.floorY),1.68);
    const before=await page.evaluate(()=>window.DEBUG.camera.position.toArray());
    await page.keyboard.down('KeyW');
    await page.waitForFunction(position=>Math.hypot(DEBUG.camera.position.x-position[0],DEBUG.camera.position.z-position[2])>.05,before);
    await page.keyboard.up('KeyW');
    const after=await page.evaluate(()=>window.DEBUG.camera.position.toArray());
    assert(Math.hypot(after[0]-before[0],after[2]-before[2])>.05);
    await page.locator('[data-panel="walk"]').click();
    await page.locator('#walkViewer').selectOption('1.46');
    await page.locator('[data-panel="walk"]').click();
    assert.equal(await page.evaluate(()=>window.DEBUG.camera.position.y-window.DEBUG.hou.dims.floorY),1.46);
    const rotation=await page.evaluate(()=>window.DEBUG.camera.quaternion.toArray());
    await page.mouse.move(650,450); await page.mouse.down(); await page.mouse.move(750,480); await page.mouse.up();
    assert.notDeepEqual(await page.evaluate(()=>window.DEBUG.camera.quaternion.toArray()),rotation);
    await page.keyboard.press('Escape');
    assert(!await page.evaluate(()=>window.DEBUG.walkthrough.active));
    for (const value of Object.keys(WALK_STARTS)) {
      await page.locator('[data-panel="walk"]').click();
      await page.locator('#walkRoom').selectOption(value); await page.locator('#walkStart').click();
      assert(await page.evaluate(()=>window.DEBUG.walkthrough.active));
      await page.keyboard.press('Escape');
    }
    await page.locator('[data-panel="walk"]').click();
    await page.locator('#walkStart').click();
    await page.locator('[data-panel="rooms"]').click();
    await page.locator('[data-view="cut3d"]').click();
    assert(!await page.evaluate(()=>window.DEBUG.walkthrough.active));
    assert(await page.evaluate(()=>window.DEBUG.camera.isOrthographicCamera));
    assert.deepEqual(errors,[]);
    console.log('Browser: walking, heights, drag look, five starts, Escape and cutaway pass');
    const mobile = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    mobile.on('pageerror',error=>errors.push(error.message));
    await mobile.goto(process.env.INTERIOR_URL || 'http://127.0.0.1:8765/interior.html');
    await mobile.waitForFunction(()=>window.DEBUG?.walkthrough);
    await mobile.locator('[data-panel="walk"]').tap();
    await mobile.locator('#walkStart').tap();
    assert.equal(await mobile.locator('#walkTouchControls button[data-direction]').count(),4,'Touch walking has four hold directions');
    const session = await mobile.context().newCDPSession(mobile);
    const position = () => mobile.evaluate(()=>DEBUG.camera.position.toArray());
    const moved = async before => mobile.waitForFunction(p=>Math.hypot(DEBUG.camera.position.x-p[0],DEBUG.camera.position.z-p[2])>.03,before);
    const center = async selector => {
      const box = await mobile.locator(selector).boundingBox();
      return {x:box.x+box.width/2,y:box.y+box.height/2};
    };
    const touch = (type,points) => session.send('Input.dispatchTouchEvent',{type,touchPoints:points});
    const forward = {id:1,...await center('[data-direction="forward"]')};
    const origin = await position();
    await touch('touchStart',[forward]);
    await moved(origin);
    const rotationBefore = await mobile.evaluate(()=>DEBUG.camera.quaternion.toArray());
    await touch('touchStart',[forward,{id:2,x:300,y:370}]);
    await touch('touchMove',[forward,{id:2,x:350,y:390}]);
    assert.notDeepEqual(await mobile.evaluate(()=>DEBUG.camera.quaternion.toArray()),rotationBefore,'Second finger looks while walking');
    const walkingLook = await position();
    await moved(walkingLook);
    await touch('touchEnd',[forward]);
    await mobile.waitForFunction(()=>document.querySelector('[data-direction="forward"]').getAttribute('aria-pressed')==='false');
    assert.equal(await mobile.locator('[data-direction="forward"]').getAttribute('aria-pressed'),'false');
    const remainingLook = await mobile.evaluate(()=>DEBUG.camera.quaternion.toArray());
    await touch('touchMove',[{id:2,x:315,y:390}]);
    await mobile.waitForFunction(q=>DEBUG.camera.quaternion.toArray().some((v,i)=>v!==q[i]),remainingLook);
    assert.notDeepEqual(await mobile.evaluate(()=>DEBUG.camera.quaternion.toArray()),remainingLook,'Releasing movement preserves look pointer');
    await touch('touchEnd',[]);
    const assertStopped = async label => {
      const before = await position();
      await mobile.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const after=await position();
      assert(Math.hypot(...after.map((value,i)=>value-before[i]))<1e-8,label);
      assert.equal(await mobile.locator('#walkTouchControls [aria-pressed="true"]').count(),0,label);
    };
    await assertStopped('Touch release stops movement');
    await mobile.keyboard.down('KeyS');
    await touch('touchStart',[forward]);
    await touch('touchEnd',[]);
    const keyboardOrigin = await position(); await moved(keyboardOrigin);
    await mobile.keyboard.up('KeyS');
    await assertStopped('Touch release does not clear held keyboard movement');
    for (const event of ['pointercancel','lostpointercapture','blur','visibilitychange','pagehide']) {
      await mobile.evaluate(()=>document.querySelector('[data-direction="forward"]').addEventListener('pointerdown',e=>window.lastWalkTouchId=e.pointerId,{once:true}));
      await touch('touchStart',[forward]);
      await mobile.waitForFunction(()=>document.querySelector('[data-direction="forward"]').getAttribute('aria-pressed')==='true');
      if(event==='lostpointercapture') await touch('touchMove',[{...forward,y:forward.y+2}]);
      await mobile.evaluate(event=>{
        const button=document.querySelector('[data-direction="forward"]');
        if(event==='lostpointercapture'||event==='pointercancel') {
          const id=window.lastWalkTouchId;
          if(event==='lostpointercapture') button.releasePointerCapture(id);
          else button.dispatchEvent(new PointerEvent(event,{pointerId:id}));
        } else (event==='visibilitychange'?document:window).dispatchEvent(new Event(event));
      },event);
      if(event==='lostpointercapture') await touch('touchMove',[{...forward,y:forward.y+1}]);
      await mobile.waitForFunction(()=>document.querySelector('[data-direction="forward"]').getAttribute('aria-pressed')==='false',null,{timeout:5000}).catch(error=>{throw new Error(`${event} did not clear held movement`,{cause:error});});
      await assertStopped(event+' clears movement');
      await touch('touchEnd',[]);
    }
    const right={id:3,...await center('[data-direction="right"]')};
    await touch('touchStart',[forward,right]);
    await mobile.waitForFunction(()=>document.querySelectorAll('#walkTouchControls [aria-pressed="true"]').length===2);
    await touch('touchEnd',[forward]);
    await mobile.waitForFunction(()=>document.querySelector('[data-direction="forward"]').getAttribute('aria-pressed')==='false');
    assert.equal(await mobile.locator('[data-direction="right"]').getAttribute('aria-pressed'),'true','Releasing one direction preserves another');
    await touch('touchEnd',[]);
    for (const viewport of [{width:390,height:844},{width:844,height:390}]) {
      await mobile.setViewportSize(viewport);
      for (const button of await mobile.locator('#walkTouchControls button').all()) {
        const box=await button.boundingBox();
        assert(box.width>=44&&box.height>=44,'Touch targets meet minimum size');
        assert(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height,'Touch controls fit viewport');
        const reachable=await button.evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));});
        assert(reachable,'Touch controls are not covered');
      }
    }
    await mobile.setViewportSize({width:390,height:844});
    await touch('touchStart',[forward]);
    await mobile.waitForFunction(()=>document.querySelector('[data-direction="forward"]').getAttribute('aria-pressed')==='true');
    const collision=await mobile.evaluate(()=>{
      const origin=DEBUG.camera.position.toArray(), time=performance.now();
      for(let i=0;i<1000;i++) DEBUG.walkthrough.update(time+i*50);
      const wall=DEBUG.camera.position.toArray();
      for(let i=1000;i<1020;i++) DEBUG.walkthrough.update(time+i*50);
      const held=DEBUG.camera.position.toArray();
      window.dispatchEvent(new Event('blur'));
      return {origin,wall,held};
    });
    assert(Math.hypot(collision.wall[0]-collision.origin[0],collision.wall[2]-collision.origin[2])>.1,'Touch advances toward wall');
    assert.deepEqual(collision.held,collision.wall,'Continuing to hold at wall cannot advance through it');
    const atWall=await position();
    assert(canWalkAt(data,atWall[0]-data.originPlot.x,atWall[2]-data.originPlot.z),'Touch movement remains within walkable walls');
    await touch('touchEnd',[]);
    await touch('touchStart',[forward]);
    await mobile.waitForFunction(()=>document.querySelector('[data-direction="forward"]').getAttribute('aria-pressed')==='true');
    await mobile.evaluate(()=>DEBUG.walkthrough.stop());
    await assertStopped('Stopping while contact is held clears movement');
    await mobile.evaluate(()=>DEBUG.walkthrough.start());
    await assertStopped('Restarting does not inherit a held contact');
    await touch('touchEnd',[]);
    await mobile.locator('#hideInteriorUI').tap();
    assert(await mobile.locator('#walkTouchControls [data-stop]').isVisible(),'Clean view retains a walking exit');
    await touch('touchStart',[forward]);
    await mobile.locator('#walkTouchControls [data-stop]').tap();
    assert(!await mobile.evaluate(()=>DEBUG.walkthrough.active));
    assert(await mobile.locator('#walkTouchControls').isHidden());
    assert.equal(await mobile.locator('#walkTouchControls [aria-pressed="true"]').count(),0,'Stopping clears held touch inputs');
    await touch('touchEnd',[]);
    assert.deepEqual(errors,[]);
    console.log('Browser: touch movement, simultaneous look, keyboard isolation, interruption cleanup, collision and portrait/landscape reachability pass');
  } finally { await browser.close(); }
}
