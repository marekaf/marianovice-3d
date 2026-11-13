// browser-ci {"shard":"entrance"}
import assert from 'node:assert/strict';
import {launchChrome,serveRepo} from './scripts/browser.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=resolve(process.env.PERGOLA_SCREENSHOT_DIR||'/tmp/pergola-bedroom-review');
await mkdir(output,{recursive:true});
const server=await serveRepo({rewrite(path,data){
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();',`window.pergolaReview={scene,camera,renderer,loadWalkInterior,aim(position,target){fpState.active=false;controls.enabled=false;camera.position.set(...position);controls.target.set(...target);camera.lookAt(...target);renderer.render(scene,camera);}};ViewerLoading.finish();`);
  return data;
}});
let browser;
try{
  browser=await launchChrome();
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${server.origin}/index.html`);
  await page.waitForFunction(()=>window.pergolaReview,null,{timeout:120000});
  await page.locator('#toggleFP').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change'));});
  await page.waitForFunction(()=>document.querySelector('#walkInteriorStatus').dataset.state==='ready',null,{timeout:120000});
  await page.addStyleTag({content:'body > :not(canvas):not(script):not(style) {visibility:hidden !important}'});
  const views=[
    {name:'bedroom-window-seat',position:[20.48,3.665,9.38],target:[34.5,3.2,7.5]},
    {name:'bedroom-bed',position:[18.2,3.515,9.38],target:[34.5,3.2,7.5]},
    {name:'north-garden-overview',position:[39,17,24],target:[27,1.2,7]},
  ];
  for(const view of views){
    await page.evaluate(view=>pergolaReview.aim(view.position,view.target),view);
    await page.screenshot({path:resolve(output,`${view.name}.png`)});
    const position=await page.evaluate(()=>pergolaReview.camera.position.toArray());
    assert(Math.hypot(...position.map((v,i)=>v-view.position[i]))<.001,`${view.name}: capture camera moved away from the requested viewpoint`);
  }
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'review.json'),JSON.stringify({views,errors},null,2));
  console.log(JSON.stringify({output,views:views.map(v=>v.name),errors}));
}finally{
  await browser?.close();
  await server.close();
}
