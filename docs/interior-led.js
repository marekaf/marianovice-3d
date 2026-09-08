export function attachInteriorLed(THREE,house,data) {
  const group=new THREE.Group();group.name='Interior LED lighting';
  const fixtures=[],lights=[],notes=[];
  const aluminium=new THREE.MeshStandardMaterial({color:'#777976',roughness:.44,metalness:.65});
  const diffuser=new THREE.MeshStandardMaterial({color:'#fff2d6',emissive:'#ffce89',emissiveIntensity:2.3,roughness:.5});
  const find=label=>{
    const index=data.furniture.findIndex(f=>f.label===label);
    if(index<0)throw new Error(`Missing LED support: ${label}`);
    return {fixture:data.furniture[index],index};
  };
  const strip=(name,start,end,normal,room,power=.45)=>{
    const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),n=new THREE.Vector3(...normal);
    const direction=b.clone().sub(a),length=direction.length(),unit=direction.clone().normalize();
    const cross=new THREE.Vector3().crossVectors(unit,n).normalize();
    const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(unit,n,cross));
    const fixture=new THREE.Group();fixture.name=name;
    const midpoint=a.clone().add(b).multiplyScalar(.5);
    const channel=new THREE.Mesh(new THREE.BoxGeometry(length,.008,.018),aluminium);
    channel.position.copy(midpoint);channel.quaternion.copy(rotation);fixture.add(channel);
    const cover=new THREE.Mesh(new THREE.BoxGeometry(length-.008,.002,.011),diffuser);
    cover.position.copy(midpoint).addScaledVector(n,.005);cover.quaternion.copy(rotation);fixture.add(cover);
    const light=new THREE.RectAreaLight('#ffd5a3',power*180,length-.008,.011);
    light.position.copy(midpoint).addScaledVector(n,.007);
    light.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(unit,cross,n.clone().negate()));
    fixture.add(light);lights.push(light);
    group.add(fixture);
    fixtures.push({name,room,start:[...start],end:[...end],normal:[...normal],length,temperatureK:3000,lightCount:1});
  };
  const run=find('kuchyň uppers 1050').fixture;
  strip('Kitchen upper strip',[run.x0+.03,run.y0-.004,run.z1-.035],[run.x1-.03,run.y0-.004,run.z1-.035],[0,-1,0],run.room);
  const island=find('ostrov 2×960').fixture,top=island.worktop;
  strip('Island overhang strip',[top.x0+.045,island.h-.004,top.z1-.045],[top.x1-.045,island.h-.004,top.z1-.045],[0,-1,0],island.room,.30);
  const niche=find('nika uppers').fixture;
  strip('Coffee niche strip',[niche.x1-.045,niche.y0-.004,niche.z0+.03],[niche.x1-.045,niche.y0-.004,niche.z1-.03],[0,-1,0],niche.room);
  const windowTop=find('okno horní pás').fixture;
  strip('Sitting window strip',[windowTop.x0+.035,windowTop.y0-.004,windowTop.z0+.025],[windowTop.x0+.035,windowTop.y0-.004,windowTop.z1-.025],[0,-1,0],windowTop.room,.40);
  const bedIndex=data.furniture.findIndex(f=>f.kind==='bed'&&f.room==='1.12');
  if(bedIndex<0)throw new Error('Missing bedroom bed');
  const bed=data.furniture[bedIndex],headboard=FurnitureModel.build([bed]).parts.find(p=>p.name.endsWith('_headboard'));
  if(!headboard)throw new Error('Missing bedroom headboard geometry');
  const headTop=headboard.position[2]+headboard.size[2]/2;
  if((bed.head??'N')!=='N')throw new Error('Bedroom headboard strip requires north headboard');
  strip('Bed headboard strip',[bed.x0+.035,headTop+.004,bed.z0+.020],[bed.x1-.035,headTop+.004,bed.z0+.020],[0,1,0],bed.room,.24);
  for(const room of ['1.10','1.03']) {
    const {fixture:mirror}=find(`zrcadlo ${room}`);
    const north=room==='1.10';
    const low=mirror.y0+.035,high=mirror.y0+mirror.h-.035;
    const left=(north?mirror.x0:mirror.z0)+.035,right=(north?mirror.x1:mirror.z1)-.035;
    const back=(north?mirror.z1:mirror.x1)+.004;
    const point=(u,y)=>north?[u,y,back]:[back,y,u],normal=north?[0,0,1]:[1,0,0];
    for(const[edge,a,b]of[['top',point(left,high),point(right,high)],['bottom',point(left,low),point(right,low)],
      ['left',point(left,low),point(left,high)],['right',point(right,low),point(right,high)]]) {
      strip(`Bathroom ${room} mirror ${edge}`,a,b,normal,room,.055);
    }
    notes.push(`Bathroom ${room} mirror stands 25 mm farther from its wall for concealed perimeter lighting.`);
  }
  notes.push('3000 K warm-white appearance and light output are visualization settings, not an electrical or photometric specification.');
  house.furniture.add(group);
  return {group,fixtures,lights,notes};
}
