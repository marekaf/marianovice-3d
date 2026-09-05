const HiddenBenchModel = (() => {
  function build(garden,terrainPlane,garageGroundPatch) {
    const footprint=garden.elements.find(e=>e.id==='zasivarna').parts.find(p=>p.kind==='rect');
    const {x,y,w,d}=footprint,cx=x+w/2,cy=y+d/2;
    const graded=(px,py)=>{
      const base=Math.max(0,terrainPlane.a*px+terrainPlane.b*py+terrainPlane.c),p=garageGroundPatch;
      const distance=Math.hypot(Math.max(p.x-px,0,px-p.x-p.w),Math.max(p.y-py,0,py-p.y-p.d));
      const t=Math.min(1,distance/p.blend),blend=t*t*(3-2*t);
      return p.level+(base-p.level)*blend;
    };
    const floorHeight=graded(cx,cy),ground=(px,py)=>graded(px,py)-floorHeight,parts=[],feet=[];
    const materials={
      paint:{color:footprint.fill,roughness:0.65,grain:'x'},
      armPaint:{color:footprint.fill,roughness:0.65,grain:'y'},
      paintEdge:{color:'#cc4939',roughness:0.64,grain:'x'},
      metal:{color:'#292d2b',roughness:0.46,metalness:0.72},
      hardware:{color:'#777d77',roughness:0.34,metalness:0.9},
      cap:{color:'#252926',roughness:0.88},
    };
    const box=(name,px,py,pz,width,depth,height,material,bevel=0.003)=>parts.push({name,type:'box',position:[px+width/2,py+depth/2,pz+height/2],size:[width,depth,height],material,bevel,category:'furniture'});
    const beam=(name,start,end,width,depth,material='metal')=>parts.push({name,type:'beam',start,end,width,depth,material,bevel:0.002,category:'furniture'});
    const bolt=(name,position,axis='z')=>parts.push({name,type:'cylinder',position,radiusTop:0.006,radiusBottom:0.006,height:0.003,segments:12,axis,material:'hardware',category:'furniture'});
    const seatHeight=0.45,seatBottom=0.408,frameTop=seatBottom,front=y+0.075,rear=y+d-0.105;
    const supportXs=[x+0.16,x+w-0.16];
    const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
    for(const [i,px] of supportXs.entries()) {
      for(const [j,py] of [front,rear].entries()) {
        const name=`foot_${i}_${j}`,width=0.12,depth=0.086;
        const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[px+a*width/2,py+b*depth/2]);
        const top=Math.max(...corners.map(p=>ground(...p)))+0.012;
        const vertices=[...corners.map(p=>[...p,ground(...p)]),...corners.map(p=>[...p,top])];
        parts.push({name,type:'mesh',vertices,faces,material:'metal',category:'furniture'});
        feet.push({name,center:[px,py],width,depth,bottomCorners:vertices.slice(0,4),topHeight:top,leg:`leg_${i}_${j}`});
        box(`leg_${i}_${j}`,px-0.018,py-0.018,top,0.036,0.036,frameTop-top,'metal');
        box(`leg_cap_${i}_${j}`,px-0.019,py-0.019,frameTop-0.004,0.038,0.038,0.006,'cap',0.002);
        for(const [k,offset] of [-0.044,0.044].entries()) bolt(`foot_bolt_${i}_${j}_${k}`,[px+offset,py,top+0.001]);
        beam(`knee_brace_${i}_${j}`,[px,py,frameTop-0.12],[px,py+(j?-1:1)*0.09,frameTop-0.018],0.022,0.022);
      }
      box(`side_rail_${i}`,px-0.02,front-0.018,frameTop-0.038,0.04,rear-front+0.036,0.038,'metal');
      box(`lower_side_rail_${i}`,px-0.013,front,0.235,0.026,rear-front,0.026,'metal');
    }
    for(const [i,py] of [front,rear].entries()) box(`long_rail_${i}`,supportXs[0],py-0.013,frameTop-0.034,supportXs[1]-supportXs[0],0.026,0.03,'metal');
    box('lower_stretcher',supportXs[0],cy-0.012,0.235,supportXs[1]-supportXs[0],0.024,0.026,'metal');
    for(let i=0;i<5;i++) {
      const py=y+0.035+i*0.072;
      box(`seat_slat_${i}`,x+0.075,py,seatBottom,w-0.15,0.064,seatHeight-seatBottom,'paint',0.005);
      box(`seat_edge_${i}`,x+0.083,py+0.004,seatHeight-0.0005,w-0.166,0.004,0.001,'paintEdge',0.0002);
      for(const [j,px] of supportXs.entries()) {
        bolt(`seat_bolt_${i}_${j}`,[px,py+0.032,seatHeight-0.001]);
        box(`seat_bolt_slot_${i}_${j}`,px-0.004,py+0.031,seatHeight+0.0004,0.008,0.0015,0.0005,'metal',0);
      }
    }
    const backAt=z=>y+d-0.105+(z-frameTop)*0.12;
    for(const [i,px] of supportXs.entries()) {
      beam(`back_stay_${i}`,[px,rear,frameTop-0.1],[px,backAt(0.887),0.887],0.032,0.032);
      box(`back_cap_${i}`,px-0.017,backAt(0.887)-0.017,0.884,0.034,0.034,0.006,'cap',0.002);
      for(const [j,z] of [0.39,0.49].entries()) bolt(`back_mount_bolt_${i}_${j}`,[px,backAt(z)-0.017,z],'y');
    }
    for(let i=0;i<4;i++) {
      const z=0.535+i*0.09,py=backAt(z+0.037)-0.037;
      box(`back_slat_${i}`,x+0.075,py,z,w-0.15,0.027,0.075,'paint',0.005);
      box(`back_edge_${i}`,x+0.083,py-0.0005,z+0.068,w-0.166,0.001,0.004,'paintEdge',0.0002);
      for(const [j,px] of supportXs.entries()) {
        bolt(`back_bolt_${i}_${j}`,[px,py-0.0005,z+0.0375],'y');
        box(`back_bolt_slot_${i}_${j}`,px-0.004,py-0.0021,z+0.037,0.008,0.0005,0.0015,'metal',0);
      }
    }
    for(const [i,px] of [x+0.047,x+w-0.047].entries()) {
      const supportX=supportXs[i],armTop=0.66;
      beam(`arm_front_bracket_${i}`,[supportX,front,frameTop-0.02],[px,front,frameTop-0.02],0.026,0.026);
      beam(`arm_front_post_${i}`,[px,front,frameTop-0.02],[px,front,armTop-0.025],0.026,0.026);
      beam(`arm_rear_bracket_${i}`,[supportX,backAt(armTop-0.04),armTop-0.04],[px,backAt(armTop-0.04),armTop-0.04],0.026,0.026);
      box(`arm_rail_${i}`,px-0.014,front-0.01,armTop-0.044,0.028,backAt(armTop-0.04)-front+0.024,0.026,'metal');
      box(`arm_pad_${i}`,px-0.026,y+0.047,armTop-0.022,0.052,0.365,0.022,'armPaint',0.009);
      for(const [j,py] of [front+0.025,rear-0.025].entries()) bolt(`arm_bolt_${i}_${j}`,[px,py,armTop-0.001]);
      for(const [j,py] of [front,backAt(armTop-0.04)].entries()) box(`arm_cap_${i}_${j}`,px-0.015,py-0.014,armTop-0.045,0.03,0.003,0.029,'cap',0.002);
    }
    return {name:'Hidden bench',materials,parts,lights:[],floorHeight,footprint,feet,seatHeight,backHeight:0.9,facing:'N',
      groundPatches:[garageGroundPatch],plantingClearances:[{x:x-0.1,y:y-0.1,w:w+0.2,d:d+0.2},{x:x-0.1,y:y-0.7,w:w+0.2,d:0.7}]};
  }
  return {build};
})();
if(typeof module!=='undefined') module.exports={HiddenBenchModel};
