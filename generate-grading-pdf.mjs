import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,realpath,rename,rm} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute,extname,basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(root,file)=>{const p=relative(root,file);return p!==''&&!isAbsolute(p)&&p!=='..'&&!p.startsWith('../');};
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};

async function canonicalPath(file){
  try{return await realpath(file);}catch(error){if(error.code!=='ENOENT')throw error;return join(await canonicalPath(dirname(file)),basename(file));}
}

export async function generateGradingPDF({sourceRoot=fileURLToPath(new URL('.',import.meta.url)),output}={}) {
  const exporterPath=fileURLToPath(import.meta.url),exporterHash=hash(await readFile(exporterPath));
  const root=await realpath(sourceRoot),pdf=await canonicalPath(resolve(output||join(root,'docs/terrain-works.pdf')));
  assert.equal(extname(pdf).toLowerCase(),'.pdf','Output must be a PDF filename');
  const stem=basename(pdf,'.pdf'),names=[basename(pdf),stem+'-model.png',stem+'-export.json'];
  for(const name of names){const file=join(dirname(pdf),name);if(inside(root,file))execFileSync('git',['check-ignore','-q',file],{cwd:root});}
  const sources=new Map();
  async function input(pathname){
    const file=await realpath(resolve(root,'.'+pathname));
    assert(inside(root,file),'Export input must remain inside the selected source directory');
    const bytes=await readFile(file),digest=hash(bytes);
    if(sources.has(file))assert.equal(sources.get(file),digest,'Source changed during PDF generation');
    sources.set(file,digest);return bytes;
  }
  for(const pathname of ['/docs/survey-terrain.js','/docs/fence-survey.js','/index.html','/grading.html','/package.json','/yarn.lock'])await input(pathname);
  const dependency=JSON.parse(await input('/node_modules/three/package.json'));
  assert.equal(dependency.version,'0.160.0','Viewer requires its installed three version');
  const errors=[];
  const server=createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      let bytes=await input(pathname==='/'?'/index.html':pathname);
      if(pathname==='/index.html'){
        const marker='ViewerLoading.finish();',source=bytes.toString();
        assert.equal(source.split(marker).length,2,'Viewer completion hook must be unique');
        bytes=source.replace(marker,'window.gradingPdfCapture={camera,controls,renderer,scene,plot:GARDEN.plot.vertices,fenceBounds:new THREE.Box3().setFromObject(fenceGroup)};'+marker);
      }
      if(['.html','.js','.mjs'].includes(extname(pathname)))bytes=bytes.toString().replaceAll('https://unpkg.com/three@0.160.0/','/node_modules/three/');
      res.writeHead(200,{'Content-Type':types[extname(pathname)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
    }catch(error){if(req.url!=='/favicon.ico')errors.push(`${req.url}: ${error.message}`);res.writeHead(404).end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  let browser,temporary;
  try{
    const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
    browser=await chromium.launch({channel:'chrome',headless:true});
    const origin=`http://127.0.0.1:${server.address().port}`;
    const model=await browser.newPage({viewport:{width:3200,height:2196},deviceScaleFactor:2});
    model.on('pageerror',error=>errors.push(error.message));
    await model.goto(origin+'/index.html#top',{waitUntil:'domcontentloaded'});
    await model.waitForFunction(()=>window.gradingPdfCapture&&!document.body.hasAttribute('aria-busy'),null,{timeout:180000});
    await model.waitForLoadState('networkidle');
    const capture=await model.evaluate(async()=>{
      await document.fonts.ready;
      await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));
      window.setPreset('top');
      await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
      const {camera,controls,renderer,scene}=window.gradingPdfCapture;
      renderer.render(scene,camera);
      const canvas=renderer.domElement,probe=document.createElement('canvas');probe.width=64;probe.height=44;
      const context=probe.getContext('2d');context.drawImage(canvas,0,0,64,44);
      const pixels=context.getImageData(0,0,64,44).data,colors=new Set();
      for(let i=0;i<pixels.length;i+=4)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
      if(colors.size<100)throw new Error('Model capture is blank or incomplete');
      const {plot,fenceBounds}=window.gradingPdfCapture,margin=1,heightRange=[Math.min(0,fenceBounds.min.y),Math.max(8,fenceBounds.max.y)];
      const points=plot.flatMap(([x,z])=>[-margin,margin].flatMap(dx=>[-margin,margin].flatMap(dz=>heightRange.map(y=>camera.position.clone().set(x+dx,y,z+dz).project(camera)))));
      const xs=points.map(p=>(p.x+1)*canvas.width/2),ys=points.map(p=>(1-p.y)*canvas.height/2);
      const left=Math.floor(Math.min(...xs)),top=Math.floor(Math.min(...ys)),right=Math.ceil(Math.max(...xs)),bottom=Math.ceil(Math.max(...ys));
      if(left<0||top<0||right>canvas.width||bottom>canvas.height)throw new Error('Plot capture extends outside the Top-down canvas');
      const crop=document.createElement('canvas');crop.width=right-left;crop.height=bottom-top;crop.getContext('2d').drawImage(canvas,left,top,crop.width,crop.height,0,0,crop.width,crop.height);
      return {png:crop.toDataURL('image/png'),width:crop.width,height:crop.height,colors:colors.size,
        bounds:{left,top,width:crop.width,height:crop.height,marginMetres:margin,heightRange,canvas:[canvas.width,canvas.height]},
        camera:{position:camera.position.toArray(),target:controls.target.toArray(),type:camera.type}};
    });
    assert(capture.camera.position.every((value,index)=>Math.abs(value-[22,90,17][index])<.001),'Camera must use the Top-down preset');assert(capture.camera.target.every((value,index)=>Math.abs(value-[22,0,17][index])<.001),'Camera must target the Top-down preset center');
    await model.close();
    const page=await browser.newPage({viewport:{width:1480,height:1100}});
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/grading.html');
    await page.locator('#report[data-revision]').waitFor();
    assert.equal(await page.locator('.sheet').count(),1,'Existing grading map must be one page');
    await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
    const first=page.locator('.sheet').first(),firstHTML=await first.evaluate(e=>e.outerHTML),before=await first.screenshot();
    await page.evaluate(async png=>{
      const style=document.createElement('style');style.textContent='.model-sheet{break-before:page;break-inside:avoid;display:flex;align-items:center;justify-content:center}.model-sheet img{display:block;max-width:100%;max-height:100%;object-fit:contain}';document.head.append(style);
      const sheet=document.createElement('section');sheet.className='sheet model-sheet';
      const image=document.createElement('img');image.alt='Model zahrady · pohled shora';image.src=png;sheet.append(image);document.getElementById('report').append(sheet);await image.decode();
    },capture.png);
    assert.equal(await first.evaluate(e=>e.outerHTML),firstHTML,'First-page content must remain unchanged');
    assert(before.equals(await first.screenshot()),'First-page appearance must remain unchanged');
    const overflow=await page.locator('.sheet').evaluateAll(sheets=>sheets.map(e=>[e.scrollWidth-e.clientWidth,e.scrollHeight-e.clientHeight]));
    assert.equal(overflow.length,2);assert(overflow.every(pair=>pair.every(value=>value<=1)),`Print overflow: ${JSON.stringify(overflow)}`);
    assert.deepEqual(errors,[],'Every model/report resource must load');
    for(const [file,digest] of sources)assert.equal(hash(await readFile(file)),digest,'Source changed during PDF generation');
    await mkdir(dirname(pdf),{recursive:true});temporary=await mkdtemp(join(dirname(pdf),'.grading-pdf-'));
    const png=Buffer.from(capture.png.split(',')[1],'base64');
    const pdfBytes=await page.pdf({preferCSSPageSize:true,printBackground:true});
    assert.equal((pdfBytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,2,'Printed PDF must contain exactly two pages');
    assert.equal(hash(await readFile(exporterPath)),exporterHash,'Exporter changed during generation');
    const manifest={exporterHash,revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
      reportRevision:await page.locator('#report').getAttribute('data-revision'),pages:2,pageSize:'A3 landscape',
      firstPageUnchanged:true,firstPageImageHash:hash(before),camera:capture.camera,captureBounds:capture.bounds,image:{width:capture.width,height:capture.height,sha256:hash(png)},pdfSha256:hash(pdfBytes),
      sources:Object.fromEntries([...sources].map(([file,digest])=>[relative(root,file),digest]).sort(([a],[b])=>a.localeCompare(b)))};
    const artifacts=[[basename(pdf),pdfBytes],[stem+'-model.png',png],[stem+'-export.json',JSON.stringify(manifest,null,2)+'\n']];
    for(const [name,bytes] of artifacts)await writeFile(join(temporary,name),bytes);
    for(const [name] of artifacts)await rename(join(temporary,name),join(dirname(pdf),name));
    return {pdf,image:join(dirname(pdf),stem+'-model.png'),manifest:join(dirname(pdf),stem+'-export.json'),pages:2};
  }finally{
    await browser?.close();await new Promise(done=>server.close(done));if(temporary)await rm(temporary,{recursive:true,force:true});
  }
}

if(process.argv[1]&&await realpath(process.argv[1])===fileURLToPath(import.meta.url)){
  const {values}=parseArgs({options:{'source-root':{type:'string'},output:{type:'string'}},allowPositionals:false});
  console.log(JSON.stringify(await generateGradingPDF({sourceRoot:values['source-root'],output:values.output})));
}
