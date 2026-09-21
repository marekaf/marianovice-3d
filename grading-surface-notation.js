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
    const allowed=eligibility(garden),contours=[],strokes=[],cache=new Map();
    const height=(x,z)=>{const key=`${x.toFixed(5)},${z.toFixed(5)}`;if(!cache.has(key))cache.set(key,site.height(x,z));return cache.get(key);};
    const gradient=(x,z)=>{
      const h=height(x,z),d=.025;
      const derivative=(axis)=>{
        const a=[x,z],b=[x,z];a[axis]-=d;b[axis]+=d;
        const ha=allowed(...a)?height(...a):h,hb=allowed(...b)?height(...b):h;
        const span=(allowed(...a)?d:0)+(allowed(...b)?d:0);
        return span?(hb-ha)/span:0;
      };
      return [derivative(0),derivative(1)];
    };
    const zone=p=>(quantities?.zones??[]).find(z=>z.polygons.some(poly=>inside(poly,...p)))?.id??'';
    const vertices=garden.plot.vertices,minX=Math.floor(Math.min(...vertices.map(p=>p[0]))/.25)*.25,minZ=Math.floor(Math.min(...vertices.map(p=>p[1]))/.25)*.25;
    const maxX=Math.max(...vertices.map(p=>p[0])),maxZ=Math.max(...vertices.map(p=>p[1]));
    function clipped(a,b){
      const count=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.02));
      const pieces=[];let run=[];
      for(let i=0;i<=count;i++){
        const p=a.map((v,j)=>v+(b[j]-v)*i/count);
        if(allowed(...p))run.push(p);else{if(run.length>1)pieces.push([run[0],run.at(-1)]);run=[];}
      }
      if(run.length>1)pieces.push([run[0],run.at(-1)]);
      return pieces;
    }
    for(let x=minX;x<maxX;x+=.25)for(let z=minZ;z<maxZ;z+=.25){
      const p=[[x,z],[x+.25,z],[x+.25,z+.25],[x,z+.25]];
      if(!p.some(v=>allowed(...v))&&!allowed(x+.125,z+.125))continue;
      const heights=p.map(v=>height(...v));
      for(const ids of [[0,1,2],[0,2,3]]){
        if(!ids.every(i=>allowed(...p[i])))continue;
        const low=Math.min(...ids.map(i=>heights[i])),high=Math.max(...ids.map(i=>heights[i]));
        if(!Number.isFinite(low+high)||high-low<1e-8)continue;
        for(let k=Math.ceil((low-datum)/.5);datum+k*.5<high;k++){
          const level=Number((datum+k*.5).toFixed(6)),crossings=[];
          for(let j=0;j<3;j++){
            const a=ids[j],b=ids[(j+1)%3],ha=heights[a],hb=heights[b];
            if((ha<=level&&hb>level)||(hb<=level&&ha>level)){
              let lo=0,hi=1,t=(level-ha)/(hb-ha),point;
              for(let iteration=0;iteration<12;iteration++){
                point=p[a].map((v,axis)=>v+(p[b][axis]-v)*t);
                const value=height(...point);
                if(Math.abs(value-level)<.0001)break;
                if((value<level)===(ha<level))lo=t;else hi=t;
                t=(lo+hi)/2;
              }
              crossings.push(point);
            }
          }
          if(crossings.length===2)for(const points of clipped(...crossings)){
            const checks=Math.max(2,Math.ceil(Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1])/.015));
            const accurate=Array.from({length:checks+1},(_,i)=>i/checks).every(t=>Math.abs(height(...points[0].map((v,axis)=>v+(points[1][axis]-v)*t))-level)<=.02);
            if(accurate)contours.push({level,points,major:k%2===0,zone:zone(points[0])});
          }
        }
      }
    }
    const seeds=new Map(),bucket=(x,z)=>`${Math.floor(x/.5)},${Math.floor(z/.5)}`;
    const covered=(x,z)=>{
      for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const p of seeds.get(bucket(x+dx*.5,z+dz*.5))??[])if(Math.hypot(p[0]-x,p[1]-z)<.43)return true;
      return false;
    };
    function seed(x,z,index){
      if(!allowed(x,z))return;
      const g=gradient(x,z),slope=Math.hypot(...g);
      if(!Number.isFinite(slope)||slope<.005)return;
      const points=[[x,z]],length=index%2?.75:1;
      for(let d=0;d<length-1e-8;d+=.05){
        const p=points.at(-1),grad=gradient(...p),m=Math.hypot(...grad);
        if(m<.005)break;
        const next=p.map((v,j)=>v-grad[j]/m*.05),mid=p.map((v,j)=>(v+next[j])/2);
        if(!allowed(...next)||!allowed(...mid)||height(...next)>=height(...p)-1e-7)break;
        points.push(next);
      }
      if(points.length<2)return;
      strokes.push({points,zone:zone(points[0]),slope:slope*100});
      for(const p of points){const key=bucket(...p);if(!seeds.has(key))seeds.set(key,[]);seeds.get(key).push(p);}
    }
    let index=0;
    for(let x=minX+.325;x<maxX;x+=.65)for(let z=minZ+.325;z<maxZ;z+=.65)seed(x,z,index++);
    for(let x=minX+.0625;x<maxX;x+=.125)for(let z=minZ+.0625;z<maxZ;z+=.125)if(allowed(x,z)&&!covered(x,z))seed(x,z,index++);
    const selected=[],remaining=strokes.slice(),contourPoints=contours.flatMap(c=>c.points);
    const distances=remaining.map(s=>Math.min(100,...contourPoints.map(p=>Math.hypot(p[0]-s.points[0][0],p[1]-s.points[0][1]))));
    const choose=index=>{
      const stroke=remaining[index];selected.push(stroke);distances[index]=-1;
      for(let i=0;i<remaining.length;i++)if(distances[i]>=0){
        const p=remaining[i].points[0];
        for(const q of stroke.points)distances[i]=Math.min(distances[i],Math.hypot(p[0]-q[0],p[1]-q[1]));
      }
    };
    for(const id of new Set(strokes.map(s=>s.zone))){
      let best=-1;
      for(let i=0;i<remaining.length;i++)if(remaining[i].zone===id&&(best<0||distances[i]>distances[best]))best=i;
      if(best>=0)choose(best);
    }
    while(selected.length<95){
      let best=-1;
      for(let i=0;i<remaining.length;i++)if(distances[i]>=0&&(best<0||distances[i]>distances[best]))best=i;
      if(best<0||(selected.length>=70&&distances[best]<1.55))break;
      choose(best);
    }
    return {contours,strokes:selected,datum,contourInterval:.5,majorInterval:1,gridStep:.25};
  }
  function svg({surface,px,pz}){
    const path=points=>points.map((p,i)=>`${i?'L':'M'}${px(p[0]).toFixed(3)} ${pz(p[1]).toFixed(3)}`).join('');
    const safe=value=>String(value).replace(/[^a-zA-Z0-9_.-]/g,'');
    const arrow=s=>{
      const end=s.points.at(-1),previous=s.points.at(-2),x=px(end[0]),z=pz(end[1]),dx=x-px(previous[0]),dz=z-pz(previous[1]),length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
      const head=`M${(x-ux*3-uz*1.8).toFixed(3)} ${(z-uz*3+ux*1.8).toFixed(3)}L${x.toFixed(3)} ${z.toFixed(3)}L${(x-ux*3+uz*1.8).toFixed(3)} ${(z-uz*3-ux*1.8).toFixed(3)}`;
      return `<path data-surface-slope="${safe(s.zone)}" data-slope="${s.slope.toFixed(2)}" d="${path(s.points)}${head}" stroke="#635447" stroke-width=".8" opacity=".8"/>`;
    };
    return `<g fill="none" stroke-linecap="round">${surface.contours.map(c=>`<path data-surface-contour="${c.level}" data-zone="${safe(c.zone)}" d="${path(c.points)}" stroke="#806b54" stroke-width="${c.major?.65:.45}" opacity="${c.major?.55:.35}"/>`).join('')}${surface.strokes.map(arrow).join('')}</g>`;
  }
  return {create,svg,eligible};
})();
if(typeof module!=='undefined')module.exports={GradingSurfaceNotation};
