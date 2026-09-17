// New vertices get their height in one batch after every pad is clipped, so a caller may sample it
// anywhere. Clipping reads only x and z, so the batch changes no vertex, no triangle and no order.
export function* levelCircularGroundSteps(THREE,ground,pads) {
  const pending=[];
  for(const pad of pads.filter(p=>p.radius!==undefined||p.boundary)) {
    const position=ground.attributes.position,texture=ground.attributes.uv;
    const positions=Array.from(position.array),uv=Array.from(texture.array),indices=[];
    const circle=pad.boundary??Array.from({length:512},(_,i)=>{const angle=i*Math.PI/256;return [pad.cx+pad.radius*Math.cos(angle),pad.cz+pad.radius*Math.sin(angle)];});
    const bounds=[0,1].map(axis=>[Math.min(...circle.map(p=>p[axis])),Math.max(...circle.map(p=>p[axis]))]);
    const cross=(a,b,p)=>(b[0]-a[0])*(p.values[2]-a[1])-(b[1]-a[1])*(p.values[0]-a[0]);
    function clip(polygon,a,b,inside){
      const result=[];
      for(let i=0;i<polygon.length;i++){
        const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=cross(a,b,p),dq=cross(a,b,q);
        const keepP=inside?dp>=0:dp<=0,keepQ=inside?dq>=0:dq<=0;
        if(keepP)result.push(p);
        if(keepP!==keepQ){const t=dp/(dp-dq);result.push({values:p.values.map((v,j)=>v+(q.values[j]-v)*t)});}
      }
      return result;
    }
    function append(polygon,flat=false){
      const ids=polygon.map(p=>{
        if(p.index!==undefined)return p.index;
        const [x,,z,u,v]=p.values,index=positions.length/3;
        if(flat)positions.push(x,pad.level,z);else{pending.push(index,x,z);positions.push(x,NaN,z);}
        uv.push(u,v);
        return index;
      });
      for(let i=1;i+1<ids.length;i++){
        const [a,b,c]=[ids[0],ids[i],ids[i+1]].map(id=>[positions[id*3],positions[id*3+2]]);
        if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>1e-12)indices.push(ids[0],ids[i],ids[i+1]);
      }
    }
    for(let i=0;i<(ground.index?.count??position.count);i+=3){
      const ids=[0,1,2].map(j=>ground.index?ground.index.getX(i+j):i+j);
      const triangle=ids.map(index=>({index,values:[position.getX(index),position.getY(index),position.getZ(index),texture.getX(index),texture.getY(index)]}));
      if(!pad.boundary&&triangle.every(p=>Math.hypot(p.values[0]-pad.cx,p.values[2]-pad.cz)<pad.radius*Math.cos(Math.PI/512))||
        [0,2].some((axis,j)=>Math.max(...triangle.map(p=>p.values[axis]))<bounds[j][0]||Math.min(...triangle.map(p=>p.values[axis]))>bounds[j][1])){
        indices.push(...ids);continue;
      }
      let remaining=triangle;
      for(let edge=0;edge<circle.length&&remaining.length>=3;edge++){
        const a=circle[edge],b=circle[(edge+1)%circle.length],outside=clip(remaining,a,b,false);
        if(outside.length>=3)append(outside);
        remaining=clip(remaining,a,b,true);
      }
      if(remaining.length>=3)append(remaining,!pad.boundary);
    }
    const aligned=new THREE.BufferGeometry();
    aligned.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    aligned.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    aligned.setIndex(indices);ground.dispose();ground=aligned;
  }
  if(pending.length){
    const xs=new Float64Array(pending.length/3),zs=new Float64Array(pending.length/3);
    for(let i=0;i<xs.length;i++){xs[i]=pending[i*3+1];zs[i]=pending[i*3+2];}
    const heights=yield {xs,zs};
    for(let i=0;i<xs.length;i++)ground.attributes.position.setY(pending[i*3],heights[i]);
  }
  ground.computeVertexNormals();
  return ground;
}

export function levelCircularGround(THREE,ground,pads,height) {
  const steps=levelCircularGroundSteps(THREE,ground,pads);
  let step=steps.next();
  while(!step.done){
    const {xs,zs}=step.value,heights=new Float64Array(xs.length);
    for(let i=0;i<xs.length;i++)heights[i]=height(xs[i],zs[i]);
    step=steps.next(heights);
  }
  return step.value;
}

