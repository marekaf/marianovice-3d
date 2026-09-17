// Samples the terrain height field for large point batches on worker threads. Before any batch is
// trusted to the workers, each one must reproduce the main thread's heights bit for bit; otherwise
// every batch is sampled inline, so callers always get the main thread's numbers.
// Script names the worker needs, in load order, without the extension so they do not read as
// runtime asset references. The page resolves them to the versioned URLs it loaded itself.
export const TERRAIN_WORKER_SCRIPTS=['terrain','layout','survey-surface','hidden-bench-model','site-terrain','privacy-screen-model','garage-model','pergola-model','greenhouse-model','raised-beds-model','grading-site','survey-terrain','fence-survey'];

// `fields` maps a field name to its page-thread function; the worker resolves the same names itself.
export function createTerrainSampler({height,routeHeight,workerUrl,scripts=[],threads,Worker=globalThis.Worker}) {
  const fields={height,route:routeHeight??height};
  const inline=(xs,zs,field='height')=>{const fn=fields[field],heights=new Float64Array(xs.length);for(let i=0;i<xs.length;i++)heights[i]=fn(xs[i],zs[i]);return heights;};
  const count=threads??Math.min(8,Math.max(0,(globalThis.navigator?.hardwareConcurrency??1)-1));
  const workers=[];
  const dispose=()=>{for(const worker of workers)worker.terminate();workers.length=0;};
  const main={sample:async(xs,zs)=>inline(xs,zs),sampleRoute:async(xs,zs)=>inline(xs,zs,'route'),mode:Promise.resolve('main'),dispose};
  if(!(count>0)||typeof Worker!=='function'||!scripts.length)return main;
  let next=0;
  function request(worker,xs,zs,field='height'){
    return new Promise((resolve,reject)=>{
      const id=next++;
      const listener=({data})=>{if(data?.id!==id)return;worker.removeEventListener('message',listener);resolve(data.heights);};
      worker.addEventListener('message',listener);
      worker.addEventListener('error',event=>reject(new Error(event.message||'terrain worker failed')),{once:true});
      worker.postMessage({type:'sample',id,xs,zs,field},[xs.buffer,zs.buffer]);
    });
  }
  const check=(()=>{const xs=[],zs=[];for(let i=0;i<12;i++)for(let j=0;j<12;j++){xs.push(-6+i*5.3);zs.push(-4+j*4.1);}return {xs:Float64Array.from(xs),zs:Float64Array.from(zs)};})();
  const same=(a,b)=>{if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i]&&!(Number.isNaN(a[i])&&Number.isNaN(b[i])))return false;return true;};
  const mode=(async()=>{
    try{
      for(let i=0;i<count;i++)workers.push(new Worker(workerUrl));
      await Promise.all(workers.map(worker=>new Promise((resolve,reject)=>{
        worker.addEventListener('message',({data})=>data?.type==='ready'?resolve():reject(new Error(data?.message)),{once:true});
        worker.addEventListener('error',event=>reject(new Error(event.message||'terrain worker failed')),{once:true});
        worker.postMessage({type:'init',scripts});
      })));
      for(const field of ['height','route']){
        const expected=inline(check.xs,check.zs,field);
        const results=await Promise.all(workers.map(worker=>request(worker,check.xs.slice(),check.zs.slice(),field)));
        if(!results.every(result=>same(result,expected)))throw new Error('terrain worker heights differ from the page');
      }
      return 'workers';
    }catch{dispose();return 'main';}
  })();
  async function sample(xs,zs,field='height'){
    if(await mode!=='workers')return inline(xs,zs,field);
    const chunk=Math.ceil(xs.length/workers.length),heights=new Float64Array(xs.length);
    const parts=await Promise.all(workers.map((worker,k)=>{
      const start=Math.min(xs.length,k*chunk),end=Math.min(xs.length,start+chunk);
      return end>start?request(worker,Float64Array.from(xs.subarray(start,end)),Float64Array.from(zs.subarray(start,end)),field):null;
    }));
    parts.forEach((part,k)=>{if(part)heights.set(part,Math.min(xs.length,k*chunk));});
    return heights;
  }
  return {sample:(xs,zs)=>sample(xs,zs,'height'),sampleRoute:(xs,zs)=>sample(xs,zs,'route'),mode,dispose};
}
