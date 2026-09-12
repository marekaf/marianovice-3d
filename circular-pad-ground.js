export function levelCircularGround(THREE,ground,pads,height) {
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
        positions.push(x,flat?pad.level:height(x,z),z);uv.push(u,v);
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
  ground.computeVertexNormals();
  return ground;
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

export function refinePlateauGround(THREE,ground,height,{x0,x1,z0,z1,level,tolerance=.00025,maxDepth=10}) {
  const position=ground.attributes.position,texture=ground.attributes.uv,vertices=[],lookup=new Map();
  const vertex=p=>{const key=p[0]+','+p[2];if(!lookup.has(key)){lookup.set(key,vertices.length);vertices.push(p);}return lookup.get(key);};
  const sampled=p=>[p[0],height(p[0],p[2]),p[2],p[3],p[4]];
  const average=points=>points[0].map((_,i)=>points.reduce((sum,p)=>sum+p[i],0)/points.length);
  const edge=(a,b)=>a<b?a+','+b:b+','+a;
  let triangles=[];
  for(let i=0;i<(ground.index?.count??position.count);i+=3)triangles.push([0,1,2].map(j=>{
    const id=ground.index?ground.index.getX(i+j):i+j;
    return vertex([position.getX(id),position.getY(id),position.getZ(id),texture.getX(id),texture.getY(id)]);
  }));
  const verified=new Set(),heightCache=new Map();
  const sample=(x,z)=>{const key=x+','+z;if(!heightCache.has(key))heightCache.set(key,height(x,z));return heightCache.get(key);};
  for(let depth=0;depth<maxDepth;depth++) {
    const split=new Map();
    for(const ids of triangles) {
      const triangleKey=ids.join(',');if(verified.has(triangleKey))continue;
      const points=ids.map(id=>vertices[id]);
      if(Math.max(...points.map(p=>p[0]))<x0||Math.min(...points.map(p=>p[0]))>x1||Math.max(...points.map(p=>p[2]))<z0||Math.min(...points.map(p=>p[2]))>z1)continue;
      if(points.every(p=>Math.abs(p[1]-level)<1e-7))continue;
      const probes=[...points.map((p,i)=>average([p,points[(i+1)%3]])),average(points)];
      const nearFlat=points.some(p=>Math.abs(p[1]-level)<1e-7)||probes.some(p=>Math.abs(sample(p[0],p[2])-level)<1e-7);
      const needs=nearFlat&&probes.some(p=>{
        const actual=sample(p[0],p[2]);return Math.abs(actual-level)<.1&&Math.abs(p[1]-actual)>tolerance;
      });
      if(!needs)verified.add(triangleKey);
      if(needs)for(let i=0;i<3;i++){
        const a=ids[i],b=ids[(i+1)%3],key=edge(a,b);
        if(!split.has(key))split.set(key,vertex(sampled(average([vertices[a],vertices[b]]))));
      }
    }
    if(!split.size)break;
    const refined=[];
    for(const ids of triangles){
      const mids=ids.map((id,i)=>split.get(edge(id,ids[(i+1)%3]))),count=mids.filter(id=>id!==undefined).length;
      if(!count){refined.push(ids);continue;}
      if(count===3){const [a,b,c]=ids,[ab,bc,ca]=mids;refined.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);continue;}
      const start=count===1?mids.findIndex(id=>id!==undefined):(mids.findIndex(id=>id===undefined)+1)%3;
      const [a,b,c]=[0,1,2].map(i=>ids[(start+i)%3]),ab=mids[start],bc=mids[(start+1)%3];
      if(count===1)refined.push([a,ab,c],[ab,b,c]);
      else refined.push([a,ab,c],[ab,bc,c],[ab,b,bc]);
    }
    triangles=refined;
    if(triangles.length>1000000)throw new Error('Local terrain refinement exceeded one million triangles');
  }
  const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flatMap(p=>p.slice(0,3)),3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap(p=>p.slice(3)),2));
  result.setIndex(triangles.flat());result.computeVertexNormals();ground.dispose();return result;
}
