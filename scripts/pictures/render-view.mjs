// Renders camera views of the garden model (index.html) to PNG in headless Chrome.
// usage: node scripts/pictures/render-view.mjs <views.json> <outdir> [name ...]
import {launchChrome,serveRepo} from '../browser.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const [viewsFile,outDir,...only]=process.argv.slice(2);
if(!viewsFile||!outDir){console.error('usage: render-view.mjs <views.json> <outdir> [name ...]');process.exit(2);}
const views=Object.entries(JSON.parse(await readFile(viewsFile,'utf8'))).filter(([name])=>!only.length||only.includes(name));
if(!views.length){console.error('no matching view');process.exit(2);}
await mkdir(outDir,{recursive:true});
const width=1536,height=1024;

// shot() stops the page's own render loop first: a page frame runs controls.update(), which moves the camera.
const hook=`window.pictureView={THREE,scene,camera,renderer,walkingHeight,setDay(d){currentDay=d;updateSun();},setHour:setSunFromTime,
shot(v){renderScheduler.setVisible(false);fpState.active=false;controls.enabled=false;
const pos=v.eye?[v.eye[0],walkingHeight(v.eye[0],v.eye[2])+v.eye[1],v.eye[2]]:v.pos;
const look=v.eye?[v.look[0],walkingHeight(v.look[0],v.look[2])+v.look[1],v.look[2]]:v.look;
camera.fov=v.fov||50;camera.aspect=${width}/${height};camera.position.set(...pos);camera.up.set(0,1,0);camera.lookAt(...look);camera.updateProjectionMatrix();
renderer.setPixelRatio(1);renderer.setSize(${width},${height},false);renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
return {pos,png:renderer.domElement.toDataURL('image/png')};}};`;
const server=await serveRepo({rewrite(path,data){
  if(path==='/index.html')data=data.toString().replace('ViewerLoading.finish();',hook+'ViewerLoading.finish();');
  return data;
}});
// CPU rendering takes minutes to load the whole garden.
const timeout=Math.max(300000,Number(process.env.BROWSER_TIMEOUT_MS)||0);
let browser;
try{
  browser=await launchChrome(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,channel:undefined}:{});
  const page=await browser.newPage({viewport:{width,height}});
  page.setDefaultTimeout(timeout);
  page.on('pageerror',e=>console.error('pageerror',e.message));
  await page.goto(`${server.origin}/index.html`);
  await page.waitForFunction(()=>window.pictureView,null,{timeout});
  await page.waitForFunction(()=>!document.querySelector('#viewerLoading'),null,{timeout});
  await page.addStyleTag({content:'body > :not(canvas):not(script):not(style) {visibility:hidden !important}'});
  for(const [name,v] of views){
    const r=await page.evaluate(v=>{const p=window.pictureView;p.setDay(v.day??172);p.setHour(v.hour??14);return p.shot(v);},v);
    const file=resolve(outDir,`${name}.png`);
    await writeFile(file,Buffer.from(r.png.split(',')[1],'base64'));
    console.log(JSON.stringify({file,camera:r.pos.map(n=>+n.toFixed(3))}));
  }
}finally{
  await browser?.close();
  await server.close();
}
