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
    await page.locator('#walkthrough summary').click();
    await page.locator('#walkStart').click();
    assert(await page.evaluate(()=>window.DEBUG.walkthrough.active));
    assert.equal(await page.evaluate(()=>window.DEBUG.camera.position.y-window.DEBUG.hou.dims.floorY),1.68);
    const before=await page.evaluate(()=>window.DEBUG.camera.position.toArray());
    await page.keyboard.down('KeyW');
    await page.waitForFunction(position=>Math.hypot(DEBUG.camera.position.x-position[0],DEBUG.camera.position.z-position[2])>.05,before);
    await page.keyboard.up('KeyW');
    const after=await page.evaluate(()=>window.DEBUG.camera.position.toArray());
    assert(Math.hypot(after[0]-before[0],after[2]-before[2])>.05);
    await page.locator('#walkViewer').selectOption('1.46');
    assert.equal(await page.evaluate(()=>window.DEBUG.camera.position.y-window.DEBUG.hou.dims.floorY),1.46);
    const rotation=await page.evaluate(()=>window.DEBUG.camera.quaternion.toArray());
    await page.mouse.move(650,450); await page.mouse.down(); await page.mouse.move(750,480); await page.mouse.up();
    assert.notDeepEqual(await page.evaluate(()=>window.DEBUG.camera.quaternion.toArray()),rotation);
    await page.keyboard.press('Escape');
    assert(!await page.evaluate(()=>window.DEBUG.walkthrough.active));
    for (const value of Object.keys(WALK_STARTS)) {
      await page.locator('#walkRoom').selectOption(value); await page.locator('#walkStart').click();
      assert(await page.evaluate(()=>window.DEBUG.walkthrough.active));
      await page.keyboard.press('Escape');
    }
    await page.locator('#walkStart').click();
    await page.locator('[data-view="cut3d"]').click();
    assert(!await page.evaluate(()=>window.DEBUG.walkthrough.active));
    assert(await page.evaluate(()=>window.DEBUG.camera.isOrthographicCamera));
    assert.deepEqual(errors,[]);
    console.log('Browser: walking, heights, drag look, five starts, Escape and cutaway pass');
  } finally { await browser.close(); }
}
