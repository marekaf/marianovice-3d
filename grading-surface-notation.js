const GradingSurfaceNotation=(()=>{
  const excludedIds=new Set(['house','garage','carport','sauna','saunaShelter','saunaPath','greenhouse','eastTerrace','westTerrace','pergola','pond','driveway','heatPumpPad','heatPumpService']);
  function inside(points,x,z){
    let result=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i],b=points[j];
      if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;
    }
    return result;
  }
  function contains(p,x,z){
    if(p.kind==='rect')return x>=p.x&&x<=p.x+p.w&&z>=p.y&&z<=p.y+p.d;
    if(p.kind==='polygon')return inside(p.points,x,z);
    if(p.kind==='ellipse')return ((x-p.cx)/p.rx)**2+((z-p.cy)/p.ry)**2<=1;
    if(p.kind==='circle')return Math.hypot(x-p.cx,z-p.cy)<=p.r;
    return false;
  }
  function eligibility(garden){
    const shapes=(garden.elements??[]).filter(e=>excludedIds.has(e.id)||/^raisedBed\d+$/.test(e.id)).flatMap(e=>e.parts??[]);
    return (x,z)=>inside(garden.plot.vertices,x,z)&&!shapes.some(p=>contains(p,x,z));
  }
  function eligible(garden,x,z){return eligibility(garden)(x,z);}
  function create({garden,site,quantities,datum=0}){
    const allowed=eligibility(garden),spec=site.spec??{},regions=[],strokes=[],edges=[],step=.5;
    const rect=p=>p&&Number.isFinite(p.x0)?[[p.x0,p.z0],[p.x1,p.z0],[p.x1,p.z1],[p.x0,p.z1]]:null;
    const element=id=>(garden.elements??[]).find(e=>e.id===id);
    const parts=id=>(element(id)?.parts??[]).filter(p=>p.kind==='rect'||p.kind==='polygon');
    const polygon=p=>p.kind==='polygon'?p.points:[[p.x,p.y],[p.x+p.w,p.y],[p.x+p.w,p.y+p.d],[p.x,p.y+p.d]];
    const routes=spec.routeProfiles??[];
    const distance=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
    const open=p=>allowed(...p)&&![spec.gateRunback,spec.wicketLanding].some(pad=>pad?.points&&inside(pad.points,...p))&&!routes.some(r=>r.points.slice(1).some((b,i)=>distance(p,r.points[i],b)<r.width/2-.01));
    const addEdge=(id,source,a,b,normal,width,explicit=false)=>{
      if(Math.hypot(b[0]-a[0],b[1]-a[1])<.2)return;
      const points=[a,b,b.map((v,i)=>v+normal[i]*width),a.map((v,i)=>v+normal[i]*width)];
      regions.push({id,source,points,normal,explicit,width});
    };
    const addPolygon=(id,source,points,width,explicit=false)=>{
      if(!points)return;
      const area=points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0);
      for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length)addEdge(id+'-'+i,source,a,b,area>0?[dz/length,-dx/length]:[-dz/length,dx/length],width,explicit);}
    };
    for(const bank of garden.gradingBanks??[]){
      const v=bank.spotFoot.map((n,i)=>n-bank.spotCrest[i]),length=Math.hypot(...v);
      regions.push({id:'boundary-'+bank.id,source:'gradingBanks.'+bank.id,points:bank.points,normal:v.map(n=>n/length),explicit:true,width:bank.width});
    }
    const pads=spec.protectedPads??[];
    for(const id of ['raisedBedsPad','greenhouse','sauna','saunaShelter','saunaPath'])for(const p of parts(id))addPolygon(id,id,polygon(p),id==='raisedBedsPad'?4:3);
    for(let i=0;i<(spec.drainageStrips??[]).length;i++)addPolygon('drainage-'+i,'drainageStrips',rect(spec.drainageStrips[i]),5);
    for(const id of ['south-facade','north-facade']){const p=pads.find(p=>p.id===id);if(p)addPolygon(id,id,rect(p),3);}
    for(const p of parts('heatPumpService'))addPolygon('service','heatPumpService',polygon(p),1.2);
    for(const p of parts('eastTerrace'))addPolygon('terrace','eastTerrace',polygon(p),1.05,true);
    const pergola=spec.gatheringPads?.find(p=>Number.isFinite(p.x0));
    if(pergola){
      addEdge('pergola-north','pergola',[pergola.x0,pergola.z0],[pergola.x1,pergola.z0],[0,-1],4,true);
      const p=rect(pergola);for(let i=1;i<4;i++){const a=p[i],b=p[(i+1)%4],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);addEdge('pergola-'+i,'pergola',a,b,[dz/l,-dx/l],2.5);}
    }
    const driveway=spec.drivewayProfile;
    if(driveway?.points)addPolygon('driveway','drivewayProfile',driveway.points,3);
    if(spec.drivewayApron)addPolygon('east-apron','drivewayApron',rect(spec.drivewayApron),2.5);
    if(spec.benchPad)addPolygon('bench','benchPad',rect(spec.benchPad),spec.benchPad.blend??.8);
    for(const id of ['gateRunback','wicketLanding'])if(spec[id]?.points)addPolygon(id,id,spec[id].points,spec[id].blend??.4);
    const fire=spec.gatheringPads?.find(p=>Number.isFinite(p.radius));
    if(fire){const p=Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return[fire.cx+Math.cos(a)*fire.radius,fire.cz+Math.sin(a)*fire.radius];});addPolygon('firepit','firePit',p,1.5);}
    for(const route of routes)for(let i=1;i<route.points.length;i++){
      const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<.4)continue;
      for(const side of [-1,1]){const normal=[-dz/length*side,dx/length*side],offset=p=>p.map((v,k)=>v+normal[k]*(route.width/2+.02));addEdge('route-'+route.id+'-'+i+'-'+side,route.id,offset(a),offset(b),normal,Math.min(1.8,route.bankBlend??1.2));}
    }
    const zone=p=>(quantities?.zones??[]).find(z=>z.polygons.some(poly=>inside(poly,...p)))?.id??'';
    const painted=[];
    const h=p=>site.height(...p),modified=p=>site.baseHeight?Math.abs(h(p)-site.baseHeight(...p))>.06:false;
    for(const region of regions){
      const n=region.normal,t=[-n[1],n[0]],dot=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const p=region.points.map(p=>[dot(p,t),dot(p,n)]),lo=Math.min(...p.map(p=>p[0])),hi=Math.max(...p.map(p=>p[0]));
      const count=Math.max(1,Math.floor((hi-lo)/step)),spacing=(hi-lo)/count;
      region.spacing=spacing;region.strokeCount=0;const sections=[],regionStrokes=[];
      for(let station=0;station<count;station++){
        const u=lo+(station+.5)*spacing,crossings=[];
        for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a[0]<=u&&b[0]>u)||(b[0]<=u&&a[0]>u))crossings.push(a[1]+(u-a[0])/(b[0]-a[0])*(b[1]-a[1]));}
        crossings.sort((a,b)=>a-b);if(crossings.length<2)continue;
        const start=crossings[0];let end=crossings.at(-1);const samples=[];
        if(region.id==='pergola-north'){
          const origin=[t[0]*u+n[0]*start,t[1]*u+n[1]*start];
          for(const fence of spec.fixedFences?.segments??[]){
            const a=fence.start,b=fence.end,d=[b[0]-a[0],b[1]-a[1]],cross=n[0]*d[1]-n[1]*d[0];
            if(Math.abs(cross)<1e-8)continue;
            const delta=[a[0]-origin[0],a[1]-origin[1]],distance=(delta[0]*d[1]-delta[1]*d[0])/cross,fraction=(delta[0]*n[1]-delta[1]*n[0])/cross;
            if(distance>0&&fraction>=0&&fraction<=1)end=Math.min(end,start+distance);
          }
        }
        const first=[t[0]*u+n[0]*(start+.03),t[1]*u+n[1]*(start+.03)];
        if(!region.explicit&&!open(first))continue;
        for(let sample=0;sample<Math.floor((end-start-.03+1e-8)/.05);sample++){const v=start+.03+sample*.05,point=[t[0]*u+n[0]*v,t[1]*u+n[1]*v];samples.push({point,height:h(point),valid:open(point)&&!painted.some(poly=>inside(poly,...point)),changed:region.explicit||modified(point),v});}
        let best=null,run=[];
        const flush=()=>{if(run.length>2&&Math.abs(run.at(-1).height-run[0].height)>=.08&&run.some(s=>s.changed)&&(!best||run.length>best.length))best=run;run=[];};
        for(let i=0;i<samples.length;i++){
          const s=samples[i];if(!s.valid){flush();continue;}
          if(run.length){
            const diff=s.height-run.at(-1).height,sign=Math.sign(run.at(-1).height-run[0].height);
            if((Math.abs(diff)<.002&&run.length>3)||sign&&diff*sign<-.002||!s.changed&&!region.explicit){flush();}
          }
          run.push(s);
        }flush();if(!best)continue;
        const rising=best.at(-1).height>best[0].height,crest=rising?best.at(-1):best[0],toe=rising?best[0]:best.at(-1);
        if(Math.hypot(crest.point[0]-toe.point[0],crest.point[1]-toe.point[1])<.3)continue;
        const fraction=station%2?.43:.96,finish=crest.point.map((v,k)=>v+(toe.point[k]-v)*fraction);
        const check=Array.from({length:21},(_,i)=>h(crest.point.map((v,k)=>v+(finish[k]-v)*i/20)));
        if(check.some((v,i)=>i&&v>Math.min(...check.slice(0,i))+.02))continue;
        const points=[crest.point,finish],length=Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1]);
        regionStrokes.push({points,zone:zone(crest.point),source:region.source,region:region.id,station,short:station%2===1,slope:(crest.height-toe.height)/Math.hypot(crest.point[0]-toe.point[0],crest.point[1]-toe.point[1])*100});
        region.strokeCount++;
        const crestSupported=crest.v>start+.09&&crest.v<end-.09||region.explicit;
        const toeSupported=toe.v>start+.09&&toe.v<end-.09||region.explicit;
        sections.push({station,crest:crest.point,toe:toe.point,crestSupported,toeSupported,length});
      }
      const coherent=new Set();let group=[];
      const accept=()=>{if(group.length>=3)for(const station of group)coherent.add(station);group=[];};
      for(const section of sections){if(group.length&&section.station!==group.at(-1)+1)accept();group.push(section.station);}accept();
      if(region.source==='firePit')for(const section of sections)coherent.add(section.station);
      region.strokeCount=coherent.size;
      if(!coherent.size)continue;
      strokes.push(...regionStrokes.filter(s=>coherent.has(s.station)));
      for(let i=1;i<sections.length;i++){const a=sections[i-1],b=sections[i];if(b.station-a.station!==1)continue;
        if(!coherent.has(a.station)||!coherent.has(b.station))continue;
        painted.push([a.crest,b.crest,b.toe,a.toe]);
        for(const kind of ['crest','toe'])if(a[kind+'Supported']&&b[kind+'Supported']){
          const delta=Math.abs(dot(a[kind],n)-dot(b[kind],n));
          if(delta>.3)continue;
          const points=[a[kind],b[kind]];
          if([0,.25,.5,.75,1].every(f=>open(points[0].map((v,k)=>v+(points[1][k]-v)*f))))edges.push({kind,points,region:region.id});
        }
      }
    }
    const fireStrokes=strokes.filter(s=>s.source==='firePit');
    if(fireStrokes.length<3){for(let i=strokes.length-1;i>=0;i--)if(strokes[i].source==='firePit')strokes.splice(i,1);for(const region of regions)if(region.source==='firePit')region.strokeCount=0;}
    return {contours:[],strokes,edges,regions,datum,contourInterval:null,majorInterval:null,gridStep:step};
  }
  function svg({surface,px,pz}){
    const path=points=>points.map((p,i)=>(i?'L':'M')+px(p[0]).toFixed(3)+' '+pz(p[1]).toFixed(3)).join('');
    const safe=value=>String(value).replace(/[^a-zA-Z0-9_.-]/g,'');
    return '<g data-bank-hachure="terrain" fill="none" stroke="#68635c" stroke-linecap="butt" stroke-width=".55">'+surface.edges.map(e=>'<path data-bank-edge="'+e.kind+'" d="'+path(e.points)+'" stroke-width=".4"/>').join('')+surface.strokes.map(s=>'<path data-surface-slope="'+safe(s.zone)+'" data-bank-region="'+safe(s.region)+'" data-bank-length="'+(s.short?'short':'long')+'" d="'+path(s.points)+'"/>').join('')+'</g>';
  }
  return {create,svg,eligible};
})();
if(typeof module!=='undefined')module.exports={GradingSurfaceNotation};
