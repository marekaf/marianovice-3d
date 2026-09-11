const BoundaryFenceModel=(()=>{
  function build({garden,survey,heightAt}){
    const Fence=typeof module!=='undefined'?require('./fence-model.js').FenceModel:FenceModel;
    const Gate=typeof module!=='undefined'?require('./gate-model.js').GateModel:GateModel;
    const line=garden.elements.find(e=>e.id==='gate').parts.find(p=>p.kind==='line');
    const start=[line.x1,line.y1],end=[line.x2,line.y2],length=Math.hypot(end[0]-start[0],end[1]-start[1]);
    const direction=[(end[0]-start[0])/length,(end[1]-start[1])/length],normal=[-direction[1],direction[0]];
    const project=p=>[(p[0]-start[0])*direction[0]+(p[1]-start[1])*direction[1],(p[0]-start[0])*normal[0]+(p[1]-start[1])*normal[1]];
    const plot=garden.plot.vertices;
    const distance=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
    const gateEdge=plot.map((a,i)=>({i,d:distance([(start[0]+end[0])/2,(start[1]+end[1])/2],a,plot[(i+1)%plot.length])})).sort((a,b)=>a.d-b.d)[0].i;
    const fixedPanelLength=Math.hypot(start[0]-plot[gateEdge][0],start[1]-plot[gateEdge][1])-.28;
    const gateModel=Gate.build({openingStart:start,direction,fixedPanelLength,floorHeight:heightAt((start[0]+end[0])/2,(start[1]+end[1])/2),open:1,wicketOpen:1});
    const measured=survey?.segments??[];
    const segments=measured.length?measured.map(s=>({...s,measured:true})):plot.map((p,i)=>({start:p,end:plot[(i+1)%plot.length],measured:false}));
    if(measured.length){
      const south=plot.map((a,i)=>({start:a,end:plot[(i+1)%plot.length]})).sort((a,b)=>(b.start[1]+b.end[1])-(a.start[1]+a.end[1]))[0];
      const southLength=Math.hypot(south.end[0]-south.start[0],south.end[1]-south.start[1]);
      segments.push({start:south.start.map((v,i)=>v+(south.end[i]-v)*.6/southLength),end:south.end,measured:false});
      const endpoint=measured.at(-1).end;
      const nearest=distance(endpoint,south.start,south.end)<.001?null:[south.start,south.end].sort((a,b)=>Math.hypot(a[0]-endpoint[0],a[1]-endpoint[1])-Math.hypot(b[0]-endpoint[0],b[1]-endpoint[1]))[0];
      if(nearest)segments.push({start:endpoint,end:nearest,measured:false});
      segments.push({start:measured[0].start,end:gateModel.dims.fixedPanelStart.slice(0,2),measured:false});
      const afterWicket=start.map((v,i)=>v+direction[i]*5.35);
      segments.push({start:afterWicket,end:plot[(gateEdge+1)%plot.length],measured:false});
    }
    const cutFrom=-fixedPanelLength-.14,cutTo=5.35;
    function outsideEntrance(segment){
      const a=project(segment.start),b=project(segment.end),d=[b[0]-a[0],b[1]-a[1]];
      let lo=0,hi=1;
      for(const [axis,min,max] of [[0,cutFrom,cutTo],[1,-1,1]]){
        if(Math.abs(d[axis])<1e-12){if(a[axis]<min||a[axis]>max)return[segment];continue;}
        const t0=(min-a[axis])/d[axis],t1=(max-a[axis])/d[axis];lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
      }
      if(lo>=hi)return[segment];
      const at=t=>segment.start.map((v,i)=>v+(segment.end[i]-v)*t);
      return [[0,lo],[hi,1]].filter(([a,b])=>b-a>1e-8).map(([a,b])=>({...segment,start:at(a),end:at(b)}));
    }
    const visible=segments.flatMap(outsideEntrance).filter(s=>Math.hypot(s.end[0]-s.start[0],s.end[1]-s.start[1])>.001),seen=new Set();
    const key=p=>p.map(v=>v.toFixed(7)).join(',');
    const models=visible.map((segment,i)=>{
      const startPost=!seen.has(key(segment.start)),endPost=!seen.has(key(segment.end));seen.add(key(segment.start));seen.add(key(segment.end));
      const model=Fence.build({start:segment.start,end:segment.end,heightAt,startPost,endPost});
      model.name=`boundary-fence-${i}`;model.notes.push(segment.measured?'Surveyed fence alignment; nominal 2 m top above existing ground.':'Unmeasured boundary closure; nominal 2 m fence above existing ground.');
      return model;
    });
    return {models,segments:visible,gateModel,nominalHeight:2,measured:measured.length>0};
  }
  return {build};
})();
if(typeof module!=='undefined')module.exports={BoundaryFenceModel};
