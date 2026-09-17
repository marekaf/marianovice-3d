// Every shortcut here must return the same geometry, in the same vertex and index order, as a
// plain scan of every ground triangle against every route triangle.
const cellKey=(x,z)=>x*65536+z;
const cross=(a,b,p)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
const at=(attribute,i)=>[attribute.getX(i),attribute.getY(i),attribute.getZ(i)];

function routeTriangles(routes) {
  const bins=new Map(),triangles=[],boxes=[],reach=[],rp=routes.attributes.position,ri=routes.index,count=ri?ri.count:rp.count;
  for(let i=0;i<count;i+=3){
    const points=[0,1,2].map(j=>at(rp,ri?ri.getX(i+j):i+j));
    const area=cross(...points);if(Math.abs(area)<1e-12)continue;
    if(area<0)[points[1],points[2]]=[points[2],points[1]];
    const [p,q,r]=points,id=triangles.length;
    const box={x0:Math.min(p[0],q[0],r[0]),x1:Math.max(p[0],q[0],r[0]),z0:Math.min(p[2],q[2],r[2]),z1:Math.max(p[2],q[2],r[2])};
    triangles.push(points);boxes.push(box);reach.push(enlarged(points));
    for(let x=Math.floor(box.x0);x<=Math.floor(box.x1);x++)for(let z=Math.floor(box.z0);z<=Math.floor(box.z1);z++){
      const key=cellKey(x,z);let bin=bins.get(key);if(!bin)bins.set(key,bin=[]);bin.push(id);
    }
  }
  return {bins,triangles,boxes,reach,stamps:new Int32Array(triangles.length),stamp:0};
}
// routeEdgeGeometry accepts a ground edge as crossing a route triangle while it stays within 1e-5 m
// outside every edge line, so the triangle's reach is the triangle grown by that much. Its box is a
// cheap test to skip triangles that could not produce an interval. Acute corners reach far, and a
// corner too sharp to offset safely makes the reach unbounded rather than wrong.
function enlarged(points){
  const grow=2e-5,corners=[];
  for(let j=0;j<3;j++){
    const p=points[j],a=points[(j+2)%3],b=points[(j+1)%3];
    const ux=p[0]-a[0],uz=p[2]-a[2],ul=Math.hypot(ux,uz),vx=b[0]-p[0],vz=b[2]-p[2],vl=Math.hypot(vx,vz);
    const n1x=uz/ul,n1z=-ux/ul,n2x=vz/vl,n2z=-vx/vl,dot=1+n1x*n2x+n1z*n2z;
    if(!(dot>1e-6))return {x0:-Infinity,x1:Infinity,z0:-Infinity,z1:Infinity};
    corners.push([p[0]+grow*(n1x+n2x)/dot,p[2]+grow*(n1z+n2z)/dot]);
  }
  const xs=corners.map(c=>c[0]),zs=corners.map(c=>c[1]);
  return {x0:Math.min(...xs)-1e-9,x1:Math.max(...xs)+1e-9,z0:Math.min(...zs)-1e-9,z1:Math.max(...zs)+1e-9};
}
// First-seen order over the cells matters: clipping and interval choices below follow it.
function gather(index,x0,x1,z0,z1,accept,into){
  const stamp=++index.stamp;into.length=0;
  for(let x=Math.floor(x0);x<=Math.floor(x1);x++)for(let z=Math.floor(z0);z<=Math.floor(z1);z++){
    const bin=index.bins.get(cellKey(x,z));if(!bin)continue;
    for(const id of bin){if(index.stamps[id]===stamp||!accept(id))continue;index.stamps[id]=stamp;into.push(id);}
  }
  return into;
}
const overlaps=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.z0<b.z1&&a.z1>b.z0;

