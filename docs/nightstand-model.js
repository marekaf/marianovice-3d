export function buildNightstands(data) {
  const parts=[];
  const materials={cashmere:{color:'#b8b2a7',roughness:.75},white:{color:'#f3f2ed',roughness:.75},shadow:{color:'#44423d',roughness:.95}};
  const box=(name,x,z,y,w,d,h,material='cashmere')=>parts.push({name,type:'box',position:[x+w/2,z+d/2,y+h/2],size:[w,d,h],material,bevel:.001,category:'furniture'});
  for(const[index,f]of data.furniture.filter(f=>['1.12','1.04'].includes(f.room)&&f.label.startsWith('noční stolek')).entries()){
    const x=f.x0,z=f.z0,y=f.y0,w=f.x1-x,d=f.z1-z,h=f.h,p=.018,n=`nightstand_${index}`;
    const frontNorth=f.front==='N',backZ=frontNorth?f.z1-p:z,frontZ=frontNorth?z:f.z1-p,revealZ=frontNorth?z+p:f.z1-p-.006;
    box(`${n}_top`,x,z,y+h-p,w,d,p);
    box(`${n}_bottom`,x,z,y,w,d,p);
    box(`${n}_side_W`,x,z,y+p,p,d,h-2*p);
    box(`${n}_side_E`,f.x1-p,z,y+p,p,d,h-2*p);
    box(`${n}_back`,x+p,backZ,y+p,w-2*p,p,h-2*p,'white');
    box(`${n}_reveal`,x+p,revealZ,y+p,w-2*p,.006,h-2*p,'shadow');
    for(let i=0;i<2;i++){
      const bottom=y+.003+i*(h-.006)/2;
      box(`${n}_drawer_front_${i}`,x+.003,frontZ,bottom,w-.006,p,(h-.006)/2-.003);
      box(`${n}_drawer_base_${i}`,x+p,z+p,bottom+.018,w-2*p,d-2*p,.012,'white');
    }
  }
  return {name:'Bedroom two-drawer nightstands',materials,parts,lights:[]};
}
