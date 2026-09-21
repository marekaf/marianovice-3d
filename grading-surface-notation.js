const GradingSurfaceNotation=(()=>{
  const excludedIds=new Set(['house','garage','carport','sauna','saunaShelter','greenhouse','eastTerrace','westTerrace','pergola','pond','driveway','heatPumpPad','heatPumpService']);
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
    const allowed=eligibility(garden),threshold=.08,cache=new Map(),strokes=[],shoulders=[];
    const height=(x,z)=>{const key=`${x.toFixed(5)},${z.toFixed(5)}`;if(!cache.has(key))cache.set(key,site.height(x,z));return cache.get(key);};
    const gradient=(x,z)=>{
      const h=height(x,z),d=.025;
      return [0,1].map(axis=>{
        const a=[x,z],b=[x,z];a[axis]-=d;b[axis]+=d;
        const aa=allowed(...a),bb=allowed(...b),span=(aa?d:0)+(bb?d:0);
        return span?((bb?height(...b):h)-(aa?height(...a):h))/span:0;
      });
    };
    const zone=p=>(quantities?.zones??[]).find(z=>z.polygons.some(poly=>inside(poly,...p)))?.id??'';
    const vertices=garden.plot.vertices,minX=Math.min(...vertices.map(p=>p[0])),minZ=Math.min(...vertices.map(p=>p[1]));
    const maxX=Math.max(...vertices.map(p=>p[0])),maxZ=Math.max(...vertices.map(p=>p[1]));
    const candidates=[],steep=[],crestReasons=new Map();
    function trace(start,sign,limit){
      const points=[start];let termination='limit';
      for(let distance=0;distance<limit;distance+=.05){
        const p=points.at(-1),g=gradient(...p),slope=Math.hypot(...g);
        if(slope<threshold*.85){termination='low-gradient';break;}
        const next=p.map((v,i)=>v+sign*g[i]/slope*.05),mid=p.map((v,i)=>(v+next[i])/2);
        if(!allowed(...next)||!allowed(...mid)){termination='boundary';break;}
        if(sign*(height(...next)-height(...p))<1e-6){termination='nonmonotonic';break;}
        if(sign>0&&Math.hypot(...gradient(...next))<threshold*.85){termination='low-gradient';break;}
        points.push(next);
      }
      return {points,termination};
    }
    for(let x=minX+.075;x<maxX;x+=.15)for(let z=minZ+.075;z<maxZ;z+=.15){
      if(!allowed(x,z))continue;
      const g=gradient(x,z),slope=Math.hypot(...g);
      if(slope<threshold)continue;
      const p=[x,z];steep.push(p);
      const uphill=p.map((v,i)=>v+g[i]/slope*.22);
      if(!allowed(...uphill)||Math.hypot(...gradient(...uphill))<threshold){
        const uphillTrace=trace(p,1,1),crest=uphillTrace.points.at(-1);
        crestReasons.set(crest,uphillTrace.termination);
        if(!candidates.some(q=>Math.hypot(q[0]-crest[0],q[1]-crest[1])<.38))candidates.push(crest);
      }
    }
    for(const zone of quantities?.zones??[])for(const polygon of zone.polygons)for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      for(let distance=.1;distance<length;distance+=.3)for(const offset of [-.04,.04]){
        const p=[a[0]+dx*distance/length-dz/length*offset,a[1]+dz*distance/length+dx/length*offset];
        if(allowed(...p)&&Math.hypot(...gradient(...p))>=threshold)steep.push(p);
      }
    }
    const occupied=new Map(),key=(x,z)=>`${Math.floor(x/.5)},${Math.floor(z/.5)}`;
    const nearby=(p,distance)=>{
      const radius=Math.ceil(distance/.5);
      for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)for(const q of occupied.get(key(p[0]+dx*.5,p[1]+dz*.5))??[])if(Math.hypot(p[0]-q[0],p[1]-q[1])<distance)return true;
      return false;
    };
    function add(crest,short,crestTermination='coverage'){
      if(nearby(crest,.27))return;
      const downhill=trace(crest,-1,10);let full=downhill.points;
      if(full.length<2)return;
      const toe=full.at(-1);
      const count=short?Math.max(3,Math.ceil(full.length*.43)):full.length;
      full=full.slice(0,count);
      const points=[];
      for(const p of full){if(nearby(p,.12))break;points.push(p);}
      if(points.length<2)return;
      const slope=Math.hypot(...gradient(...points[0]))*100;
      strokes.push({points,zone:zone(points[0]),slope,short,toe,crestTermination,toeTermination:downhill.termination});
      for(const p of points){const k=key(...p);if(!occupied.has(k))occupied.set(k,[]);occupied.get(k).push(p);}
    }
    let chain=[],last=null,index=0;
    while(candidates.length){
      let next=0;
      if(last)for(let i=1;i<candidates.length;i++)if(Math.hypot(candidates[i][0]-last[0],candidates[i][1]-last[1])<Math.hypot(candidates[next][0]-last[0],candidates[next][1]-last[1]))next=i;
      const crest=candidates.splice(next,1)[0];
      if(last&&Math.hypot(crest[0]-last[0],crest[1]-last[1])>1){if(chain.length>1)shoulders.push(chain);chain=[];index=0;}
      add(crest,index++%2===1,crestReasons.get(crest));chain.push(crest);last=crest;
    }
    if(chain.length>1)shoulders.push(chain);
    for(let i=0;i<steep.length;i+=3){const p=steep[i];if(!nearby(p,.7)){
      const uphillTrace=trace(p,1,10),crest=uphillTrace.points.at(-1);
      add(crest,false,uphillTrace.termination);
      if(!nearby(p,.7)){
        const uphill=trace(p,1,10).points,open=[];
        for(const q of uphill){if(nearby(q,.3))break;open.push(q);}
        if(open.length)add(open.at(-1),false);
      }
    }}
    const edges=[];
    for(let i=1;i<strokes.length;i++){
      const a=strokes[i-1],b=strokes[i],p=a.points[0],q=b.points[0],length=Math.hypot(p[0]-q[0],p[1]-q[1]);
      if(length>.8)continue;
      const g=gradient(...p),m=Math.hypot(...g);
      if(Math.abs((q[0]-p[0])*g[0]+(q[1]-p[1])*g[1])>length*m*.55)continue;
      for(const [kind,points] of [['crest',[p,q]],['toe',[a.toe,b.toe]]]){
        if(![a,b].every(s=>['low-gradient','boundary'].includes(s[`${kind}Termination`])))continue;
        if(Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1])>1.2)continue;
        if([0,.25,.5,.75,1].every(t=>allowed(...points[0].map((v,j)=>v+(points[1][j]-v)*t))))edges.push({kind,points});
      }
    }
    return {contours:[],strokes,shoulders,edges,datum,bankThreshold:threshold*100,contourInterval:null,majorInterval:null,gridStep:.15};
  }
  function svg({surface,px,pz}){
    const path=points=>points.map((p,i)=>`${i?'L':'M'}${px(p[0]).toFixed(3)} ${pz(p[1]).toFixed(3)}`).join('');
    const safe=value=>String(value).replace(/[^a-zA-Z0-9_.-]/g,'');
    return `<g data-bank-hachure="terrain" fill="none" stroke="#68635c" stroke-linecap="butt" stroke-width=".55">${(surface.edges??[]).map(e=>`<path data-bank-edge="${e.kind}" d="${path(e.points)}" stroke-width=".4"/>`).join('')}${surface.strokes.map(s=>`<path data-surface-slope="${safe(s.zone)}" data-bank-length="${s.short?'short':'long'}" data-slope="${s.slope.toFixed(2)}" d="${path(s.points)}"/>`).join('')}</g>`;
  }
  return {create,svg,eligible};
})();
if(typeof module!=='undefined')module.exports={GradingSurfaceNotation};
