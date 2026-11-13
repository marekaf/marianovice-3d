// browser-ci {"shard":"roof"}
import assert from 'node:assert/strict';
import {launchChrome,serveRepo} from './scripts/browser.mjs';
let threads=null;
const server=await serveRepo({rewrite(path,data){
  if(path==='/index.html'){
    data=data.toString().replace('terrainSampler.dispose();','Object.assign(window.terrainCheck??={},{mode:await terrainSampler.mode});terrainSampler.dispose();').replace('scene.add(ground);','scene.add(ground);Object.assign(window.terrainCheck??={},{ground});');
    if(threads!==null)data=data.replace('createTerrainSampler({','createTerrainSampler({threads:'+threads+',');
  }
  return data;
}});
let browser;
try{
  browser=await launchChrome();
  async function load(){
    const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${server.origin}/index.html`);
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
}finally{await browser?.close();await server.close();}