export function cutGroundUnderRoutes(THREE, ground, routes, preserveRects = []) {
  const index=routeTriangles(routes),{triangles,boxes}=index;
  const attributes=Object.entries(ground.attributes).map(([name,attribute])=>({name,attribute,data:Array.from(attribute.array)}));
  const position=ground.attributes.position,pa=position.array,gi=ground.index,indices=[];
  const positionOffset=attributes.slice(0,attributes.findIndex(a=>a.name==='position')).reduce((sum,{attribute})=>sum+attribute.itemSize,0);
  const point=vertex=>vertex.values.slice(positionOffset,positionOffset+3);
  const vertex=index=>({index,values:attributes.flatMap(({attribute})=>Array.from({length:attribute.itemSize},(_,j)=>attribute.array[index*attribute.itemSize+j]))});
  function halfPlane(polygon,a,b,inside){
    const result=[];
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=cross(a,b,point(p)),dq=cross(a,b,point(q));
      const keepP=inside?dp>=0:dp<=0,keepQ=inside?dq>=0:dq<=0;
      if(keepP)result.push(p);
      if(keepP!==keepQ){const t=dp/(dp-dq);result.push({values:p.values.map((v,j)=>v+(q.values[j]-v)*t)});}
    }
    return result;
  }
  function subtract(polygon,id){
    const box={x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity};
    for(const p of polygon){const [x,,z]=point(p);box.x0=Math.min(box.x0,x);box.x1=Math.max(box.x1,x);box.z0=Math.min(box.z0,z);box.z1=Math.max(box.z1,z);}
    if(!overlaps(box,boxes[id]))return [polygon];
    const outside=[];let remaining=polygon;
    for(let edge=0;edge<3&&remaining.length>=3;edge++){
      const a=triangles[id][edge],b=triangles[id][(edge+1)%3],piece=halfPlane(remaining,a,b,false);
      if(piece.length>=3)outside.push(piece);
      remaining=halfPlane(remaining,a,b,true);
    }
    return outside;
  }
  function append(vertex){
    if(vertex.index!==undefined)return vertex.index;
    vertex.index=attributes[0].data.length/attributes[0].attribute.itemSize;
    let offset=0;
    for(const {attribute,data} of attributes){for(let j=0;j<attribute.itemSize;j++)data.push(vertex.values[offset++]);}
    return vertex.index;
  }
  const box={x0:0,x1:0,z0:0,z1:0},candidates=[],accept=id=>overlaps(box,boxes[id]),count=gi?gi.count:position.count;
  for(let i=0;i<count;i+=3){
    const ia=gi?gi.getX(i):i,ib=gi?gi.getX(i+1):i+1,ic=gi?gi.getX(i+2):i+2;
    const ax=pa[ia*3],az=pa[ia*3+2],bx=pa[ib*3],bz=pa[ib*3+2],cx=pa[ic*3],cz=pa[ic*3+2];
    box.x0=Math.min(ax,bx,cx);box.x1=Math.max(ax,bx,cx);box.z0=Math.min(az,bz,cz);box.z1=Math.max(az,bz,cz);
    if(preserveRects.some(rect=>box.x0>=rect.x0-1e-6&&box.x1<=rect.x1+1e-6&&box.z0>=rect.z0-1e-6&&box.z1<=rect.z1+1e-6)){indices.push(ia,ib,ic);continue;}
    gather(index,box.x0,box.x1,box.z0,box.z1,accept,candidates);
    if(!candidates.length){indices.push(ia,ib,ic);continue;}
    let pieces=[[vertex(ia),vertex(ib),vertex(ic)]];
    for(const id of candidates){pieces=pieces.flatMap(piece=>subtract(piece,id));if(!pieces.length)break;}
    for(const piece of pieces)for(let j=1;j+1<piece.length;j++){
      const triangle=[piece[0],piece[j],piece[j+1]];
      if(Math.abs(cross(...triangle.map(point)))>1e-12)indices.push(...triangle.map(append));
    }
  }
  const result=new THREE.BufferGeometry();
  for(const {name,attribute,data} of attributes)result.setAttribute(name,new THREE.BufferAttribute(new attribute.array.constructor(data),attribute.itemSize,attribute.normalized));
  result.setIndex(indices);
  return result;
}

