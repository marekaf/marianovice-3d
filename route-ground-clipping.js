export function cutGroundUnderRoutes(THREE, ground, routes) {
  const cross=(a,b,p)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
  const bounds=points=>({x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),z0:Math.min(...points.map(p=>p[2])),z1:Math.max(...points.map(p=>p[2]))});
  const overlaps=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.z0<b.z1&&a.z1>b.z0;
  const bins=new Map(),obstacles=[],rp=routes.attributes.position;
  const at=(attribute,i)=>[attribute.getX(i),attribute.getY(i),attribute.getZ(i)];
  const cells=function*(box){for(let x=Math.floor(box.x0);x<=Math.floor(box.x1);x++)for(let z=Math.floor(box.z0);z<=Math.floor(box.z1);z++)yield `${x},${z}`;};
  for(let i=0;i<(routes.index?.count??rp.count);i+=3){
    const points=[0,1,2].map(j=>at(rp,routes.index?routes.index.getX(i+j):i+j));
    const area=cross(...points);if(Math.abs(area)<1e-12)continue;
    if(area<0)[points[1],points[2]]=[points[2],points[1]];
    const box=bounds(points),id=obstacles.length;obstacles.push({points,box});
    for(const key of cells(box)){if(!bins.has(key))bins.set(key,[]);bins.get(key).push(id);}
  }
  const attributes=Object.entries(ground.attributes).map(([name,attribute])=>({name,attribute,data:Array.from(attribute.array)}));
  const position=ground.attributes.position,indices=[];
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
  function subtract(polygon,obstacle){
    if(!overlaps(bounds(polygon.map(point)),obstacle.box))return [polygon];
    const outside=[];let remaining=polygon;
    for(let edge=0;edge<3&&remaining.length>=3;edge++){
      const a=obstacle.points[edge],b=obstacle.points[(edge+1)%3],piece=halfPlane(remaining,a,b,false);
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
  for(let i=0;i<(ground.index?.count??position.count);i+=3){
    const ids=[0,1,2].map(j=>ground.index?ground.index.getX(i+j):i+j),box=bounds(ids.map(k=>at(position,k)));
    const candidates=new Set();for(const key of cells(box))for(const id of bins.get(key)??[])if(overlaps(box,obstacles[id].box))candidates.add(id);
    if(!candidates.size){indices.push(...ids);continue;}
    let pieces=[ids.map(vertex)];
    for(const id of candidates){pieces=pieces.flatMap(piece=>subtract(piece,obstacles[id]));if(!pieces.length)break;}
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
  const cross=(a,b,p)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
  const at=(attribute,i)=>[attribute.getX(i),attribute.getY(i),attribute.getZ(i)];
  const bins=new Map(),rp=routes.attributes.position;
  for(let i=0;i<(routes.index?.count??rp.count);i+=3){
    const points=[0,1,2].map(j=>at(rp,routes.index?routes.index.getX(i+j):i+j));
    const area=cross(...points);if(Math.abs(area)<1e-12)continue;
    if(area<0)[points[1],points[2]]=[points[2],points[1]];
    const xs=points.map(p=>p[0]),zs=points.map(p=>p[2]);
    for(let x=Math.floor(Math.min(...xs));x<=Math.floor(Math.max(...xs));x++)for(let z=Math.floor(Math.min(...zs));z<=Math.floor(Math.max(...zs));z++){
      const key=`${x},${z}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(points);
    }
  }
  const atRoute=p=>(bins.get(`${Math.floor(p[0])},${Math.floor(p[2])}`)??[]).some(triangle=>triangle.every((a,i)=>cross(a,triangle[(i+1)%3],p)>=0));
  const interpolate=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const positions=[],uv=[],seen=new Set(),gp=ground.attributes.position;
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
  for(let i=0;i<(ground.index?.count??gp.count);i+=3)for(let edge=0;edge<3;edge++){
    const a=at(gp,ground.index?ground.index.getX(i+edge):i+edge),b=at(gp,ground.index?ground.index.getX(i+(edge+1)%3):i+(edge+1)%3);
    const length=Math.hypot(b[0]-a[0],b[2]-a[2]);if(length<1e-7)continue;
    const candidates=new Set();
    for(let x=Math.floor(Math.min(a[0],b[0]));x<=Math.floor(Math.max(a[0],b[0]));x++)for(let z=Math.floor(Math.min(a[2],b[2]));z<=Math.floor(Math.max(a[2],b[2]));z++)for(const triangle of bins.get(`${x},${z}`)??[])candidates.add(triangle);
    if(!candidates.size)continue;
    const key=[a,b].map(p=>p.map(v=>Math.round(v*1e6)).join(',')).sort().join('/');if(seen.has(key))continue;seen.add(key);
    const intervals=[];
    for(const triangle of candidates){
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
