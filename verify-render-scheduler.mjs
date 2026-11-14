// browser-ci {"shard":"slow-4"}
import assert from 'node:assert/strict';
import {launchChrome} from './scripts/browser.mjs';
import {createRenderScheduler} from './render-scheduler.js';

const queued=new Map(),deltas=[];
let id=0,continuous=false,invalidateDuringFrame=false;
const scheduler=createRenderScheduler({
  requestFrame:callback=>{queued.set(++id,callback);return id;},
  cancelFrame:frame=>queued.delete(frame),
  render:dt=>{deltas.push(dt);if(invalidateDuringFrame){invalidateDuringFrame=false;scheduler.invalidate();}return continuous;},
});
const tick=time=>{const [frame,callback]=queued.entries().next().value;queued.delete(frame);callback(time);};
scheduler.invalidate();scheduler.invalidate();
assert.equal(queued.size,1,'Burst input schedules one frame');
tick(1000);
assert.equal(queued.size,0,'An unchanged view consumes no further frames');
assert.deepEqual(deltas,[0]);
scheduler.invalidate();tick(1016);
assert.equal(deltas.at(-1),.016,'Successive drag events still advance ambient motion');
continuous=true;scheduler.invalidate();tick(10000);tick(10016);
assert.deepEqual(deltas.slice(-2),[0,.016],'Idle time is not animation time');
continuous=false;tick(20000);
assert.equal(deltas.at(-1),.1,'A delayed frame cannot jump through the scene');
assert.equal(queued.size,0);
invalidateDuringFrame=true;scheduler.invalidate();tick(21000);
assert.equal(queued.size,1,'Control damping can request its next frame during rendering');
tick(21016);assert.equal(queued.size,0);
continuous=true;scheduler.invalidate();tick(22000);
scheduler.setVisible(false);assert.equal(queued.size,0,'Hidden pages cancel pending GPU work');
scheduler.invalidate();assert.equal(queued.size,0);
scheduler.setVisible(true);tick(60000);assert.equal(deltas.at(-1),0,'Resuming a hidden page does not advance the tour');
scheduler.dispose();scheduler.invalidate();assert.equal(queued.size,0);
console.log('Render scheduling: idle sleep, input coalescing, animation timing, damping and visibility pass');