export function routeEdgeGeometry(THREE, ground, routes) {
  const index=routeTriangles(routes),{bins,triangles,reach}=index;
  const atRoute=p=>{
    const bin=bins.get(cellKey(Math.floor(p[0]),Math.floor(p[2])));if(!bin)return false;
    for(const id of bin){const triangle=triangles[id];if(triangle.every((a,i)=>cross(a,triangle[(i+1)%3],p)>=0))return true;}
    return false;
  };
  const interpolate=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const positions=[],uv=[],seen=new Set(),gp=ground.attributes.position,ga=gp.array,gi=ground.index;
  let boundaryLength=0,maxHeightGap=0;
  function connect(a,b,triangle){
    const height=p=>triangle.reduce((sum,q,i)=>sum+q[1]*cross(triangle[(i+1)%3],triangle[(i+2)%3],p),0)/cross(...triangle);
    const topA=[a[0],height(a),a[2]],topB=[b[0],height(b),b[2]],gapA=topA[1]-a[1],gapB=topB[1]-b[1];
    if(gapA*gapB<0&&Math.min(Math.abs(gapA),Math.abs(gapB))>1e-7){const middle=interpolate(a,b,gapA/(gapA-gapB));connect(a,middle,triangle);connect(middle,b,triangle);return;}
    const length=Math.hypot(b[0]-a[0],b[2]-a[2]);
    if(length<1e-7||Math.max(Math.abs(gapA),Math.abs(gapB))<1e-6)return;
    boundaryLength+=length;maxHeightGap=Math.max(maxHeightGap,Math.abs(gapA),Math.abs(gapB));
    for(const [p,u]of [[a,0],[b,length],[topB,length],[a,0],[topB,length],[topA,0]]){positions.push(...p);uv.push(u,p[1]);}
  }
  const edgeBox={x0:0,x1:0,z0:0,z1:0},candidates=[],count=gi?gi.count:gp.count;
  const accept=id=>{const r=reach[id];return r.x0<=edgeBox.x1&&r.x1>=edgeBox.x0&&r.z0<=edgeBox.z1&&r.z1>=edgeBox.z0;};
  for(let i=0;i<count;i+=3)for(let edge=0;edge<3;edge++){
    const ia=gi?gi.getX(i+edge):i+edge,ib=gi?gi.getX(i+(edge+1)%3):i+(edge+1)%3;
    const ax=ga[ia*3],ay=ga[ia*3+1],az=ga[ia*3+2],bx=ga[ib*3],by=ga[ib*3+1],bz=ga[ib*3+2];
    const length=Math.hypot(bx-ax,bz-az);if(length<1e-7)continue;
    edgeBox.x0=Math.min(ax,bx);edgeBox.x1=Math.max(ax,bx);edgeBox.z0=Math.min(az,bz);edgeBox.z1=Math.max(az,bz);
    gather(index,edgeBox.x0,edgeBox.x1,edgeBox.z0,edgeBox.z1,accept,candidates);
    if(!candidates.length)continue;
    const a=[ax,ay,az],b=[bx,by,bz];
    const key=[a,b].map(p=>p.map(v=>Math.round(v*1e6)).join(',')).sort().join('/');if(seen.has(key))continue;seen.add(key);
    const intervals=[];
    for(const id of candidates){
      const triangle=triangles[id];
      let from=0,to=1;
      for(let j=0;j<3&&from<=to;j++){
        const start=triangle[j],end=triangle[(j+1)%3],da=cross(start,end,a),db=cross(start,end,b);
        const tolerance=1e-5*Math.hypot(end[0]-start[0],end[2]-start[2]);
        if(da<-tolerance&&db<-tolerance){from=1;to=0;break;}
        if(da<-tolerance)from=Math.max(from,da/(da-db));
        if(db<-tolerance)to=Math.min(to,da/(da-db));
      }
      if(to-from>1e-8)intervals.push({from,to,triangle});
    }
    const cuts=[...new Set(intervals.flatMap(({from,to})=>[from,to]))].sort((a,b)=>a-b);
    for(let j=1;j<cuts.length;j++){
      const from=cuts[j-1],to=cuts[j],t=(from+to)/2;if((to-from)*length<1e-7)continue;
      const interval=intervals.find(interval=>t>=interval.from&&t<=interval.to);if(!interval)continue;
      const middle=interpolate(a,b,t),nx=-(b[2]-a[2])/length*.00005,nz=(b[0]-a[0])/length*.00005;
      if(atRoute([middle[0]+nx,0,middle[2]+nz])===atRoute([middle[0]-nx,0,middle[2]-nz]))continue;
      connect(interpolate(a,b,from),interpolate(a,b,to),interval.triangle);
    }
  }
  const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));result.computeVertexNormals();
  result.userData={boundaryLength,maxHeightGap};
  return result;
}