export async function levelCircularGroundAsync(THREE,ground,pads,sample) {
  const steps=levelCircularGroundSteps(THREE,ground,pads);
  let step=steps.next();
  while(!step.done)step=steps.next(await sample(step.value.xs,step.value.zs));
  return step.value;
}

export function gradingGroundBoundaries(garden,spec) {
  const boundaries=[],pond=spec.pond;
  const lawn=spec.regionalGrades?.find(p=>p.id==='north-lawn');
  if(lawn)boundaries.push({id:'north-lawn',boundary:[[lawn.x0,lawn.z0],[lawn.x1,lawn.z0],[lawn.x1,lawn.z1],[lawn.x0,lawn.z1]]});
  if(pond)boundaries.push({id:'pond-rim',boundary:Array.from({length:1024},(_,i)=>{
    const angle=i*Math.PI/512,scale=1/Math.cos(Math.PI/1024);
    return [pond.cx+(pond.rx*scale+.000004)*Math.cos(angle),pond.cz+(pond.rz*scale+.000004)*Math.sin(angle)];
  })});
  if(pond)boundaries.push({id:'pond-bottom',boundary:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>[pond.cx+x*.0001,pond.cz+z*.0001])});
  return boundaries;
}

export function gradingGroundRefinement(spec) {
  const lawn=spec.regionalGrades.find(p=>p.id==='north-lawn'),garage=spec.protectedPads[0];
  return {x0:garage.x0,x1:lawn.x1,z0:lawn.z0-6.2,z1:garage.z0+.02,level:spec.drivewayProfile.startLevel,tolerance:.0005,maxDepth:8};
}

