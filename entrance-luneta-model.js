import {entranceLanding} from './entrance-landing.js';

export function entranceLunetaPavingDatum(house,garden,sampleFinish,{variant='straight'}={}) {
  const model=buildEntranceLuneta(house,garden,1,.49,{variant}),footprint=model.dimensions.footprint;
  const paving=garden.elements.find(element=>element.id==='carport')?.parts.find(part=>part.kind==='rect');
  if(!paving)throw new Error('Carport pavement is required');
  const x0=Math.max(footprint.x0,paving.x),x1=Math.min(footprint.x1,paving.x+paving.w),z0=Math.max(footprint.z0,paving.y),z1=Math.min(footprint.z1,paving.y+paving.d);
  if(x1<=x0||z1<=z0)throw new Error('Entrance must meet the carport pavement');
  const levels=[x0,x1].flatMap(x=>[z0,z1].map(z=>sampleFinish(x,z)));
  if(!levels.every(Number.isFinite))throw new Error('Entrance pavement requires finite finish levels');
  return Math.min(...levels);
}

export function buildEntranceLuneta(house,garden,floorY,pavingY,{variant='straight'}={}) {
  if(!['sketch','aligned','straight'].includes(variant))throw new Error('Unknown entrance variant');
  if(!Number.isFinite(floorY)||!Number.isFinite(pavingY)||floorY-pavingY<=.18||floorY-pavingY>=.8)throw new Error('Entrance requires finite floor and paving levels with a supported stair rise');
  const entry=house.exteriorOpenings().find(item=>item.model.opening.kind==='entrance');
  const facadeX=garden.elements.find(element=>element.id==='house')?.meta.eNotch[0];
  if(!entry||!Number.isFinite(facadeX))throw new Error('House entrance and facade are required');
  const bridge=entranceLanding(entry,house.originPlot,facadeX,floorY,pavingY);
  const wrapping=variant!=='straight',southTread=wrapping?.325:0;
  const zSouth=variant==='sketch'?22.53:bridge.z1,zNorth=zSouth-1.5,rise=(floorY-pavingY)/3;
  const parts=[],walkSurfaces=[],base=floorY-.8;
  const box=(name,x0,x1,z0,z1,bottom,top,material)=>{
    if(!(x1>x0&&z1>z0&&top>bottom))throw new Error(`Invalid entrance part ${name}`);
    parts.push({name,type:'box',position:[(x0+x1)/2,(z0+z1)/2,(top+bottom)/2],size:[x1-x0,z1-z0,top-bottom],material,category:'structure',bevel:material==='luneta'?.002:material==='paving'?.001:0});
  };
  const surface=(name,x0,x1,z0,z1,y,edgeX=x1,edgeZ=z1)=>{
    const rect={name,x0,x1,z0,z1,y};walkSurfaces.push(rect);
    box(`${name}_fill`,x0,edgeX,z0,edgeZ,base,y-.06,'stairFill');
    const nx=Math.ceil((x1-x0)/.2),nz=Math.ceil((z1-z0)/.1);
    for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
      const xa=x0+ix*.2,xb=Math.min(edgeX,xa+.2),za=z0+iz*.1,zb=Math.min(edgeZ,za+.1);
      if(xb<=xa+1e-9||zb<=za+1e-9)continue;
      box(`${name}_paver_${ix}_${iz}`,xa,xb,za,zb,y-.06,y,'paving');
    }
  };
  surface('entrance_reveal',bridge.x0,bridge.x1,bridge.z0,bridge.z1,floorY);
  surface('entrance_landing',facadeX,facadeX+.7,zNorth,zSouth,floorY,facadeX+.6,zSouth-.1);
  for(let i=1;i<=2;i++){
    const previousX=facadeX+.7+(i-1)*.3,x=previousX+.3,previousZ=zSouth+(i-1)*southTread,z=previousZ+southTread,y=floorY-i*rise;
    surface(`entrance_east_${i}`,previousX,x,zNorth,previousZ,y,x-.1,wrapping?previousZ:previousZ-.1);
    if(wrapping)surface(`entrance_south_${i}`,facadeX+.7,x,previousZ,z,y,x-.1,z-.1);
  }
  const palisade=(name,x0,x1,z0,z1,top)=>{
    const alongX=x1-x0>z1-z0,length=alongX?x1-x0:z1-z0,n=Math.ceil(length/.1);
    for(let i=0;i<n;i++){
      const a=length*i/n,b=length*(i+1)/n;
      box(`${name}_${i}`,x0+(alongX?a:0),alongX?x0+b:x1,z0+(alongX?0:a),alongX?z1:z0+b,base,top,'palisade');
    }
  };
  for(let i=0;i<3;i++){
    const x=facadeX+.7+i*.3,z=zSouth+i*southTread,y=floorY-i*rise;
    palisade(`east_riser_${i}`,x-.1,x,zNorth,z-.1,y);
    palisade(`south_riser_${i}`,i===0?facadeX:wrapping?facadeX+.7:x-.3,x,z-.1,z,y);
  }
  const wall={blockLength:.4,blockWidth:.2,courseHeight:.2,courses:4,top:floorY,bottom:base};
  const wallSegments=[
    {name:'stair_north',x0:facadeX,x1:facadeX+1.3,z0:zNorth-.2,z1:zNorth},
    {name:'recess_east',x0:facadeX+1.1,x1:facadeX+1.3,z0:19.43,z1:zNorth-.2},
    {name:'terrace_south',x0:facadeX+1.1,x1:24.48,z0:19.23,z1:19.43},
    {name:'garden_return',x0:24.48,x1:24.68,z0:18.43,z1:19.43,proposal:true}
  ].map(segment=>({...segment,courses:4,top:floorY,bottom:base}));
  for(const segment of wallSegments){
    const alongX=segment.x1-segment.x0>segment.z1-segment.z0,length=alongX?segment.x1-segment.x0:segment.z1-segment.z0;
    for(let course=0;course<4;course++){
      let a=0,i=0;
      while(a<length-1e-8){
        const b=Math.min(length,a+(i===0&&course%2===1?.2:.4));
        box(`luneta_${segment.name}_${course}_${i}`,segment.x0+(alongX?a:0),alongX?segment.x0+b:segment.x1,segment.z0+(alongX?0:a),alongX?segment.z1:segment.z0+b,base+course*.2,base+(course+1)*.2,'luneta');
        a=b;i++;
      }
    }
  }
  const soil={x0:facadeX,x1:facadeX+1.1,z0:19.23,z1:zNorth-.2,y:floorY-.05};
  box('entrance_recess_soil',soil.x0,soil.x1,soil.z0,soil.z1,base,soil.y,'soil');
  const proposedFill={x0:23.58,x1:24.48,z0:18.43,z1:19.23,y:floorY-.05,bottom:base,proposal:true};
  box('garden_return_fill',proposedFill.x0,proposedFill.x1,proposedFill.z0,proposedFill.z1,base,proposedFill.y,'soil');
  return {name:'entrance_luneta',floorHeight:0,materials:{paving:{color:'#b9b4ab',roughness:.9},palisade:{color:'#aaa69b',roughness:.9},stairFill:{color:'#8c8170',roughness:1},luneta:{color:'#a59c88',roughness:1},soil:{color:'#5d4b3a',roughness:1}},parts,lights:[],walkSurfaces,soil,proposedFill,wallSegments,
    dimensions:{variant,facadeX,landingDepth:.7,upperWidth:1.5,eastTread:.3,southTread,risers:3,rise,floorY,pavingY,zNorth,zSouth,footprint:{x0:facadeX,x1:facadeX+1.3,z0:zNorth,z1:zSouth+2*southTread},wall}};
}
