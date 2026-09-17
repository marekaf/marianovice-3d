import assert from 'node:assert/strict';
import {createTerrainSampler} from './terrain-sampler.js';
const height=(x,z)=>Math.sin(x*1.3)*Math.cos(z*.7)+x*.01;
class FakeWorker{
  static made=[];
  constructor(url,behaviour=FakeWorker.behaviour){this.url=url;this.behaviour=behaviour;this.listeners={message:[],error:[]};this.terminated=false;FakeWorker.made.push(this);}
  addEventListener(type,listener){this.listeners[type].push(listener);}
  removeEventListener(type,listener){this.listeners[type]=this.listeners[type].filter(l=>l!==listener);}
  emit(type,data){for(const listener of [...this.listeners[type]])listener({data,message:data?.message});}
  terminate(){this.terminated=true;}
  postMessage(message){
    queueMicrotask(()=>{
      if(message.type==='init')return this.behaviour==='broken'?this.emit('message',{type:'error',message:'no scripts'}):this.emit('message',{type:'ready'});
      const heights=new Float64Array(message.xs.length);
      for(let i=0;i<heights.length;i++)heights[i]=height(message.xs[i],message.zs[i])+(this.behaviour==='drift'?1e-12:0);
      this.emit('message',{type:'heights',id:message.id,heights});
    });
  }
}
const xs=Float64Array.from({length:1001},(_,i)=>i*.037-3),zs=Float64Array.from({length:1001},(_,i)=>Math.sqrt(i)*.5);
const expected=Float64Array.from(xs,(x,i)=>height(x,zs[i]));
FakeWorker.behaviour='ok';
const pool=createTerrainSampler({height,workerUrl:'terrain-worker.js',scripts:['a.js'],threads:3,Worker:FakeWorker});
assert.equal(await pool.mode,'workers');
assert.equal(FakeWorker.made.length,3);
assert.deepEqual(await pool.sample(xs,zs),expected,'Chunks reassemble in point order');
assert.deepEqual(await pool.sample(xs.subarray(0,2),zs.subarray(0,2)),expected.subarray(0,2),'Batches shorter than the pool still work');
assert.deepEqual(await pool.sample(new Float64Array(0),new Float64Array(0)),new Float64Array(0));
pool.dispose();assert(FakeWorker.made.every(worker=>worker.terminated),'Dispose stops every worker');
FakeWorker.made.length=0;FakeWorker.behaviour='drift';
const drifting=createTerrainSampler({height,workerUrl:'terrain-worker.js',scripts:['a.js'],threads:2,Worker:FakeWorker});
assert.equal(await drifting.mode,'main','Workers that disagree with the page are dropped');
assert(FakeWorker.made.every(worker=>worker.terminated));
assert.deepEqual(await drifting.sample(xs,zs),expected,'Fallback samples inline');
FakeWorker.made.length=0;FakeWorker.behaviour='broken';
const broken=createTerrainSampler({height,workerUrl:'terrain-worker.js',scripts:['a.js'],threads:2,Worker:FakeWorker});
assert.equal(await broken.mode,'main','Workers that fail to load are dropped');
assert.deepEqual(await broken.sample(xs,zs),expected);
const none=createTerrainSampler({height,workerUrl:'terrain-worker.js',scripts:['a.js'],threads:0,Worker:FakeWorker});
assert.equal(await none.mode,'main');
assert.deepEqual(await none.sample(xs,zs),expected);
console.log(JSON.stringify({terrainSamplerModes:['workers','main']}));