// Probe heights are requested in batches, so a caller may sample them on another thread. The
// height field is pure, so batching changes no vertex, no triangle and no order.
export function* refinePlateauGroundSteps(THREE,ground,{x0,x1,z0,z1,level,tolerance=.00025,maxDepth=10}) {
  const position=ground.attributes.position,texture=ground.attributes.uv,vertices=[],lookup=new Map();
  const vertex=p=>{
    let row=lookup.get(p[0]);if(!row)lookup.set(p[0],row=new Map());
    let id=row.get(p[2]);if(id===undefined){row.set(p[2],id=vertices.length);vertices.push(p);}
    return id;
  };
  const EDGE=67108864,edge=(a,b)=>a<b?a*EDGE+b:b*EDGE+a;
  let triangles=[],verified=[];
  for(let i=0;i<(ground.index?.count??position.count);i+=3){
    for(let j=0;j<3;j++){
      const id=ground.index?ground.index.getX(i+j):i+j;
      triangles.push(vertex([position.getX(id),position.getY(id),position.getZ(id),texture.getX(id),texture.getY(id)]));
    }
    verified.push(false);
  }
  // Probes are cached by the vertices that define them: an edge key for a midpoint, the triangle
  // slot for a centroid. Every new vertex sits on a probed midpoint, so it never samples again.
  const midHeights=new Map();let centroids=[];
  const mid=(a,b,i)=>(0+vertices[a][i]+vertices[b][i])/2;
  for(let depth=0;depth<maxDepth;depth++) {
    const count=triangles.length/3,candidates=[],xs=[],zs=[],pendingEdges=new Map(),pendingCentroids=[];
    for(let t=0;t<count;t++) {
      if(verified[t])continue;
      const a=triangles[t*3],b=triangles[t*3+1],c=triangles[t*3+2],pa=vertices[a],pb=vertices[b],pc=vertices[c];
      if(Math.max(pa[0],pb[0],pc[0])<x0||Math.min(pa[0],pb[0],pc[0])>x1||Math.max(pa[2],pb[2],pc[2])<z0||Math.min(pa[2],pb[2],pc[2])>z1)continue;
      if(Math.abs(pa[1]-level)<1e-7&&Math.abs(pb[1]-level)<1e-7&&Math.abs(pc[1]-level)<1e-7)continue;
      candidates.push(t);
      for(let i=0;i<3;i++){
        const p=triangles[t*3+i],q=triangles[t*3+(i+1)%3],key=edge(p,q);
        if(midHeights.has(key)||pendingEdges.has(key))continue;
        pendingEdges.set(key,xs.length);xs.push(mid(p,q,0));zs.push(mid(p,q,2));
      }
      if(centroids[t]===undefined){pendingCentroids.push(t,xs.length);xs.push(((0+pa[0]+pb[0])+pc[0])/3);zs.push(((0+pa[2]+pb[2])+pc[2])/3);}
    }
    if(xs.length){
      const heights=yield {xs:Float64Array.from(xs),zs:Float64Array.from(zs)};
      for(const [key,i] of pendingEdges)midHeights.set(key,heights[i]);
      for(let j=0;j<pendingCentroids.length;j+=2)centroids[pendingCentroids[j]]=heights[pendingCentroids[j+1]];
    }
    const split=new Map();
    for(const t of candidates) {
      const pa=vertices[triangles[t*3]],pb=vertices[triangles[t*3+1]],pc=vertices[triangles[t*3+2]];
      const probe=i=>i===3?centroids[t]:midHeights.get(edge(triangles[t*3+i],triangles[t*3+(i+1)%3]));
      const probeY=i=>i===3?((0+pa[1]+pb[1])+pc[1])/3:mid(triangles[t*3+i],triangles[t*3+(i+1)%3],1);
      let nearFlat=Math.abs(pa[1]-level)<1e-7||Math.abs(pb[1]-level)<1e-7||Math.abs(pc[1]-level)<1e-7;
      for(let i=0;i<4&&!nearFlat;i++)nearFlat=Math.abs(probe(i)-level)<1e-7;
      let needs=false;
      if(nearFlat)for(let i=0;i<4&&!needs;i++){const actual=probe(i);needs=Math.abs(actual-level)<.1&&Math.abs(probeY(i)-actual)>tolerance;}
      if(!needs){verified[t]=true;continue;}
      for(let i=0;i<3;i++){
        const p=triangles[t*3+i],q=triangles[t*3+(i+1)%3],key=edge(p,q);
        if(!split.has(key))split.set(key,vertex([mid(p,q,0),midHeights.get(key),mid(p,q,2),mid(p,q,3),mid(p,q,4)]));
      }
    }
    if(!split.size)break;
    const refined=[],refinedVerified=[],refinedCentroids=[];
    const push=(a,b,c,keep,t)=>{refined.push(a,b,c);refinedVerified.push(keep);refinedCentroids.push(keep?centroids[t]:undefined);};
    for(let t=0;t<count;t++){
      const ids=[triangles[t*3],triangles[t*3+1],triangles[t*3+2]];
      const mids=[split.get(edge(ids[0],ids[1])),split.get(edge(ids[1],ids[2])),split.get(edge(ids[2],ids[0]))];
      const n=(mids[0]!==undefined)+(mids[1]!==undefined)+(mids[2]!==undefined);
      if(!n){push(ids[0],ids[1],ids[2],verified[t],t);continue;}
      if(n===3){const [a,b,c]=ids,[ab,bc,ca]=mids;push(a,ab,ca,false);push(ab,b,bc,false);push(ca,bc,c,false);push(ab,bc,ca,false);continue;}
      const start=n===1?mids.findIndex(id=>id!==undefined):(mids.findIndex(id=>id===undefined)+1)%3;
      const a=ids[start],b=ids[(start+1)%3],c=ids[(start+2)%3],ab=mids[start],bc=mids[(start+1)%3];
      if(n===1){push(a,ab,c,false);push(ab,b,c,false);}
      else{push(a,ab,c,false);push(ab,bc,c,false);push(ab,b,bc,false);}
    }
    triangles=refined;verified=refinedVerified;centroids=refinedCentroids;
    if(triangles.length>3000000)throw new Error('Local terrain refinement exceeded one million triangles');
  }
  const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flatMap(p=>p.slice(0,3)),3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap(p=>p.slice(3)),2));
  result.setIndex(triangles);result.computeVertexNormals();ground.dispose();return result;
}

export function refinePlateauGround(THREE,ground,height,options) {
  const steps=refinePlateauGroundSteps(THREE,ground,options);
  let step=steps.next();
  while(!step.done){
    const {xs,zs}=step.value,heights=new Float64Array(xs.length);
    for(let i=0;i<xs.length;i++)heights[i]=height(xs[i],zs[i]);
    step=steps.next(heights);
  }
  return step.value;
}

// `sample(xs,zs)` resolves to the heights of the given points, in order.
export async function refinePlateauGroundAsync(THREE,ground,sample,options) {
  const steps=refinePlateauGroundSteps(THREE,ground,options);
  let step=steps.next();
  while(!step.done)step=steps.next(await sample(step.value.xs,step.value.zs));
  return step.value;
}
