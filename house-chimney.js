export function houseFlue(data) {
  const f=data.fireplace;
  return {x:(f.x0+f.x1)/2,z:f.z1-.21,radius:.09,bottom:1.975,interiorTop:6.95,top:7.75};
}

export function createHouseChimney(THREE,data,{floorY,roofHeight}) {
  const flue=houseFlue(data),x=data.originPlot.x+flue.x,z=data.originPlot.z+flue.z;
  const root=new THREE.Group();root.name='House roof chimney';
  const material=new THREE.MeshStandardMaterial({color:'#181b1c',roughness:.42,metalness:.65});
  const segment=(name,bottom,top)=>{
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(flue.radius,flue.radius,top-bottom,48),material);
    mesh.name=name;mesh.position.set(x,(bottom+top)/2,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const interiorOverlap=segment('Roof flue before furnished interior',roofHeight(x,z)-flue.radius,floorY+flue.interiorTop);
  segment('Roof flue terminal',floorY+flue.interiorTop,floorY+flue.top);
  return {root,interiorOverlap};
}
