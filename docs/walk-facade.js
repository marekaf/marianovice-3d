export function removeFacadeLid(geometry) {
  const normals=geometry.attributes.normal,source=geometry.index;
  const kept=[];
  for(let i=0;i<(source?.count??normals.count);i+=3){
    const triangle=[0,1,2].map(offset=>source?source.getX(i+offset):i+offset);
    if(triangle.every(index=>normals.getY(index)>.5))continue;
    kept.push(...triangle);
  }
  geometry.setIndex(kept);
  geometry.clearGroups();
}
