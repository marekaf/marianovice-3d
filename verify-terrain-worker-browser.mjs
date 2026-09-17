import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('.',import.meta.url));
let threads=null;
const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://localhost').pathname;
  let data=await readFile(resolve(root,'.'+path));
  if(path==='/index.html'){
    data=data.toString().replace('terrainSampler.dispose();','window.terrainCheck={mode:await terrainSampler.mode};terrainSampler.dispose();').replace('scene.add(ground);','scene.add(ground);window.terrainCheck.ground=ground;');
    if(threads!==null)data=data.replace('createTerrainSampler({','createTerrainSampler({threads:'+threads+',');
  }
  if(['.html','.js','.mjs'].includes(extname(path)))data=data.toString().replaceAll('https://unpkg.com/three@0.186.0/','/node_modules/three/');
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'}[extname(path)]||'application/octet-stream'}).end(data);
}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  async function load(){
    const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.locator('#viewerLoading').waitFor({state:'detached',timeout:240000});
    const result=await page.evaluate(()=>{
      const digest=array=>{const words=array instanceof Float32Array?new Uint32Array(array.buffer):array;let hash=2166136261;for(let i=0;i<words.length;i++){hash^=words[i];hash=Math.imul(hash,16777619)>>>0;}return hash;};
      const geometry=terrainCheck.ground.geometry;
      return {mode:terrainCheck.mode,triangles:geometry.index.count/3,digest:['position','uv','normal'].map(name=>digest(geometry.attributes[name].array)).concat(digest(geometry.index.array))};
    });
    assert.deepEqual(errors,[],'Viewer loads without page errors');
    await page.close();return result;
  }
  const pooled=await load();
  assert.equal(pooled.mode,'workers','The viewer samples the terrain on worker threads');
  threads=0;
  const inline=await load();
  assert.equal(inline.mode,'main');
  assert.deepEqual(pooled.digest,inline.digest,'Worker-sampled ground is identical to the ground sampled on the page thread');
  console.log(JSON.stringify({groundTriangles:pooled.triangles,modes:[pooled.mode,inline.mode]}));
}finally{await browser?.close();server.close();}
