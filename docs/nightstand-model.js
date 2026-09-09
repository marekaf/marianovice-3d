export function buildNightstands(data) {
  const parts=[];
  const materials={cashmere:{color:'#b8b2a7',roughness:.75}};
  const box=(name,x,z,y,w,d,h,material='cashmere')=>parts.push({name,type:'box',position:[x+w/2,z+d/2,y+h/2],size:[w,d,h],material,bevel:.001,category:'furniture'});
  for(const[index,f]of data.furniture.filter(f=>['1.12','1.04'].includes(f.room)&&f.label.startsWith('noční stolek')).entries()){
    const x=f.x0,z=f.z0,y=f.y0,w=f.x1-x,d=f.z1-z,h=f.h,p=.018,n=`nightstand_${index}`;
    const socketNiche=f.room==='1.12',frontNorth=f.front==='N';
    const backZ=frontNorth?f.z1-p:z,frontZ=frontNorth?z-p:f.z1;
    const bodyZ=z,bodyDepth=d,division=y+h/2;
    box(`${n}_top`,x,bodyZ,y+h-p,w,bodyDepth,p);
    box(`${n}_bottom`,x,bodyZ,y,w,bodyDepth,p);
    box(`${n}_side_W`,x,bodyZ,y+p,p,bodyDepth,h-2*p);
    box(`${n}_side_E`,f.x1-p,bodyZ,y+p,p,bodyDepth,h-2*p);
    box(`${n}_back`,x+p,backZ,y+p,w-2*p,p,(socketNiche?division-p/2:y+h-p)-y-p);
    box(`${n}_divider`,x+p,bodyZ,division-p/2,w-2*p,bodyDepth,p);
    const rows=socketNiche?[[y-.01,division]]:[[y-.01,division-.001],[division+.001,y+h+.01]];
    for(const [row,[bottom,top]]of rows.entries()){
      box(`${n}_drawer_front_${row}`,x,frontZ,bottom,w,p,top-bottom);
      const innerBottom=row===0?y+p:division+p/2;
      const innerTop=row===0?division-p/2:y+h-p;
      const drawerZ=bodyZ+(frontNorth?0:p)+.006,drawerDepth=bodyDepth-p-.012,drawerW=w-2*p-.012;
      box(`${n}_drawer_base_${row}`,x+p+.006,drawerZ,innerBottom+.004,drawerW,drawerDepth,.012);
      box(`${n}_drawer_side_W_${row}`,x+p+.006,drawerZ,innerBottom+.016,.012,drawerDepth,innerTop-innerBottom-.024);
      box(`${n}_drawer_side_E_${row}`,f.x1-p-.018,drawerZ,innerBottom+.016,.012,drawerDepth,innerTop-innerBottom-.024);
    }
  }
  return {name:'Bedroom socket-niche and guest two-drawer nightstands',materials,parts,lights:[]};
}