if(process.env.RENDER_BROWSER==='1'){
  const browser=await launchChrome();
  try{
    const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/index.html',async route=>{
      const response=await route.fetch();
      let html=await response.text();
      html=html.replace('const controls = new OrbitControls','window.renderFrames=0;const countRender=renderer.render.bind(renderer);renderer.render=(...args)=>{window.renderFrames++;return countRender(...args);}; const controls = new OrbitControls');
      html=html.replace('ViewerLoading.finish();','window.renderReview={THREE,renderer,camera,controls,scene,treesGroup,fenceGroup,terrainPreview,privacyPreview,waterNormal,fpState,get tourActive(){return tourActive;},get time(){return animationTime;}}; ViewerLoading.finish();');
      await route.fulfill({response,body:html});
    });
    await page.goto(process.env.GARDEN_URL||'http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
    const limit=Math.max(90000,Number(process.env.BROWSER_TIMEOUT_MS)||0);
    await page.waitForFunction(()=>window.renderReview,null,{timeout:limit});
    const frames=()=>page.evaluate(()=>window.renderFrames);
    // A CPU-rendered frame can take longer than any fixed pause, so rest is counted in animation
    // frames: a scheduler that still draws does so in every one of them. The 750 ms also covers
    // the 160 ms timer of adaptive-resolution.js, which asks for one more frame after the last change.
    const idle=async()=>assert.ok(await page.evaluate(({quiet,limit})=>new Promise(resolve=>{
      const started=performance.now();
      let count=window.renderFrames,since=started,ticks=0;
      const step=()=>{
        const now=performance.now();
        if(window.renderFrames!==count){count=window.renderFrames;since=now;ticks=0;}else ticks++;
        if(ticks>=3&&now-since>=quiet)resolve(true);
        else if(now-started>limit)resolve(false);
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }),{quiet:750,limit}),'Resting garden must stop drawing');
    const moved=from=>page.waitForFunction(from=>renderReview.camera.position.toArray().some((value,index)=>value!==from[index]),from);
    const changed=async action=>{const before=await frames();await action();await page.waitForFunction(value=>window.renderFrames>value,before);};
    await idle();
    const initialCamera=await page.evaluate(()=>renderReview.camera.position.toArray());
    await changed(()=>page.evaluate(()=>setPreset('entranceGate')));
    assert.notDeepEqual(await page.evaluate(()=>renderReview.camera.position.toArray()),initialCamera);
    await changed(()=>page.evaluate(()=>toggleEntranceGate(false)));
    assert.equal(await page.locator('#toggleEntranceGate').isChecked(),false);
    assert.equal(await page.evaluate(()=>renderReview.renderer.shadowMap.needsUpdate),false,'Gate redraw consumes the invalidated shadow map');
    await changed(()=>page.evaluate(()=>{const input=document.getElementById('toggleTrees');input.checked=false;input.dispatchEvent(new Event('change'));}));
    assert.equal(await page.evaluate(()=>renderReview.treesGroup.visible),false);
    await changed(()=>page.evaluate(()=>{const input=document.getElementById('daySlider');input.value='355';input.dispatchEvent(new Event('input'));}));
    assert.match(await page.locator('#dateLabel').textContent(),/Dec/);
    await changed(()=>page.evaluate(()=>{const input=document.getElementById('timeSlider');input.value='22';input.dispatchEvent(new Event('input'));}));
    assert.match(await page.locator('#timeLabel').textContent(),/22:00/);
    await changed(()=>page.evaluate(()=>{const input=document.getElementById('terrainMode');input.value='difference';input.dispatchEvent(new Event('change'));}));
    assert.equal(await page.evaluate(()=>renderReview.terrainPreview.comparison.visible),true);
    await changed(()=>page.evaluate(()=>{document.getElementById('privacyProbes').open=true;}));
    assert.equal(await page.evaluate(()=>renderReview.scene.getObjectByName('Hypothetical privacy probes').visible),true);
    await changed(()=>page.setViewportSize({width:1100,height:780}));
    assert.equal(await page.evaluate(()=>renderReview.camera.aspect),1100/780);
    await changed(()=>page.evaluate(async()=>{
      const {THREE}=renderReview;
      THREE.DefaultLoadingManager.itemStart('unfinished-texture');
      const canvas=document.createElement('canvas');canvas.width=canvas.height=2;
      const texture=await new THREE.TextureLoader().loadAsync(canvas.toDataURL());
      texture.dispose();
    }));
    await changed(()=>page.evaluate(()=>renderReview.THREE.DefaultLoadingManager.itemEnd('unfinished-texture')));
    // OrbitControls damps by its default factor of 0.05 for more than 200 frames before the
    // camera rests. At 0.5 the same decay ends in about 30 frames, which CPU rendering can draw.
    await page.evaluate(()=>{renderReview.controls.enableDamping=true;renderReview.controls.dampingFactor=.5;});
    const beforeOrbit=await page.evaluate(()=>renderReview.camera.position.toArray());
    await page.mouse.move(650,430);await page.mouse.down();await page.mouse.move(760,475,{steps:8});await page.mouse.up();
    assert.notDeepEqual(await page.evaluate(()=>renderReview.camera.position.toArray()),beforeOrbit);
    await idle();
    await page.evaluate(()=>{renderReview.controls.enableDamping=false;});
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    const hiddenFrames=await frames();
    await page.evaluate(()=>setPreset('iso'));await page.waitForTimeout(400);
    assert.equal(await frames(),hiddenFrames,'Suspended page does not draw after scene changes');
    await changed(()=>page.evaluate(()=>window.dispatchEvent(new Event('pageshow'))));
    await changed(()=>page.evaluate(()=>startTour()));
    const tourPosition=await page.evaluate(()=>renderReview.camera.position.toArray());
    await moved(tourPosition);
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    const pausedTime=await page.evaluate(()=>renderReview.time);
    await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>renderReview.time),pausedTime);
    await changed(()=>page.evaluate(()=>window.dispatchEvent(new Event('pageshow'))));
    await page.evaluate(()=>setPreset('iso'));await idle();
    assert.equal(await page.evaluate(()=>renderReview.tourActive),false);
    await page.locator('#walkButton').click();
    await page.waitForFunction(()=>document.pointerLockElement);
    const walkPosition=await page.evaluate(()=>renderReview.camera.position.toArray());
    // The first frame after rest advances no time, so the key stays down until the walker moves.
    await page.keyboard.down('w');await moved(walkPosition);await page.keyboard.up('w');
    await idle();
    await page.evaluate(()=>document.exitPointerLock());
    await page.waitForFunction(()=>!renderReview.fpState.active);await idle();
    assert.deepEqual(errors,[]);
    console.log('Browser: zero idle frames; preset, gate shadows, planting, season, sun, terrain, probes, resize, texture completion, damping, page suspension, tour and WASD verified');
  }finally{await browser.close();}
}
