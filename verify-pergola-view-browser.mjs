import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('.',import.meta.url));
const output=resolve(process.env.PERGOLA_SCREENSHOT_DIR||'/tmp/pergola-bedroom-review');
await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://localhost').pathname;
  const file=resolve(root,'.'+path);
  let data=await readFile(file);
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();',`window.pergolaReview={scene,camera,renderer,loadWalkInterior,aim(position,target){fpState.active=false;controls.enabled=false;camera.position.set(...position);controls.target.set(...target);camera.lookAt(...target);renderer.render(scene,camera);}};ViewerLoading.finish();`);
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(file)]||'application/octet-stream'});res.end(data);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
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
  await new Promise(done=>server.close(done));
}
