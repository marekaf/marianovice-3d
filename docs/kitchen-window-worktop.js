export function kitchenWindowWorktopLayout(data) {
  const cabinet=data.furniture.find(f=>f.label?.startsWith('kuchyň L-leg'));
  const top=cabinet?.worktop||cabinet?.kitchenWindowWorktop;
  const wall=data.extWalls.find(w=>w.id==='W9');
  if(!top||!wall)throw new Error('Kitchen window worktop requires the L-leg and W9 opening');
  const opening=wall.openings[0],model=data.buildOpening(wall,opening,0);
  const frame=model.parts.find(p=>p.name.endsWith('_frame_north'));
  const xFrame=frame.position[0]-frame.size[0]/2;
  const z0=model.opening.center-model.opening.width/2,z1=z0+model.opening.width;
  const bottom=(cabinet.y0||0)+cabinet.h;
  return {outline:[[top.x0,top.z0],[top.x1,top.z0],[top.x1,z0],[xFrame,z0],
    [xFrame,z1],[top.x1,z1],[top.x1,top.z1],[top.x0,top.z1]],
    bottom,thickness:top.th,frameContact:xFrame,reveal:[z0,z1],front:top.x0};
}

export function prepareKitchenWindowData(data) {
  return {...data,furniture:data.furniture.map(f=>f.label?.startsWith('kuchyň L-leg')
    ? {...f,kitchenWindowWorktop:f.worktop||f.kitchenWindowWorktop,worktop:null}:f)};
}

export function attachKitchenWindowWorktop(THREE,house,data) {
  const layout=kitchenWindowWorktopLayout(data),shape=new THREE.Shape();
  layout.outline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:layout.thickness,bevelEnabled:false,steps:1});
  geometry.rotateX(-Math.PI/2);
  const material=new THREE.MeshStandardMaterial({color:'#b8b2a7',roughness:.45});
  material.name='cashmereTop';
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='Kitchen worktop and window sill';
  mesh.position.y=house.dims.floorY+layout.bottom;
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.layout=layout;
  house.furniture.add(mesh);
  return {mesh,layout};
}
