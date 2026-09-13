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
    const measured=survey?.segments??[];
    let railOffset=.18;
    for(const segment of measured){
      const a=project(segment.start),b=project(segment.end),dx=b[0]-a[0],dy=b[1]-a[1],span=Math.hypot(dx,dy);
      if(Math.abs(dx)/span<.8||Math.min(Math.abs(a[1]),Math.abs(b[1]))>1)continue;
      const lo=Math.max(-5.64,Math.min(a[0],b[0])),hi=Math.min(4.04,Math.max(a[0],b[0]));
      if(lo>hi)continue;
      const fenceY=t=>a[1]+(t-a[0])*dy/dx;
      railOffset=Math.max(railOffset,Math.max(fenceY(lo),fenceY(hi))+.075*span/Math.abs(dx)+.04);
    }
    const gateModel=Gate.build({openingStart:start,direction,fixedPanelLength,railOffset,floorHeight:heightAt((start[0]+end[0])/2,(start[1]+end[1])/2),open:1,wicketOpen:1});
    const segments=measured.length?measured.map(s=>({...s,measured:true})):plot.map((p,i)=>({start:p,end:plot[(i+1)%plot.length],measured:false}));
    if(measured.length){
      const south=plot.map((a,i)=>({start:a,end:plot[(i+1)%plot.length]})).sort((a,b)=>(b.start[1]+b.end[1])-(a.start[1]+a.end[1]))[0];
      const southLength=Math.hypot(south.end[0]-south.start[0],south.end[1]-south.start[1]);
      const endpoint=measured.at(-1).end;
      segments.push({start:south.start.map((v,i)=>v+(south.end[i]-v)*.6/southLength),end:endpoint,measured:false});
      segments.push({start:measured[0].end,end:gateModel.dims.fixedPanelStart.slice(0,2),measured:false,gateJoin:true});
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
      const startPost=!seen.has(key(segment.start)),endPost=!segment.gateJoin&&!seen.has(key(segment.end));seen.add(key(segment.start));seen.add(key(segment.end));
      const topHeightAt=segment.gateJoin?((x,z)=>{
        const [a,b]=[segment.start,segment.end],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
        return (heightAt(...a)+2)*(1-t)+(gateModel.floorHeight+1.56)*t;
      }):undefined;
      const model=Fence.build({start:segment.start,end:segment.end,heightAt,startPost,endPost,topHeightAt});
      model.name=`boundary-fence-${i}`;model.notes.push(segment.measured?'Surveyed fence alignment; nominal 2 m top above existing ground.':segment.gateJoin?'Tapered infill joins the measured fence to the gate post.':'Unmeasured boundary closure; nominal 2 m fence above existing ground.');
      return model;
    });
    return {models,segments:visible,gateModel,nominalHeight:2,measured:measured.length>0};
  }
  return {build};
})();
if(typeof module!=='undefined')module.exports={BoundaryFenceModel};
