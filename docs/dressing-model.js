export function buildDressingRoom(data) {
  const parts=[];
  const materials={white:{color:'#f3f2ed',roughness:.75},metal:{color:'#b8bab9',roughness:.3,metalness:.8}};
  for(const [index,f] of data.furniture.filter(f=>f.room==='1.11'&&f.kind==='cab').entries()) {
    const depth=f.x1-f.x0,width=f.z1-f.z0,p=.018,h=f.h;
    const box=(name,u,v,y,w,d,height,material='white')=>parts.push({name:`dressing_${index}_${name}`,type:'box',
      position:[f.front==='E'?f.x0+v+d/2:f.x1-v-d/2,f.z0+u+w/2,y+height/2],size:[d,w,height],material,bevel:.001,category:'furniture'});
    box('bottom',0,0,0,width,depth,p);
    box('top',0,0,h-p,width,depth,p);
    box('side_0',0,0,p,p,depth,h-2*p);
    box('side_1',width-p,0,p,p,depth,h-2*p);
    box('divider',width/2-p/2,0,p,p,depth,h-2*p);
    box('back',p,0,p,width-2*p,p,h-2*p);
    for(let column=0;column<2;column++) {
      const start=column*width/2+p,end=(column+1)*width/2-p,w=end-start;
      for(const [j,y] of [1.9,2.21].entries())box(`upper_shelf_${column}_${j}`,start,p,y,w,depth-p,p);
      parts.push({name:`dressing_${index}_rail_${column}`,type:'cylinder',position:[(f.x0+f.x1)/2,f.z0+(start+end)/2,1.79],radiusTop:.0125,radiusBottom:.0125,height:w,axis:'y',segments:16,material:'metal',category:'furniture'});
      box(`lower_top_${column}`,start,p,.9-p,w,depth-p,p);
      const drawers=column===(f.front==='E'?1:0);
      if(drawers) {
        for(let drawer=0;drawer<4;drawer++) {
          const bottom=p+drawer*(.9-2*p)/4;
          box(`drawer_front_${drawer}`,start+.002,depth-p,bottom+.002,w-.004,p,(.9-2*p)/4-.004);
          box(`drawer_base_${drawer}`,start+p,p,bottom+.018,w-2*p,depth-2*p,.012);
        }
      } else for(const [j,y] of [.31,.60].entries())box(`lower_shelf_${column}_${j}`,start,p,y,w,depth-p,p);
    }
  }
  return {name:'Open dressing room shelves rails and drawers',materials,parts,lights:[]};
}
