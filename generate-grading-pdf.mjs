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
  const stem=basename(pdf,'.pdf'),viewIds=['top','north','east','south','west'],imageName=id=>stem+'-model'+(id==='top'?'':'-'+id)+'.png';
  const names=[basename(pdf),stem+'.html',stem+'-export.json',...viewIds.map(imageName)];
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
    const captures=[];
    for(const id of viewIds)captures.push(await model.evaluate(async id=>{
      await document.fonts.ready;
      await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));
      window.setPreset('top');
      await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
      const {camera,controls,renderer,scene}=window.gradingPdfCapture;
      scene.fog=null;
      controls.enableDamping=false;
      const {plot,fenceBounds}=window.gradingPdfCapture,margin=1,heightRange=[Math.min(0,fenceBounds.min.y),Math.max(8,fenceBounds.max.y)];
      const corners=plot.flatMap(([x,z])=>[-margin,margin].flatMap(dx=>[-margin,margin].flatMap(dz=>heightRange.map(y=>camera.position.clone().set(x+dx,y,z+dz)))));
      if(id!=='top'){
        const xs=plot.map(p=>p[0]),zs=plot.map(p=>p[1]);
        controls.target.set((Math.min(...xs)+Math.max(...xs))/2,(heightRange[0]+heightRange[1])/2,(Math.min(...zs)+Math.max(...zs))/2);
        const direction={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]}[id];
        let distance=30,fitted=false;
        for(let attempt=0;attempt<100;attempt++,distance*=1.05){
          camera.position.set(controls.target.x+direction[0]*distance,controls.target.y+distance*Math.tan(Math.PI/6),controls.target.z+direction[1]*distance);
          controls.update();camera.updateMatrixWorld();
          if(corners.every(point=>{const p=point.clone().project(camera);return Math.abs(p.x)<.94&&Math.abs(p.y)<.94&&p.z<1;})){fitted=true;break;}
        }
        if(!fitted)throw new Error('Cannot fit the full plot for '+id);
      }
      controls.update();camera.updateMatrixWorld();
      renderer.render(scene,camera);
      const canvas=renderer.domElement,probe=document.createElement('canvas');probe.width=64;probe.height=44;
      const context=probe.getContext('2d');context.drawImage(canvas,0,0,64,44);
      const pixels=context.getImageData(0,0,64,44).data,colors=new Set();
      for(let i=0;i<pixels.length;i+=4)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
      if(colors.size<100)throw new Error('Model capture is blank or incomplete');
      const points=corners.map(point=>point.clone().project(camera));
      const xs=points.map(p=>(p.x+1)*canvas.width/2),ys=points.map(p=>(1-p.y)*canvas.height/2);
      const left=Math.floor(Math.min(...xs)),top=Math.floor(Math.min(...ys)),right=Math.ceil(Math.max(...xs)),bottom=Math.ceil(Math.max(...ys));
      if(left<0||top<0||right>canvas.width||bottom>canvas.height)throw new Error('Plot capture extends outside the '+id+' canvas');
      const crop=document.createElement('canvas'),scale=id==='top'?1:Math.min(1,3000/Math.max(right-left,bottom-top));
      crop.width=Math.round((right-left)*scale);crop.height=Math.round((bottom-top)*scale);
      const cropContext=crop.getContext('2d');cropContext.imageSmoothingQuality='high';cropContext.drawImage(canvas,left,top,right-left,bottom-top,0,0,crop.width,crop.height);
      return {id,png:crop.toDataURL('image/png'),width:crop.width,height:crop.height,colors:colors.size,
        bounds:{left,top,width:right-left,height:bottom-top,outputScale:scale,marginMetres:margin,heightRange,canvas:[canvas.width,canvas.height]},
        camera:{position:camera.position.toArray(),target:controls.target.toArray(),type:camera.type}};
    },id));
    const capture=captures[0];
    assert(capture.camera.position.every((value,index)=>Math.abs(value-[22,90,17][index])<.001),'Camera must use the Top-down preset');assert(capture.camera.target.every((value,index)=>Math.abs(value-[22,0,17][index])<.001),'Camera must target the Top-down preset center');
    await model.close();
    const page=await browser.newPage({viewport:{width:1480,height:1100}});
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/grading.html?export=1');
    await page.locator('#report[data-revision]').waitFor();
    assert.equal(await page.locator('.sheet').count(),1,'Existing grading map must be one page');
    await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
    const first=page.locator('.sheet').first(),firstHTML=await first.evaluate(e=>e.outerHTML),before=await first.screenshot();
    const definitions=await page.evaluate(()=>GradingViews.definitions);
    assert.deepEqual(definitions.map(view=>view.id),viewIds,'Gallery must use the same five capture views');
    await page.evaluate(async captures=>{
      document.getElementById('report').insertAdjacentHTML('beforeend',GradingViews.render(captures.map(capture=>({...GradingViews.definitions.find(view=>view.id===capture.id),src:capture.png,width:capture.width,height:capture.height}))));
      await Promise.all([...document.querySelectorAll('.model-sheet img')].map(image=>image.decode()));
    },captures);
    assert.equal(await first.evaluate(e=>e.outerHTML),firstHTML,'First-page content must remain unchanged');
    assert(before.equals(await first.screenshot()),'First-page appearance must remain unchanged');
    const overflow=await page.locator('.sheet').evaluateAll(sheets=>sheets.map(e=>[e.scrollWidth-e.clientWidth,e.scrollHeight-e.clientHeight]));
    const pages=1+captures.length;
    assert.equal(overflow.length,pages);assert(overflow.every(pair=>pair.every(value=>value<=1)),`Print overflow: ${JSON.stringify(overflow)}`);
    assert.deepEqual(errors,[],'Every model/report resource must load');
    for(const [file,digest] of sources)assert.equal(hash(await readFile(file)),digest,'Source changed during PDF generation');
    await mkdir(dirname(pdf),{recursive:true});temporary=await mkdtemp(join(dirname(pdf),'.grading-pdf-'));
    const images=captures.map(capture=>({capture,bytes:Buffer.from(capture.png.split(',')[1],'base64')})),png=images[0].bytes;
    const standalone=await page.evaluate(()=>{
      const html=document.documentElement.cloneNode(true);
      html.querySelectorAll('script,nav').forEach(element=>element.remove());
      return '<!doctype html>\n'+html.outerHTML;
    });
    await page.locator('.model-sheet img').evaluateAll(async images=>{
      for(const image of images){
        const canvas=document.createElement('canvas');
        canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        canvas.getContext('2d').drawImage(image,0,0);
        image.src=canvas.toDataURL('image/jpeg',.9);
        await image.decode();
      }
    });
    const pdfBytes=await page.pdf({preferCSSPageSize:true,printBackground:true});
    assert(pdfBytes.length<20*1024*1024,'PDF must remain below 20 MiB for email');
    assert.equal((pdfBytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,pages,'Printed PDF must contain the map and five model views');
    assert.equal(hash(await readFile(exporterPath)),exporterHash,'Exporter changed during generation');
    const manifest={exporterHash,revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
      reportRevision:await page.locator('#report').getAttribute('data-revision'),pages,pageSize:'A3 landscape',fog:false,
      firstPageUnchanged:true,firstPageImageHash:hash(before),camera:capture.camera,captureBounds:capture.bounds,image:{width:capture.width,height:capture.height,sha256:hash(png)},pdfSha256:hash(pdfBytes),
      htmlSha256:hash(standalone),views:images.map(({capture,bytes})=>({id:capture.id,label:definitions.find(view=>view.id===capture.id).label,file:imageName(capture.id),width:capture.width,height:capture.height,sha256:hash(bytes),camera:capture.camera,captureBounds:capture.bounds})),
      sources:Object.fromEntries([...sources].map(([file,digest])=>[relative(root,file),digest]).sort(([a],[b])=>a.localeCompare(b)))};
    const artifacts=[[basename(pdf),pdfBytes],[stem+'.html',standalone],...images.map(({capture,bytes})=>[imageName(capture.id),bytes]),[stem+'-export.json',JSON.stringify(manifest,null,2)+'\n']];
    for(const [name,bytes] of artifacts)await writeFile(join(temporary,name),bytes);
    for(const [name] of artifacts)await rename(join(temporary,name),join(dirname(pdf),name));
    return {pdf,html:join(dirname(pdf),stem+'.html'),image:join(dirname(pdf),stem+'-model.png'),images:images.map(({capture})=>join(dirname(pdf),imageName(capture.id))),manifest:join(dirname(pdf),stem+'-export.json'),pages};
  }finally{
    await browser?.close();await new Promise(done=>server.close(done));if(temporary)await rm(temporary,{recursive:true,force:true});
  }
}

if(process.argv[1]&&await realpath(process.argv[1])===fileURLToPath(import.meta.url)){
  const {values}=parseArgs({options:{'source-root':{type:'string'},output:{type:'string'}},allowPositionals:false});
  console.log(JSON.stringify(await generateGradingPDF({sourceRoot:values['source-root'],output:values.output})));
}
