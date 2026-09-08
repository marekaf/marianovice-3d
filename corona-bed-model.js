export const CORONA_DIMENSIONS = Object.freeze({width:2.10,mattressWidth:2,mattressLength:2,mattressThickness:.25,recess:.05,legs:.13,frameHeight:.35,sideThickness:.05,headHeight:1.2,headDepth:.08});

export function buildCoronaBed({x0=0,z0=0}={}) {
  const s=CORONA_DIMENSIONS,parts=[];
  const materials={upholstery:{color:'#aaa197',roughness:.95},mattress:{color:'#eeeae2',roughness:.96},linen:{color:'#61775b',roughness:1},pillow:{color:'#9cab8c',roughness:1},steel:{color:'#202121',roughness:.45,metalness:.7},lining:{color:'#55504b',roughness:1},wood:{color:'#c3a784',roughness:.85}};
  const box=(name,x,z,y,w,d,h,material,bevel=.006)=>parts.push({name,type:'box',position:[x0+x+w/2,z0+z+d/2,y+h/2],size:[w,d,h],material,bevel,category:'furniture'});
  const length=s.headDepth+s.mattressLength+s.sideThickness,frameTop=s.legs+s.frameHeight,mattressBottom=frameTop-s.recess;
  box('corona_headboard',0,0,s.legs,s.width,s.headDepth,s.headHeight-s.legs,'upholstery',.012);
  for(let row=0;row<4;row++) {
    const split=row%2?1.22:.88,height=(s.headHeight-s.legs)/4;
    for(const [i,x,w] of [[0,0,split],[1,split,s.width-split]])box(`head_pad_${row}_${i}`,x+.004,s.headDepth-.023,s.legs+row*height+.004,w-.008,.03,height-.008,'upholstery',.01);
  }
  for(const [i,x] of [0,s.width-s.sideThickness].entries())box(`side_${i}`,x,s.headDepth,s.legs,s.sideThickness,length-s.headDepth,s.frameHeight,'upholstery',.012);
  box('foot',s.sideThickness,length-s.sideThickness,s.legs,s.mattressWidth,s.sideThickness,s.frameHeight,'upholstery',.012);
  for(const [i,x] of [.08,s.width-.12].entries())for(const [j,z] of [.12,length-.15].entries())box(`industry_leg_${i}_${j}`,x,z,0,.04,.07,s.legs,'steel',.003);
  box('storage_floor',s.sideThickness,s.headDepth,s.legs+.015,s.mattressWidth,s.mattressLength,.015,'lining');
  box('storage_divider',s.width/2-.009,s.headDepth,s.legs+.03,.018,s.mattressLength,mattressBottom-s.legs-.06,'lining');
  for(let half=0;half<2;half++) {
    const x=s.sideThickness+half;
    for(const [i,u] of [x+.012,x+.965].entries())box(`lift_rail_${half}_${i}`,u,s.headDepth+.02,mattressBottom-.035,.023,1.96,.025,'steel');
    for(let slat=0;slat<24;slat++)box(`slat_${half}_${slat}`,x+.035,s.headDepth+.035+slat*.08,mattressBottom-.018,.93,.055,.012,'wood',.003);
  }
  box('mattress',s.sideThickness,s.headDepth,mattressBottom,s.mattressWidth,s.mattressLength,s.mattressThickness,'mattress',.035);
  box('duvet',s.sideThickness+.012,s.headDepth+.53,.683,1.976,1.44,.06,'linen',.027);
  box('duvet_fold',s.sideThickness+.012,s.headDepth+.53,.742,1.976,.20,.025,'linen',.012);
  for(let i=0;i<2;i++)box(`pillow_${i}`,s.sideThickness+.06+i,.14,.681,.87,.42,.10,'pillow',.045);
  return {name:'CORONA upholstered storage bed',materials,parts,lights:[],dimensions:{...s,length,frameTop,mattressTop:mattressBottom+s.mattressThickness},notes:['Headboard depth and upholstery colour are visual estimates; NOVEL 11 swatch not colour-calibrated. Storage is shown closed.']};
}
