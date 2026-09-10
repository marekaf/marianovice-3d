export function clipApertures(THREE,geometry,matrixWorld,worldBoxes) {
  const attributes=Object.entries(geometry.attributes);
  const output=Object.fromEntries(attributes.map(([name])=>[name,[]]));
  const result=new THREE.BufferGeometry();
  const vertex=index=>{
    const values=Object.fromEntries(attributes.map(([name,attribute])=>[name,
      Array.from({length:attribute.itemSize},(_,component)=>attribute.getComponent(index,component))]));
    return {values,world:new THREE.Vector3(...values.position).applyMatrix4(matrixWorld).toArray()};
  };
  const interpolate=(a,b,t)=>({
    values:Object.fromEntries(attributes.map(([name])=>[name,a.values[name].map((value,i)=>value+(b.values[name][i]-value)*t)])),
    world:a.world.map((value,i)=>value+(b.world[i]-value)*t),
  });
  function split(polygon,axis,bound,sign) {
    if(polygon.every(v=>(v.world[axis]-bound)*sign>=0))return {inside:polygon,outside:[]};
    if(polygon.every(v=>(v.world[axis]-bound)*sign<=0))return {inside:[],outside:polygon};
    const inside=[],outside=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length];
      const da=(a.world[axis]-bound)*sign,db=(b.world[axis]-bound)*sign;
      if(da>=0)inside.push(a);
      if(da<=0)outside.push(a);
      if(da*db<0){
        const crossing=interpolate(a,b,da/(da-db));
        inside.push(crossing);outside.push(crossing);
      }
    }
    return {inside,outside};
  }
  function subtract(polygon,box) {
    const kept=[];
    let pending=polygon;
    for(let axis=0;axis<3;axis++)for(const [bound,sign] of [[box.min[axis],1],[box.max[axis],-1]]){
      if(pending.length<3)return kept;
      const {inside,outside}=split(pending,axis,bound,sign);
      if(outside.length>=3)kept.push(outside);
      pending=inside;
    }
    return kept;
  }
  const count=geometry.index?.count??geometry.attributes.position.count;
  const groups=geometry.groups.length?geometry.groups:[{start:0,count,materialIndex:0}];
  for(const group of groups){
    const start=output.position.length/3;
    const first=Math.max(group.start,geometry.drawRange.start);
    const end=Math.min(group.start+group.count,count,geometry.drawRange.start+geometry.drawRange.count);
    for(let offset=first;offset+2<end;offset+=3){
      let polygons=[Array.from({length:3},(_,i)=>vertex(geometry.index?geometry.index.getX(offset+i):offset+i))];
      for(const box of worldBoxes)polygons=polygons.flatMap(polygon=>subtract(polygon,box));
      for(const polygon of polygons)for(let i=1;i+1<polygon.length;i++){
        const triangle=[polygon[0],polygon[i],polygon[i+1]];
        const a=new THREE.Vector3(...triangle[0].values.position);
        const b=new THREE.Vector3(...triangle[1].values.position).sub(a);
        const c=new THREE.Vector3(...triangle[2].values.position).sub(a);
        if(b.cross(c).lengthSq()<1e-24)continue;
        for(const v of triangle)for(const [name] of attributes)output[name].push(...v.values[name]);
      }
    }
    const added=output.position.length/3-start;
    if(added)result.addGroup(start,added,group.materialIndex);
  }
  for(const [name,attribute] of attributes)result.setAttribute(name,new THREE.Float32BufferAttribute(output[name],attribute.itemSize));
  result.computeBoundingBox();result.computeBoundingSphere();
  return result;
}
