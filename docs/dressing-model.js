export function buildDressingRoom(data) {
  const parts=[];
  const materials={white:{color:'#f3f2ed',roughness:.75},metal:{color:'#b8bab9',roughness:.3,metalness:.8}};
  for(const [index,f] of data.furniture.filter(f=>f.room==='1.11'&&f.kind==='cab').entries()) {
    const depth=f.x1-f.x0,width=f.z1-f.z0,p=.018,h=2.5,frontDepth=depth-p;
    const zAt=u=>f.front==='E'?f.z1-u:f.z0+u;
    const box=(name,u,v,y,w,d,height,material='white')=>parts.push({name:`dressing_${index}_${name}`,type:'box',
      position:[f.front==='E'?f.x0+v+d/2:f.x1-v-d/2,zAt(u+w/2),y+height/2],size:[d,w,height],material,bevel:.001,category:'furniture'});
    const drawer=(zone,index,u,y,w,height)=>{
      const name=`${zone}_drawer_${index}`;
      box(`${zone}_drawer_front_${index}`,u+.001,frontDepth,y+.001,w-.002,p,height-.002);
      const left=u+p+.004,right=u+w-p-.004,bottom=y+.022,top=y+height-.030;
      const back=p+.004,end=frontDepth-.004;
      box(`${name}_bottom`,left,back,bottom,right-left,end-back,p);
      box(`${name}_side_left`,left,back,bottom+p,p,end-back,top-bottom-p);
      box(`${name}_side_right`,right-p,back,bottom+p,p,end-back,top-bottom-p);
      box(`${name}_back`,left+p,back,bottom+p,right-left-2*p,p,top-bottom-p);
      box(`${name}_inner_front`,left+p,end-p,bottom+p,right-left-2*p,p,top-bottom-p);
    };
    box('bottom',0,0,0,width,depth,p);
    box('top',0,0,h-p,width,frontDepth,p);
    box('side_0',0,0,p,p,frontDepth,h-2*p);
    box('side_1',width-p,0,p,p,frontDepth,h-2*p);
    box('divider',width/2-p/2,p,p,p,frontDepth-p,h-2*p);
    box('back',p,0,p,width-2*p,p,h-2*p);
    const bays=[[p,width/2-p/2],[width/2+p/2,width-p]];
    for(const [column,[start,end]]of bays.entries()){
      const w=end-start;
      for(const [j,y]of [1.9,2.2].entries())box(`upper_shelf_${column}_${j}`,start,p,y,w,frontDepth-p,p);
      parts.push({name:`dressing_${index}_rail_${column}`,type:'cylinder',position:[(f.x0+f.x1)/2,zAt((start+end)/2),1.74],radiusTop:.0125,radiusBottom:.0125,height:w,axis:'y',segments:16,material:'metal',category:'furniture'});
      box(`bottom_zone_top_${column}`,start,p,.518-p,w,frontDepth-p,p);
      for(let row=0;row<2;row++)drawer('bottom',column*2+row,start,p+row*.25,w,.25);
    }
    for(let door=0;door<4;door++)box(`upper_door_${door}`,door*width/4+.001,frontDepth,1.901,width/4-.002,p,.598);
    const leftEnd=bays[0][1],leftStart=leftEnd-.518;
    box('left_insert_side',leftStart,p,.518,p,frontDepth-p,.45);
    box('left_insert_bottom',leftStart+p,p,.518,.518-p,frontDepth-p,p);
    box('left_insert_top',leftStart+p,p,.968-p,.518-p,frontDepth-p,p);
    for(let row=0;row<2;row++)drawer('left',row,leftStart,.518+row*.225,.518,.225);
    const [rightStart,rightEnd]=bays[1],rightWidth=rightEnd-rightStart;
    box('right_insert_bottom',rightStart,p,.518,rightWidth,frontDepth-p,p);
    box('right_insert_top',rightStart,p,.968-p,rightWidth,frontDepth-p,p);
    box('right_insert_divider',rightStart+rightWidth/2-p/2,p,.518+p,p,frontDepth-p,.45-2*p);
    for(let column=0;column<2;column++)for(let row=0;row<3;row++)drawer('right',column*3+row,rightStart+column*rightWidth/2,.518+row*.15,rightWidth/2,.15);
  }
  return {name:'Dressing room hanging bays and drawer inserts',materials,parts,lights:[],
    notes:['Both existing units use the same elevation layout, mirrored to retain its front-left insert on opposing fronts.',
      'The 600 mm installed depth and room placement remain provisional; the cabinet elevation is 1700 by 2500 mm.',
      'Front dimensions use 1 mm edge allowances for 2 mm joints. Rail diameter and drawer-box clearances are illustrative.']};
}
