export function capRoofWall(THREE,mesh,{slope,intercept,maxHeight},{offset=[0,0,0]}={}) {
  mesh.updateWorldMatrix(true,false);
  const transform=new THREE.Matrix4().makeTranslation(...offset).multiply(mesh.matrixWorld);
  const inverse=transform.clone().invert(),point=new THREE.Vector3();
  const original=mesh.geometry,positions=original.attributes.position;
  let needsCap=false;
  for(let i=0;i<positions.count;i++){
    point.fromBufferAttribute(positions,i).applyMatrix4(transform);
    if(point.y>Math.min(maxHeight,slope*point.x+intercept)+1e-6){needsCap=true;break;}
  }
  if(!needsCap)return false;
  const source=original.index?original.toNonIndexed():original;
  const attributes=Object.entries(source.attributes),values=Object.fromEntries(attributes.map(([name])=>[name,[]]));
  const crossover=(maxHeight-intercept)/slope;
  function vertex(index){
    const attrs=Object.fromEntries(attributes.map(([name,attribute])=>[name,Array.from({length:attribute.itemSize},(_,axis)=>attribute.getComponent(index,axis))]));
    return {attrs,x:point.fromArray(attrs.position).applyMatrix4(transform).x};
  }
  function split(polygon,sign){
    const result=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=sign*(a.x-crossover)>=0,insideB=sign*(b.x-crossover)>=0;
      if(insideA)result.push(a);
      if(insideA!==insideB){
        const t=(crossover-a.x)/(b.x-a.x);
        result.push({x:crossover,attrs:Object.fromEntries(attributes.map(([name])=>[name,a.attrs[name].map((v,j)=>v+(b.attrs[name][j]-v)*t)]))});
      }
    }
    return result;
  }
  const geometry=new THREE.BufferGeometry();
  for(const group of source.groups.length?source.groups:[{start:0,count:source.attributes.position.count,materialIndex:0}]){
    const start=values.position.length/3;
    for(let i=group.start;i<group.start+group.count;i+=3){
      const triangle=[vertex(i),vertex(i+1),vertex(i+2)];
      const crosses=triangle.some(v=>v.x<crossover)&&triangle.some(v=>v.x>crossover);
      for(const polygon of crosses?[split(triangle,-1),split(triangle,1)]:[triangle])for(let j=1;j<polygon.length-1;j++)for(const v of[polygon[0],polygon[j],polygon[j+1]]){
        point.fromArray(v.attrs.position).applyMatrix4(transform);
        point.y=Math.min(point.y,maxHeight,slope*point.x+intercept);
        point.applyMatrix4(inverse);
        for(const [name]of attributes)values[name].push(...(name==='position'?point.toArray():v.attrs[name]));
      }
    }
    geometry.addGroup(start,values.position.length/3-start,group.materialIndex);
  }
  for(const [name,attribute]of attributes)geometry.setAttribute(name,new THREE.Float32BufferAttribute(values[name],attribute.itemSize));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  mesh.geometry=geometry;
  if(source!==original)source.dispose();
  original.dispose();
  mesh.userData.roofWallCap=true;
  return true;
}
