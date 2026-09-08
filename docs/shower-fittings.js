function hoseCurve(start,end,length) {
  const sample=sag=>Array.from({length:65},(_,i)=>{
    const t=i/64;
    return start.map((v,axis)=>v+(end[axis]-v)*t-(axis===2?4*sag*t*(1-t):0));
  });
  const measured=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...p.map((v,j)=>v-points[i][j])),0);
  let low=0,high=1;
  for(let i=0;i<40;i++){
    const middle=(low+high)/2;
    if(measured(sample(middle))<length)low=middle;else high=middle;
  }
  const points=sample((low+high)/2);
  return {points,length:measured(points)};
}

export function buildShowerFittings(data) {
  const parts=[],showers=[],drains=[],notes=[];
  const materials={
    showerGraphite:{color:'#404746',roughness:.28,metalness:.82},
    showerFace:{color:'#333b3c',roughness:.48,metalness:.22},
    showerNozzle:{color:'#858d88',roughness:.78},
    showerBlackSteel:{color:'#262b2c',roughness:.36,metalness:.85},
    showerDrainGap:{color:'#101314',roughness:.9},
  };
  for(const spec of [
    {room:'1.10',prefix:'main_shower',wall:[.60,.93],normal:[1,0],along:[0,-1]},
    {room:'sprcha',prefix:'guest_shower',wall:[5.20,18.65],normal:[0,-1],along:[-1,0]},
  ]){
    const {prefix,wall,normal,along}=spec;
    const point=(u,h,d)=>[wall[0]+along[0]*u+normal[0]*d,wall[1]+along[1]*u+normal[1]*d,h];
    const cylinder=(name,u,h,d,radius,length,material='showerGraphite',axis=normal[0]?'x':'y')=>parts.push({
      name:`${prefix}_${name}`,type:'cylinder',position:point(u,h,d),radiusTop:radius,radiusBottom:radius,height:length,axis,segments:40,material,category:'furniture',
    });
    cylinder('mixer_rosette',0,1.10,.006,.075,.010);
    cylinder('mixer_hub',0,1.10,.030,.022,.040);
    cylinder('mixer_lever',0,1.069,.058,.006,.073,'showerGraphite','z');
    cylinder('hose_outlet_rosette',-.2,1.10,.007,.025,.012);
    cylinder('hose_outlet',-.2,1.10,.036,.014,.046);
    cylinder('holder_rosette',.2,1.115,.007,.024,.012);
    cylinder('holder_stem',.2,1.115,.043,.014,.060);
    cylinder('handshower_handle',.2,1.165,.080,.013,.220,'showerGraphite','z');
    cylinder('handshower_head',.2,1.30,.081,.065,.026);
    cylinder('handshower_face',.2,1.30,.096,.060,.005,'showerFace');
    for(const [ring,count]of[[.015,8],[.030,14],[.046,20]])for(let i=0;i<count;i++){
      const angle=2*Math.PI*i/count;
      cylinder(`nozzle_${ring}_${i}`,.2+Math.cos(angle)*ring,1.30+Math.sin(angle)*ring,.100,.0017,.002,'showerNozzle');
    }
    const hose=hoseCurve(point(-.2,1.10,.065),point(.2,1.055,.080),1.75),vertices=[],faces=[];
    for(let i=0;i<hose.points.length;i++){
      const p=hose.points[i],a=hose.points[Math.max(0,i-1)],b=hose.points[Math.min(hose.points.length-1,i+1)];
      const tangent=b.map((v,j)=>v-a[j]),length=Math.hypot(...tangent),t=tangent.map(v=>v/length);
      const side=[normal[1]*t[2],-normal[0]*t[2],normal[0]*t[1]-normal[1]*t[0]];
      const sideLength=Math.hypot(...side),unit=side.map(v=>v/sideLength);
      const cross=[t[1]*unit[2]-t[2]*unit[1],t[2]*unit[0]-t[0]*unit[2],t[0]*unit[1]-t[1]*unit[0]];
      for(let j=0;j<8;j++){
        const angle=j*Math.PI/4;
        vertices.push(p.map((v,k)=>v+.006*(Math.cos(angle)*cross[k]+Math.sin(angle)*unit[k])));
        if(i>0)faces.push([(i-1)*8+j,(i-1)*8+(j+1)%8,i*8+(j+1)%8,i*8+j]);
      }
    }
    parts.push({name:`${prefix}_hose`,type:'mesh',vertices,faces,smooth:true,material:'showerGraphite',category:'furniture'});
    showers.push({room:spec.room,mixer:point(0,1.10,0),handshowerDiameter:.13,hoseLength:hose.length,hosePoints:hose.points});
    const glass=data.furniture.find(f=>f.kind==='glass'&&f.room===spec.room);
    const minimum=spec.room==='1.10'?.45:4.70,maximum=spec.room==='1.10'?glass?.z0:glass?.x0;
    const available=maximum-minimum;
    if(!Number.isFinite(available)||available<1-1e-8){
      notes.push(`${spec.room}: ordered 1000 mm drain is not drawn; current glass leaves ${Math.round(available*1000)} mm. Confirm glass position or profile trimming before fitting.`);
      continue;
    }
    const center=(minimum+maximum)/2,depth=.055;
    const drainPosition=spec.room==='1.10'?[wall[0]+depth/2,center,.006]:[center,wall[1]-depth/2,.006];
    const drainSize=spec.room==='1.10'?[depth,1,.004]:[1,depth,.004];
    parts.push({name:`${prefix}_drain_recess`,type:'box',position:drainPosition,size:drainSize,bevel:.001,material:'showerDrainGap',category:'furniture'});
    parts.push({name:`${prefix}_drain_profile`,type:'box',position:[drainPosition[0],drainPosition[1],.008],size:drainSize.map((v,i)=>i===2?.002:v-.006),bevel:.001,material:'showerBlackSteel',category:'furniture'});
    drains.push({room:spec.room,length:1,width:depth,sideClearance:(available-1)/2});
  }
  notes.push('Shower mixers are at 1100 mm above finished floor. Hose outlet and handshower holder are 200 mm either side. Holder height and fitting shapes are illustrative; handshower diameter is 130 mm and hose length is 1750 mm.');
  notes.push('Selected drains are black TECEdrainprofile 1000×55 mm. Floor falls and concealed traps are not modeled. Guest glass currently leaves 1160 mm instead of the 1000 mm shower width in the finish plan; its drain has 80 mm side margins.');
  return {name:'Shower fittings',floorHeight:0,parts,materials,lights:[],showers,drains,notes,presets:{
    mainShower:{position:[1.90,1.55,1.15],target:[.65,.95,.93]},
    guestShower:{position:[5.50,1.55,17.25],target:[5.20,.95,18.60]},
  }};
}
