import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {extname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSite} from './scripts/build-site.mjs';
import {threePackage,threeVendorDir} from './three-import-map.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');

const mount='/preview/';
const pages=['fixtures.html','docs/offices.html'];
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};

// Serves the directory under the mount only, so a root-absolute URL in a page gets a 404.
async function serve(directory){
  const server=createServer(async(req,res)=>{try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!path.startsWith(mount))throw new Error('outside the mount');
    const file=resolve(directory,path.slice(mount.length));
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'}).end(await readFile(file));
  }catch{res.writeHead(404).end();}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  return server;
}

const site=mkdtempSync(join(tmpdir(),'marianovice-subpath-'));
let browser;
try{
  buildSite(site);
  browser=await chromium.launch({channel:'chrome',headless:true});
  const roots=[
    {name:'repository',directory:fileURLToPath(new URL('.',import.meta.url)),three:threePackage},
    {name:'built site',directory:site,three:threeVendorDir},
  ];
  for(const {name,directory,three} of roots){
    const server=await serve(directory),origin=`http://127.0.0.1:${server.address().port}`;
    try{
      for(const path of pages){
        const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[],failed=[],loaded=[];
        page.on('pageerror',error=>errors.push(error.message));
        page.on('response',response=>{
          const url=response.url().slice(origin.length);
          if(response.status()>=400&&url!=='/favicon.ico')failed.push(`${response.status()} ${url}`);
          else if(url.startsWith(mount+three))loaded.push(url.slice((mount+three).length));
        });
        await page.goto(origin+mount+path);
        await page.waitForFunction(()=>{
          const canvas=document.querySelector('canvas');
          return canvas&&canvas.width>0&&(canvas.getContext('webgl2')||canvas.getContext('webgl'));
        },null,{timeout:120000}).catch(()=>{});
        await page.waitForLoadState('networkidle');
        const label=`${path} from the ${name} under ${mount}`;
        assert.deepEqual(failed,[],`${label} requests no missing file`);
        assert.deepEqual(errors,[],`${label} raises no page error`);
        for(const file of ['build/three.module.js','build/three.core.js'])assert.equal(loaded.filter(url=>url===file).length,1,`${label} loads ${file} once`);
        assert.equal(await page.evaluate(()=>{
          const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
          return Boolean(gl)&&!gl.isContextLost();
        }),true,`${label} holds a WebGL canvas`);
        await page.close();
      }
    }finally{await new Promise(done=>server.close(done));}
  }
  console.log(`three loads under ${mount}: ${pages.join(', ')} from the repository and from the built site`);
}finally{
  await browser?.close();
  rmSync(site,{recursive:true,force:true});
}
