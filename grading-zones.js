const GradingZones = (() => {
  const cross = (a,b,p) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const signedArea = p => p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
  const area = p => Math.abs(signedArea(p));
  const rect = (x,z,w,d) => [[x,z],[x+w,z],[x+w,z+d],[x,z+d]];
  function measuredFence() {
    if(typeof FENCE_SURVEY!=='undefined')return FENCE_SURVEY;
    if(typeof module!=='undefined') {
      try{return require('./docs/fence-survey.js').FENCE_SURVEY;}
      catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
    }
    return null;
  }
  function half(p,a,b,positive=true) {
    const out=[];
    for(let i=0;i<p.length;i++) {
      const u=p[i],v=p[(i+1)%p.length],du=cross(a,b,u)*(positive?1:-1),dv=cross(a,b,v)*(positive?1:-1);
      if(du>=-1e-9)out.push(u);
      if((du>1e-9&&dv< -1e-9)||(du< -1e-9&&dv>1e-9)){const t=du/(du-dv);out.push([u[0]+t*(v[0]-u[0]),u[1]+t*(v[1]-u[1])]);}
    }
    return out.length>=3&&area(out)>1e-8?out:[];
  }
  function triangles(input) {
    const p=signedArea(input)<0?input.slice().reverse():input.slice(),out=[];
    let limit=p.length*p.length;
    while(p.length>3&&limit-->0) {
      let found=false;
      for(let i=0;i<p.length;i++) {
        const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];
        if(cross(a,b,c)<=1e-9)continue;
        if(p.some(v=>v!==a&&v!==b&&v!==c&&cross(a,b,v)>=-1e-9&&cross(b,c,v)>=-1e-9&&cross(c,a,v)>=-1e-9))continue;
        out.push([a,b,c]);p.splice(i,1);found=true;break;
      }
      if(!found)throw new Error('Polygon cannot be triangulated');
    }
    if(p.length===3)out.push(p);
    return out;
  }
  function split(subject,clip) {
    let rest=subject;const outside=[];
    for(let i=0;i<clip.length&&rest.length;i++) {
      const a=clip[i],b=clip[(i+1)%clip.length],piece=half(rest,a,b,false);
      if(piece.length)outside.push(piece);
      rest=half(rest,a,b);
    }
    return {inside:rest,outside};
  }
  function subtract(polygons,clips) {
    for(const clip of clips)polygons=polygons.flatMap(p=>split(p,clip).outside);
    return polygons;
  }
  function parts(element) {
    return (element?.parts??[]).filter(p=>p.kind==='polygon'||p.kind==='rect'&&!p.role?.includes('detail')).flatMap(p=>triangles(p.kind==='polygon'?p.points:rect(p.x,p.y,p.w,p.d)));
  }
  const sum = polygons => polygons.reduce((s,p)=>s+area(p),0);
  function boundary(polygons) {
    const edges=polygons.flatMap(p=>p.map((a,i)=>[a,p[(i+1)%p.length]])),points=edges.map(e=>e[0]),counts=new Map();
    const key=p=>p.map(v=>v.toFixed(7)).join(',');
    for(const [a,b] of edges) {
      const dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;if(length2<1e-14)continue;
      const cuts=points.filter(p=>Math.abs(cross(a,b,p))<1e-7).map(p=>({p,t:((p[0]-a[0])*dx+(p[1]-a[1])*dz)/length2})).filter(v=>v.t>=-1e-8&&v.t<=1+1e-8).sort((u,v)=>u.t-v.t);
      for(let i=1;i<cuts.length;i++) {
        if(cuts[i].t-cuts[i-1].t<1e-8)continue;
        const u=cuts[i-1].p,v=cuts[i].p,k=[key(u),key(v)].sort().join('|'),old=counts.get(k);
        counts.set(k,{count:(old?.count??0)+1,edge:[u,v]});
      }
    }
    return [...counts.values()].filter(v=>v.count===1).map(v=>v.edge);
  }
  function create(garden) {
    const el=id=>garden.elements.find(e=>e.id===id),r=id=>el(id)?.parts.find(p=>p.kind==='rect');
    const house=el('house')?.meta?.bbox??[10.48,7.18,21.28,26.43],west=r('westTerrace'),east=r('eastTerrace'),garage=r('garage');
    const productiveMinX=Math.min(1.5,...['greenhouse','raisedBedsPad','sauna'].map(id=>r(id)?.x).filter(Number.isFinite));
    const productiveMaxZ=Math.max(15.8,...['greenhouse','sauna','raisedBedsPad'].map(id=>{const p=r(id);return p?p.y+p.d+.5:0;}));
    const plot=triangles(garden.plot.vertices), plotArea=sum(plot), bounds=rect(-100,-100,300,300);
    const garageEast=garage?garage.x+garage.w:34.13;
    const drivewayParts=parts(el('driveway'));
    const buildingFootprints=ids=>ids.flatMap(id=>parts({parts:(el(id)?.parts??[]).filter(p=>p.kind==='polygon'||p.kind==='rect').slice(0,1)}));
    const masks=[
      ['F','Dům',buildingFootprints(['house']),[16,12],'#8470ad'],
      ['M','Garáž a přístřešek',buildingFootprints(['garage','carport']),[30.5,22.5],'#447fa3'],
      ['E','Západní snížený pás',west?[rect(west.x-.75,west.y,.75,west.d)]:[],[9.1,20],'#b29845'],
      ['A','Rovný příjezd před garáží',drivewayParts.map(p=>half(p,[garageEast,-100],[garageEast,100])).filter(p=>p.length),[28,28],'#848e98'],
      ['B','Sjezd k bráně',drivewayParts.map(p=>half(p,[garageEast,-100],[garageEast,100],false)).filter(p=>p.length),[39,29],'#bd946e'],
      ['D','Východní terasa',parts(el('eastTerrace')),[22.8,14],'#cfb174'],
      ['K','Západní terasa a atrium',parts(el('westTerrace')),[12.5,17.5],'#c07c4f'],
      ['J','Zahrada severně od domu',[rect(house[0],-10,house[2]-house[0],house[1]+10)],[12,4],'#669f9d'],
      ['G','Sauna a užitková zahrada',[rect(productiveMinX,1.8,9.48-productiveMinX,productiveMaxZ-1.8)],[4,8],'#8fac75'],
      ['L','Strmý svah u plotu bez sečení',(garden.gradingBanks??[]).map(b=>b.points),[41,9],'#a86642'],
      ['H','Nízká část pro násyp',[rect(garageEast,-10,30,29.38)],[36,10],'#78aeb4'],
      ['C','Rovná zahrada nad garáží a přístřeškem',[rect(house[2],-10,garageEast-house[2],29.38)],[28,12],'#9aba93'],
      ['I','Okrajová zahrada a svahy',[bounds],[5,28],'#c4c3a7']
    ];
    let remaining=plot;
    const zones=[];
    for(const [id,name,polygons,label,color] of masks) {
      const selected=[];
      for(const mask of polygons.flatMap(triangles)) {
        for(const p of remaining){const intersection=split(p,mask).inside;if(intersection.length)selected.push(intersection);}
        remaining=subtract(remaining,[mask]);
      }
      zones.push({id,name,polygons:selected,boundaries:boundary(selected),area:sum(selected),label,color});
    }
    zones.sort((a,b)=>a.id.localeCompare(b.id));
    const groups=[['buildings','Dům, garáž a ostatní stavby',['house','garage','sauna','saunaShelter','greenhouse','toolStore']],['driveway','Příjezd včetně přístřešku',['driveway','carport']],['eastTerrace','Východní terasa',['eastTerrace']],['westTerrace','Západní terasa včetně atria',['westTerrace']],['pergola','Pergola',['pergola']],['service','Servisní plocha čerpadla včetně podstavce',['heatPumpService','heatPumpPad']],['paths','Pevné pěší plochy',['saunaPath']],['productive','Plošina záhonů',['raisedBedsPad']],['drainage','Západní snížený pás',[]]];
    remaining=plot;const surfaces=[];
    for(const [id,name,ids] of groups) {
      const clips=id==='drainage'&&west?triangles(rect(west.x-.75,west.y,.75,west.d)):ids.flatMap(elementId=>parts(id==='buildings'?{parts:(el(elementId)?.parts??[]).filter(p=>p.kind==='polygon'||p.kind==='rect').slice(0,1)}:el(elementId)));
      const polygons=[];
      for(const clip of clips){for(const p of remaining){const q=split(p,clip).inside;if(q.length)polygons.push(q);}remaining=subtract(remaining,[clip]);}
      surfaces.push({id,name,polygons,area:sum(polygons)});
    }
    surfaces.push({id:'other',name:'Ostatní zahrada včetně vody a nezpevněných cest',polygons:remaining,area:sum(remaining)});
    const dimensions=[];
    for(const [id,name] of [['sauna','Sauna'],['carport','Přístřešek'],['garage','Garáž'],['eastTerrace','Východní terasa'],['westTerrace','Západní chodník'],['greenhouse','Skleník'],['raisedBedsPad','Plošina záhonů'],['compost','Kompost'],['heatPumpService','Servis čerpadla'],['heatPumpPad','Podstavec čerpadla'],['pergola','Pergola']]) {
      const p=r(id);if(p)dimensions.push({id,name,value:`${p.w.toFixed(2)} × ${p.d.toFixed(2)} m`,from:[p.x,p.y],to:[p.x+p.w,p.y]});
    }
    for(const id of ['sauna','pergola']) {
      const p=r(id);if(p)dimensions.push({id:id+'Depth',name:(id==='sauna'?'Sauna':'Pergola')+' – hloubka',value:p.d.toFixed(2)+' m',from:[p.x+p.w,p.y],to:[p.x+p.w,p.y+p.d]});
    }
    if(west)dimensions.push({name:'Západní pás',value:`0,75 × ${west.d.toFixed(2)} m`,from:[west.x-.75,west.y+west.d],to:[west.x,west.y+west.d]});
    const driveway=el('driveway')?.parts.find(p=>p.kind==='polygon');
    if(garage&&driveway) {
      const x0=house[2],x1=garage.x+garage.w;
      dimensions.push({name:'Rovný příjezd podél domu a garáže',value:(x1-x0).toFixed(2)+' m',from:[x0,29.6],to:[x1,29.6]});
      const gate=el('gate')?.parts.find(p=>p.kind==='line');
      if(gate){const a=[gate.x1,gate.y1],b=[gate.x2,gate.y2];dimensions.push({name:'Šířka příjezdu u brány',value:Math.hypot(b[0]-a[0],b[1]-a[1]).toFixed(2)+' m',from:a,to:b});}
      const apron=el('driveway').meta?.apron;
      if(apron)dimensions.push({name:'Hloubka rovné příjezdové plochy',value:apron.d.toFixed(2)+' m',from:[garage.x+garage.w,apron.y],to:[garage.x+garage.w,apron.y+apron.d]});
      dimensions.push({name:'Rovná plocha před garáží',value:garage.w.toFixed(2)+' m podél průčelí',from:[garage.x,garage.y+garage.d],to:[garage.x+garage.w,garage.y+garage.d]});
    }
    const pergola=r('pergola');
    const fenceSegments=measuredFence()?.segments??[];
    if(pergola) {
      const model=typeof module!=='undefined'?require('./pergola-model.js').PergolaModel:PergolaModel;
      const pergolaParts=model.build(garden).parts;
      const roofs=pergolaParts.filter(p=>p.category==='roof'&&p.type==='box');
      const roofPolygons=roofs.map(p=>rect(p.position[0]-p.size[0]/2,p.position[1]-p.size[1]/2,p.size[0],p.size[1]));
      const vertices=garden.plot.vertices;
      const fenceEdges=fenceSegments.length?fenceSegments.map(s=>[s.start,s.end]):vertices.map((a,i)=>[a,vertices[(i+1)%vertices.length]]);
      const closestPoint=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return [a[0]+t*dx,a[1]+t*dz];};
      let distance=Infinity,roofPoint,fencePoint;
      for(const [a,b] of fenceEdges)for(const roof of roofPolygons)for(let j=0;j<roof.length;j++) {
        const u=roof[j],v=roof[(j+1)%roof.length];
        for(const [r,fence] of [[u,closestPoint(u,a,b)],[v,closestPoint(v,a,b)],[closestPoint(a,u,v),a],[closestPoint(b,u,v),b]]) {
          const d=Math.hypot(r[0]-fence[0],r[1]-fence[1]);
          if(d<distance){distance=d;roofPoint=r;fencePoint=fence;}
        }
      }
      dimensions.push({id:'pergolaFenceGap',name:'Střecha pergoly – plot',value:distance.toFixed(2)+' m',from:roofPoint,to:fencePoint});
      const houseCorner=[house[2],house[1]];
      const postCorners=pergolaParts.filter(p=>/^post_\d+$/.test(p.name)&&p.type==='box').flatMap(p=>rect(p.position[0]-p.size[0]/2,p.position[1]-p.size[1]/2,p.size[0],p.size[1]));
      const nearest=postCorners.sort((a,b)=>Math.hypot(a[0]-houseCorner[0],a[1]-houseCorner[1])-Math.hypot(b[0]-houseCorner[0],b[1]-houseCorner[1]))[0];
      if(nearest)dimensions.push({id:'housePergolaGap',name:'Roh domu – sloup pergoly',value:Math.hypot(nearest[0]-houseCorner[0],nearest[1]-houseCorner[1]).toFixed(2)+' m',from:houseCorner,to:nearest});
    }
    const drivewayPolygons=surfaces.find(s=>s.id==='driveway').polygons;
    const drivewayBreakdown=['A','B'].map(id=>({id,name:id==='A'?'Rovný příjezd včetně přístřešku':'Klesající příjezd k bráně',area:sum(drivewayPolygons.map(p=>half(p,[garageEast,-100],[garageEast,100],id==='A')).filter(p=>p.length))}));
    for(const dimension of dimensions)dimension.value=dimension.value.replaceAll('.',',');
    const carport=r('carport');
    const levelMarks=carport?[
      {id:'carport',position:[carport.x+carport.w/2,carport.y+carport.d/2],relativeLevel:-.5},
      {id:'A',position:[31,29.3],relativeLevel:-.5},
      {id:'C',position:[28,13.8],relativeLevel:-.5}
    ]:[];
    const bedCourt=r('raisedBedsPad');
    if(bedCourt)levelMarks.push({id:'raisedBeds',position:[bedCourt.x+bedCourt.w/2,bedCourt.y+bedCourt.d/2],relativeLevel:.4});
    return {zones,surfaces,dimensions,plotArea,drivewayBreakdown,levelMarks,fenceSegments};
  }
  return {create,area,triangles,split,subtract};
})();
if(typeof module!=='undefined')module.exports={GradingZones};
