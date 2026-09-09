const RaisedBedsModel = (() => {
  function build(garden, options = {}) {
    const rectOf = id => garden.elements.find(e=>e.id===id).parts.find(p=>p.kind==='rect');
    const pad=rectOf('raisedBedsPad'),grading=garden.elements.find(e=>e.id==='raisedBedsPad').meta.grading;
    const floorHeight=options.surfaceHeight?.(pad.x+pad.w/2,pad.y+pad.d/2)??grading.level+.06,soilHeight=0.53,height=0.6;
    const materials={
      gravel:{color:'#b9b0a0',roughness:0.98},
      gravelLight:{color:'#c9c0ae',roughness:0.98},
      gravelDark:{color:'#998f7e',roughness:0.98},
      liner:{color:'#343a33',roughness:0.92},
      soil:{color:'#4a3a2a',roughness:0.99},
      soilClod:{color:'#594330',roughness:0.99},
      hardware:{color:'#949b96',roughness:0.4,metalness:0.78},
      hose:{color:'#303830',roughness:0.92},
      label:{color:'#d1be96',roughness:0.78},
      stem:{color:'#648544',roughness:0.9},
      lettuce:{color:'#83a34f',roughness:0.86},
      lettuceLight:{color:'#a0b75f',roughness:0.87},
      herb:{color:'#5b8b4e',roughness:0.87},
      kale:{color:'#426d4e',roughness:0.87},
      kaleLight:{color:'#628556',roughness:0.88},
      tomatoLeaf:{color:'#527f3f',roughness:0.87},
      tomato:{color:'#b9442c',roughness:0.47},
      tomatoGreen:{color:'#849446',roughness:0.57},
      tie:{color:'#b29d75',roughness:0.95},
    };
    for(const axis of ['x','y','z']) for(let shade=0;shade<3;shade++) materials[`wood_${axis}_${shade}`]={
      color:['#92704d','#a27e56','#987550'][shade],roughness:0.82,grain:axis};
    const parts=[],beds=[],plants=[];
    const box=(name,x,y,z,w,d,h,material,category='structure',bevel=0.003)=>{
      parts.push({name,type:'box',position:[x+w/2,y+d/2,z+h/2],size:[w,d,h],material,category,bevel});
    };
    const beam=(name,start,end,width,depth,material,category='furniture')=>{
      parts.push({name,type:'beam',start,end,width,depth,material,category,bevel:0.001});
    };
    const cylinder=(name,position,radius,h,material,axis='z',category='structure')=>{
      parts.push({name,type:'cylinder',position,radiusTop:radius,radiusBottom:radius,height:h,axis,material,category,segments:16});
    };
    const random=seed=>{const value=Math.sin(seed*127.1+311.7)*43758.5453;return value-Math.floor(value);};
    const pebble=(name,x,y,surface,radius,seed,material)=>{
      const top=surface+0.005+random(seed+1)*0.006;
      const vertices=[[x+radius*0.12,y-radius*0.09,top],[x,y,surface-0.004]],faces=[];
      for(let i=0;i<6;i++) {
        const angle=i*Math.PI/3+random(seed+2)*Math.PI;
        const r=radius*(0.72+random(seed+i+3)*0.28);
        vertices.push([x+Math.cos(angle)*r,y+Math.sin(angle)*r*0.78,surface+0.001+random(seed+i+9)*0.002]);
      }
      for(let i=0;i<6;i++) {const a=i+2,b=(i+1)%6+2;faces.push([0,a,b],[1,b,a]);}
      parts.push({name,type:'mesh',vertices,faces,material,category:'structure'});
    };
    const leaf=(name,root,angle,length,width,rise,material,ruffle=0)=>{
      const vertices=[],faces=[],segments=12,columns=5,half=0.0007;
      for(let layer=0;layer<2;layer++) for(let i=0;i<=segments;i++) {
        const t=i/segments,envelope=Math.sin(Math.PI*t)**0.75;
        for(const side of [-1,-0.5,0,0.5,1]) {
          const along=length*t,cross=side*width/2*envelope*(1+ruffle*Math.sin(t*Math.PI*5));
          const arch=length*0.24*Math.sin(Math.PI*t),curl=side*side*width*0.13*envelope;
          vertices.push([root[0]+Math.cos(angle)*along-Math.sin(angle)*cross,
            root[1]+Math.sin(angle)*along+Math.cos(angle)*cross,
            root[2]+rise*t+arch+curl+(layer?half:-half)]);
        }
      }
      const count=(segments+1)*columns;
      for(let i=0;i<segments;i++) for(let j=0;j<columns-1;j++) {
        const a=i*columns+j,b=a+columns,c=b+1,d=a+1;
        faces.push([a,d,c,b],[a+count,b+count,c+count,d+count]);
      }
      const boundary=[...Array.from({length:columns},(_,i)=>i),
        ...Array.from({length:segments},(_,i)=>(i+1)*columns+columns-1),
        ...Array.from({length:columns-1},(_,i)=>segments*columns+columns-2-i),
        ...Array.from({length:segments-1},(_,i)=>(segments-1-i)*columns)];
      for(let i=0;i<boundary.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length];faces.push([a,a+count,b+count,b]);}
      parts.push({name,type:'mesh',vertices,faces,smooth:true,material,category:'furniture'});
    };
    const bedIds=['raisedBed1','raisedBed2','raisedBed3','raisedBed4'];
    const bedRects=bedIds.map(rectOf);
    let surfaceFootprint={kind:'rect',...pad};
    if(options.court) {
      const c=options.court;
      surfaceFootprint={kind:'rect',x:c.x0,y:c.z0,w:c.x1-c.x0,d:c.z1-c.z0};
      const greenhouse=rectOf('greenhouse'),compost=rectOf('compost');
      const exclusions=[...bedRects,greenhouse,compost,{x:greenhouse.x+greenhouse.w/2-.57,y:greenhouse.y-.38,w:1.14,d:.38}];
      const axis=(start,end,edges)=>[...new Set([start,end,...edges.filter(v=>v>start&&v<end),...Array.from({length:Math.ceil((end-start)/.1)},(_,i)=>Math.min(end,start+i*.1))])].sort((a,b)=>a-b);
      const xs=axis(c.x0,c.x1,[...c.aisles.flat(),...exclusions.flatMap(r=>[r.x,r.x+r.w])]);
      const ys=axis(c.z0,c.z1,exclusions.flatMap(r=>[r.y,r.y+r.d]));
      const vertices=[],faces=[],edges=new Map();
      for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++) {
        const x0=xs[i-1],x1=xs[i],y0=ys[j-1],y1=ys[j],cx=(x0+x1)/2,cy=(y0+y1)/2;
        if(x1-x0<1e-8||y1-y0<1e-8||exclusions.some(r=>cx>r.x&&cx<r.x+r.w&&cy>r.y&&cy<r.y+r.d))continue;
        const at=vertices.length;
        for(const [x,y]of [[x0,y0],[x1,y0],[x1,y1],[x0,y1]])vertices.push([x,y,options.surfaceHeight(x,y)-floorHeight]);
        faces.push([at,at+1,at+2],[at,at+2,at+3]);
        for(let k=0;k<4;k++) {
          const a=vertices[at+k],b=vertices[at+(k+1)%4],key=[a.slice(0,2).join(','),b.slice(0,2).join(',')].sort().join('|');
          if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);
        }
      }
      for(const [a,b]of edges.values()) {
        const at=vertices.length;
        vertices.push(a,b,[b[0],b[1],options.groundHeight(b[0],b[1])-floorHeight-.005],[a[0],a[1],options.groundHeight(a[0],a[1])-floorHeight-.005]);
        faces.push([at,at+2,at+1],[at,at+3,at+2]);
      }
      parts.push({name:'raised_beds_gravel',type:'mesh',vertices,faces,material:'gravel',category:'ground'});
    } else box('raised_beds_gravel',pad.x,pad.y,-0.06,pad.w,pad.d,0.06,'gravel','structure',0.002);
    for(let candidate=0,placed=0;candidate<2000&&placed<160;candidate++) {
      const seed=candidate*19,radius=0.012+random(seed+3)*0.016;
      const x=pad.x+radius+random(seed)*(pad.w-2*radius),y=pad.y+radius+random(seed+1)*(pad.d-2*radius);
      if(bedRects.some(r=>x>r.x-radius&&x<r.x+r.w+radius&&y>r.y-radius&&y<r.y+r.d+radius)) continue;
      pebble(`gravel_piece_${placed++}`,x,y,options.surfaceHeight?options.surfaceHeight(x,y)-floorHeight:0,radius,seed,['gravel','gravelLight','gravelDark'][candidate%3]);
    }
    for(const [bedIndex,id] of bedIds.entries()) {
      const rect=rectOf(id),{x,y,w,d}=rect,wall=0.04,liner=0.003;
      const partStart=parts.length,plantStart=plants.length;
      const bedFloor=options.surfaceHeight?Math.max(...[x,x+w].flatMap(px=>[y,y+d].map(py=>options.surfaceHeight(px,py)))):floorHeight;
      const bedOffset=bedFloor-floorHeight;
      const bottomAt=(px,py)=>options.groundHeight?options.groundHeight(px,py)-bedFloor-.025:0;
      const crop=['lettuce','herbs','kale','tomatoes'][bedIndex];
      beds.push({id,rect,height,soilHeight,crop,...(options.surfaceHeight?{floorHeight:bedFloor}: {})});
      for(let course=0;course<3;course++) {
        const base=course*0.2,bh=0.196;
        for(const [side,px] of [['W',x],['E',x+w-wall]]) box(`${id}_wall_${side}_${course}`,
          px,y,base,wall,d,bh,`wood_y_${(course+bedIndex)%3}`);
        for(const [side,py] of [['N',y],['S',y+d-wall]]) box(`${id}_wall_${side}_${course}`,
          x+wall,py,base,w-2*wall,wall,bh,`wood_x_${(course+bedIndex+1)%3}`);
      }
      for(const [side,px] of [['W',x+wall],['E',x+w-wall-liner]]) box(`${id}_liner_${side}`,
        px,y+wall,0.025,liner,d-2*wall,0.54,'liner','structure',0);
      for(const [side,py] of [['N',y+wall],['S',y+d-wall-liner]]) box(`${id}_liner_${side}`,
        x+wall+liner,py,0.025,w-2*wall-2*liner,liner,0.54,'liner','structure',0);
      for(const [i,[px,py]] of [[x+wall+liner,y+wall+liner],[x+w-wall-liner-0.06,y+wall+liner],
        [x+wall+liner,y+d-wall-liner-0.06],[x+w-wall-liner-0.06,y+d-wall-liner-0.06]].entries()) {
        box(`${id}_corner_${i}`,px,py,0,0.06,0.06,height,`wood_z_${bedIndex%3}`);
        for(const pz of [0.1,0.3,0.5]) {
          cylinder(`${id}_bolt_${i}_${Math.round(pz*10)}`,[i%2?x+w+0.001:x-0.001,py+0.03,pz],0.009,0.006,'hardware','x');
        }
      }
      const inset=wall+liner;
      box(`${id}_soil`,x+inset,y+inset,0.025,w-2*inset,d-2*inset,soilHeight-0.025,'soil','structure',0);
      const hoseZ=soilHeight+0.006;
      cylinder(`${id}_irrigation_header`,[x+w/2,y+0.13,hoseZ],0.008,w-0.22,'hose','x');
      for(const [i,px] of [x+w*0.28,x+w*0.72].entries()) {
        cylinder(`${id}_irrigation_line_${i}`,[px,y+d/2,hoseZ],0.006,d-0.26,'hose','y');
        for(let j=0;j<4;j++) cylinder(`${id}_dripper_${i}_${j}`,[px,y+0.25+j*(d-0.5)/3,hoseZ+0.004],0.011,0.01,'hose');
      }
      cylinder(`${id}_irrigation_feed`,[x+0.13,y+0.13,(soilHeight+0.01)/2],0.008,soilHeight+0.01,'hose');
      box(`${id}_label_stake`,x+w-0.19,y+0.19,soilHeight-0.06,0.014,0.016,0.22,'label','furniture',0.001);
      box(`${id}_label`,x+w-0.245,y+0.185,soilHeight+0.115,0.125,0.009,0.055,'label','furniture',0.005);
      const icon=[x+w-0.1825,y+0.185,soilHeight+0.142];
      beam(`${id}_label_stem`,[icon[0],icon[1],icon[2]-0.017],[icon[0],icon[1],icon[2]+0.013],0.003,0.003,'stem');
      beam(`${id}_label_branch_0`,[icon[0],icon[1],icon[2]],[icon[0]-0.016,icon[1],icon[2]+0.008],0.006,0.003,'stem');
      beam(`${id}_label_branch_1`,[icon[0],icon[1],icon[2]+0.006],[icon[0]+0.016,icon[1],icon[2]+0.014],0.006,0.003,'stem');

      const roots=crop==='tomatoes' ? Array.from({length:3},(_,i)=>[x+w/2,y+0.4+i*(d-0.8)/2,soilHeight-0.004])
        : Array.from({length:6},(_,i)=>[x+w*(i%2?0.69:0.31),y+0.42+Math.floor(i/2)*(d-0.72)/3,soilHeight-0.004]);
      for(let candidate=0,placed=0;candidate<500&&placed<12;candidate++) {
        const seed=bedIndex*10000+candidate*23,radius=0.012+random(seed+2)*0.014;
        const px=x+0.12+random(seed)*(w-0.24),py=y+0.26+random(seed+1)*(d-0.38);
        if([x+w*0.28,x+w*0.72].some(line=>Math.abs(px-line)<radius+0.018)) continue;
        if(roots.some(root=>Math.hypot(px-root[0],py-root[1])<radius+0.065)) continue;
        pebble(`${id}_soil_clod_${placed++}`,px,py,soilHeight,radius,seed,candidate%2?'soil':'soilClod');
      }
      for(const [i,root] of roots.entries()) {
        const name=`${id}_plant_${i}`,plantHeight=crop==='tomatoes'?1.04:crop==='kale'?0.3:crop==='herbs'?0.22:0.11;
        const stemEnd=[root[0],root[1],root[2]+plantHeight];
        beam(`${name}_stem`,root,stemEnd,crop==='tomatoes'?0.012:0.006,crop==='tomatoes'?0.012:0.006,'stem');
        plants.push({bedId:id,kind:crop,root,stem:`${name}_stem`});
        if(crop==='tomatoes') {
          const stakeX=root[0]+0.028;
          beam(`${id}_stake_${i}`,[stakeX,root[1],0.03],[stakeX,root[1],soilHeight+1.2],0.018,0.018,'wood_z_0');
          for(const [j,tieHeight] of [0.35,0.7,0.95].entries()) {
            for(const [side,dy] of [[0,-0.009],[1,0.009]]) beam(`${id}_tie_${i}_${j}_${side}`,
              [root[0]-0.008,root[1]+dy,soilHeight+tieHeight],[stakeX+0.01,root[1]+dy,soilHeight+tieHeight],0.004,0.004,'tie');
            for(const [side,px] of [[0,root[0]-0.008],[1,stakeX+0.01]]) beam(`${id}_tie_end_${i}_${j}_${side}`,
              [px,root[1]-0.009,soilHeight+tieHeight],[px,root[1]+0.009,soilHeight+tieHeight],0.004,0.004,'tie');
          }
          for(let j=0;j<7;j++) {
            const angle=j*2.399+i*0.5,pz=soilHeight+0.18+j*0.11;
            const end=[root[0]+Math.cos(angle)*0.14,root[1]+Math.sin(angle)*0.14,pz+0.075];
            beam(`${name}_branch_${j}`,[root[0],root[1],pz],end,0.005,0.005,'stem');
            for(let k=0;k<3;k++) leaf(`${name}_leaf_${j}_${k}`,end,angle+(k-1)*1.05,0.10,0.045,0.015,'tomatoLeaf',0.12);
            if(j%2===0) {
              const fruit=[end[0],end[1],end[2]-0.035];
              beam(`${name}_fruit_stem_${j}`,end,fruit,0.004,0.004,'stem');
              parts.push({name:`${name}_fruit_${j}`,type:'sphere',position:[fruit[0],fruit[1],fruit[2]-0.024],
                size:[0.052,0.052,0.049],material:j<4?'tomato':'tomatoGreen',category:'furniture'});
            }
          }
        } else {
          const count=crop==='lettuce'?9:crop==='kale'?6:8;
          for(let j=0;j<count;j++) {
            const angle=j*2.399+i*0.73,baseZ=soilHeight+0.035+(j%3)*(plantHeight-0.04)/3;
            const base=[root[0],root[1],baseZ];
            const length=crop==='lettuce'?0.14+(j%3)*0.018:crop==='kale'?0.18:0.085;
            const spread=crop==='lettuce'?0.12:crop==='kale'?0.11:0.05;
            leaf(`${name}_leaf_${j}`,base,angle,length,spread,crop==='lettuce'?0.045:0.025,
              crop==='lettuce'?(j%2?'lettuce':'lettuceLight'):crop==='kale'?(j%2?'kale':'kaleLight'):'herb',crop==='kale'?0.2:0.06);
          }
        }
      }
      if(options.surfaceHeight) {
        for(const part of parts.slice(partStart)) {
          if(part.type==='box'&&(/_wall_[WENS]_0$/.test(part.name))) {
            const [cx,cy,cz]=part.position,[pw,pd,ph]=part.size,top=cz+ph/2;
            const corners=[[cx-pw/2,cy-pd/2],[cx+pw/2,cy-pd/2],[cx+pw/2,cy+pd/2],[cx-pw/2,cy+pd/2]];
            part.type='mesh';part.vertices=[...corners.map(([px,py])=>[px,py,bottomAt(px,py)]),...corners.map(([px,py])=>[px,py,top])];
            part.faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
            delete part.position;delete part.size;delete part.bevel;
          } else if(part.type==='box'&&(/_corner_\d$/.test(part.name)||part.name===`${id}_soil`||part.name.includes('_liner_'))) {
            const [cx,cy,cz]=part.position,[pw,pd,ph]=part.size,top=cz+ph/2;
            const bottom=Math.min(...[cx-pw/2,cx+pw/2].flatMap(px=>[cy-pd/2,cy+pd/2].map(py=>bottomAt(px,py))));
            part.position[2]=(top+bottom)/2;part.size[2]=top-bottom;
          }
          for(const key of ['position','start','end'])if(part[key])part[key]=[part[key][0],part[key][1],part[key][2]+bedOffset];
          if(part.vertices)part.vertices=part.vertices.map(([px,py,pz])=>[px,py,pz+bedOffset]);
        }
        for(const plant of plants.slice(plantStart))plant.root=[plant.root[0],plant.root[1],plant.root[2]+bedOffset];
      }
    }
    return {name:'Raised beds',materials,parts,lights:[],floorHeight,beds,plants,
      groundPatch:{x:pad.x,y:pad.y,w:pad.w,d:pad.d,...grading,...(options.surfaceHeight?{level:floorHeight-.06,graded:true}:{})},surfaceFootprint,plantingClearances:[{x:surfaceFootprint.x,y:surfaceFootprint.y,w:surfaceFootprint.w,d:surfaceFootprint.d}]};
  }
  return {build};
})();
if(typeof module!=='undefined') module.exports={RaisedBedsModel};
