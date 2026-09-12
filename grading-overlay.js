const GradingOverlay = (() => {
  const palette={A:'#667785',B:'#b37943',C:'#2f845b',D:'#c7992e',E:'#a66081',F:'#8470ad',G:'#758c36',H:'#397f9b',I:'#9a9381',J:'#468d8d',K:'#ba753c',L:'#a86642',M:'#346d9c'};
  const colorFor=zone=>palette[zone.id]??zone.color;
  const boundaryOrder=zones=>zones.slice().sort((a,b)=>({I:0,A:2,E:2,F:3,M:3}[a.id]??1)-({I:0,A:2,E:2,F:3,M:3}[b.id]??1));
  function svgLabels(zones,px,pz,fontSize=11) {
    return zones.map(zone=>{const x=px(zone.label[0]),y=pz(zone.label[1]),color=colorFor(zone);return `<g data-zone-label="${zone.id}" class="grading-zone-label"><circle cx="${x}" cy="${y}" r="11" fill="#fffef9" stroke="${color}" stroke-width="2.5"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="${fontSize+2}" font-weight="700" style="fill:${color}">${zone.id}</text></g>`;}).join('');
  }
  function svgLevelMarks(marks,px,pz) {
    return (marks??[]).map(mark=>{const x=px(mark.position[0]),y=pz(mark.position[1]),value=(mark.relativeLevel>0?'+':'')+mark.relativeLevel.toFixed(2).replace('.',',').replace('-','−');return `<g data-level-mark="${mark.id}"><path d="M${x-5} ${y}H${x+5}L${x} ${y+5}Z" fill="#17649e"/><text x="${x}" y="${y-5}" text-anchor="middle" font-size="11" font-weight="700" style="fill:#17649e" stroke="white" stroke-width="3" paint-order="stroke">${value}</text></g>`;}).join('');
  }
  function bankSpots(garden) {
    if(!garden.gradingBanks?.length)return [];
    const result=[];
    for(const [id,name] of [['north','Severní'],['east','Východní']]) {
      const bank=garden.gradingBanks.find(b=>b.id===id);if(!bank?.spotFoot||!bank?.spotCrest)continue;
      result.push({id:String(result.length+1),name:name+' pata',position:bank.spotFoot},{id:String(result.length+2),name:name+' hrana',position:bank.spotCrest});
    }
    return result;
  }
  function svgBankSpots(spots,px,pz) {
    return spots.map(spot=>`<g data-bank-spot="${spot.id}"><circle cx="${px(spot.position[0])}" cy="${pz(spot.position[1])}" r="7" fill="white" stroke="#49595f" stroke-width="1.5"/><text x="${px(spot.position[0])}" y="${pz(spot.position[1])+3}" font-size="9" text-anchor="middle">${spot.id}</text></g>`).join('');
  }
  function terrainMarks(garden,quantities) {
    const banks=(garden.gradingBanks??[]).map(bank=>({...bank,from:bank.id==='north'&&bank.spotCrest&&bank.spotFoot?bank.spotCrest.map((v,i)=>v+(bank.spotFoot[i]-v)*.25):bank.spotCrest,to:bank.spotFoot}));
    const flats=(quantities.levelMarks??[]).filter(mark=>mark.id!=='raisedBeds').map(mark=>({id:mark.id,position:mark.id==='C'?[29.5,12.9]:[mark.position[0],mark.position[1]+.9]}));
    for(const id of ['D','G']){const zone=quantities.zones.find(zone=>zone.id===id);if(zone)flats.push({id,position:[zone.label[0],zone.label[1]+1.4]});}
    for(const id of ['A','G']){const zone=quantities.zones.find(zone=>zone.id===id),mark=flats.find(mark=>mark.id===id);if(zone&&mark)mark.position=[zone.label[0]+1.6,zone.label[1]];}
    const slopes=[
      {id:'north-house',from:[12,6.95],to:[20,6.95]},
      {id:'south-house',from:[12,27.5],to:[16,27.5]},
      {id:'east-terrace',from:[23.58,15],to:[25.5,15]},
      {id:'north-terrace',from:[22.5,11.58],to:[22.5,9.5]},
      {id:'south-driveway',from:[26,32],to:[26,30.5]},
      {id:'driveway-ramp',from:[35,29],to:[41,30]},
      {id:'west-bed',from:[-1.0436216216,12],to:[1.4,12]}
    ];
    const drainage=garden.elements.find(e=>e.id==='westDrainageStrip');
    const mainDrainage=drainage?.parts.find(p=>p.kind==='rect');
    if(mainDrainage&&!mainDrainage.grading?.fallX&&!mainDrainage.grading?.fallZ)flats.push({id:'E',position:[9.105,22]});
    for(const [i,p] of (drainage?.parts??[]).entries())if(p.grading?.fallX||p.grading?.fallZ) {
      const a=p.grading.fallX?[p.grading.xStart??p.x,p.y+p.d/2]:[p.x+p.w/2,p.y];
      const b=p.grading.fallX?[p.x+p.w,p.y+p.d/2]:[p.x+p.w/2,p.grading.zEnd??p.y+p.d];
      slopes.push({id:'drainage-'+i,from:(p.grading.fallX??p.grading.fallZ)<0?a:b,to:(p.grading.fallX??p.grading.fallZ)<0?b:a});
    }
    return {banks,slopes,flats,fences:quantities.fenceSegments??[]};
  }
  const terrainLegend=[['flat','Rovná plocha'],['slope','Svah · šipka dolů'],['fixed','Zachovat výšku zaměřeného plotu']];
  function svgTerrainSymbol(kind,x,y) {
    if(kind==='flat')return `<path d="M${x-7} ${y-3}h14M${x-7} ${y+3}h14" fill="none" stroke="#17649e" stroke-width="2.2"/>`;
    if(kind==='fixed')return `<path d="M${x-6} ${y-4}l12 8M${x-6} ${y+4}l12 -8" fill="none" stroke="#243b32" stroke-width="2"/>`;
    return `<path d="M${x-9} ${y}h18m-5 -4l5 4l-5 4" fill="none" stroke="#93502e" stroke-width="2"/>`;
  }
  function svgTerrainLegend(x,y) {
    return terrainLegend.map(([kind,label],i)=>`${svgTerrainSymbol(kind,x+10,y+i*19)}<text x="${x+26}" y="${y+i*19+4}" font-size="11">${label}</text>`).join('');
  }
  function svgTerrainMarks(garden,px,pz,quantities) {
    const marks=terrainMarks(garden,quantities);
    let out='';
    for(const bank of [...marks.banks,...marks.slopes]) {
      if(bank.points) {
        const points=bank.points.map(([x,z])=>`${px(x)},${pz(z)}`).join(' '),id='bank-hatch-'+bank.id;
        out+=`<defs><pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M-2 2L2 -2M0 9L9 0M7 11L11 7" stroke="#93502e" stroke-opacity=".48" stroke-width="1"/></pattern></defs><polygon data-terrain-bank="${bank.id}" points="${points}" fill="url(#${id})" stroke="#93502e" stroke-width=".8"/>`;
      }
      if(!bank.from||!bank.to)continue;
      const a=bank.from.map((v,i)=>i?pz(v):px(v)),b=bank.to.map((v,i)=>i?pz(v):px(v));
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uy=(b[1]-a[1])/length;
      const inset=bank.points?Math.min(13,length*.18):0;
      const start=[a[0]+ux*inset,a[1]+uy*inset],end=[b[0]-ux*inset,b[1]-uy*inset];
      out+=`<path data-terrain-downhill="${bank.id}" d="M${start}L${end}M${end[0]-ux*8-uy*4} ${end[1]-uy*8+ux*4}L${end}L${end[0]-ux*8+uy*4} ${end[1]-uy*8-ux*4}" fill="none" stroke="#fffef9" stroke-width="5"/><path d="M${start}L${end}M${end[0]-ux*8-uy*4} ${end[1]-uy*8+ux*4}L${end}L${end[0]-ux*8+uy*4} ${end[1]-uy*8-ux*4}" fill="none" stroke="#93502e" stroke-width="2.3"/>`;
    }
    for(const mark of marks.flats)out+=`<g data-terrain-flat="${mark.id}">${svgTerrainSymbol('flat',px(mark.position[0]),pz(mark.position[1]))}</g>`;
    for(const [i,segment] of marks.fences.entries())out+=`<g data-terrain-preserve="${i}">${svgTerrainSymbol('fixed',px((segment.start[0]+segment.end[0])/2),pz((segment.start[1]+segment.end[1])/2))}</g>`;
    return out;
  }
  function create({THREE,scene,ground,garden,height,panel,existingHeight,houseFFL=0}) {
    const data=GradingZones.create(garden),group=new THREE.Group();
    group.name='grading-work-areas';group.visible=false;
    const zones=data.zones.map(zone=>({...zone,colorValue:new THREE.Color(colorFor(zone)),bounds:zone.polygons.map(points=>({points,x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),z0:Math.min(...points.map(p=>p[1])),z1:Math.max(...points.map(p=>p[1]))}))}));
    const contains=(polygon,x,z)=>{
      if(x<polygon.x0||x>polygon.x1||z<polygon.z0||z>polygon.z1)return false;
      return polygon.points.every((a,i)=>{const b=polygon.points[(i+1)%polygon.points.length];return (b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])>=-1e-7;});
    };
    const geometry=ground.geometry.clone(),position=geometry.attributes.position,colors=new Float32Array(position.count*3);
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),z=position.getZ(i),zone=zones.find(zone=>zone.bounds.some(p=>contains(p,x,z)))??zones.at(-1);
      zone.colorValue.toArray(colors,i*3);position.setY(i,position.getY(i)+.025);
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    group.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.78,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})));
    for(const [order,zone] of boundaryOrder(zones).entries()) {
      const strip=[];
      for(const [a,b] of zone.boundaries) {
        const length=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(length/.25));
        const nx=-(b[1]-a[1])/length*.055,nz=(b[0]-a[0])/length*.055;
        for(let i=0;i<steps;i++) {
          const ends=[i/steps,(i+1)/steps].map(t=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
          const p=ends.flatMap(([x,z])=>[[x+nx,height(x+nx,z+nz)+.07,z+nz],[x-nx,height(x-nx,z-nz)+.07,z-nz]]);
          for(const index of [0,1,2,2,1,3])strip.push(...p[index]);
        }
      }
      const borderGeometry=new THREE.BufferGeometry();borderGeometry.setAttribute('position',new THREE.Float32BufferAttribute(strip,3));
      const border=new THREE.Mesh(borderGeometry,new THREE.MeshBasicMaterial({color:colorFor(zone),side:THREE.DoubleSide,depthTest:false,depthWrite:false,fog:false}));border.name='grading-zone-border-'+zone.id;border.renderOrder=22+order*.01;group.add(border);
    }
    function label(text,x,z,width,color='#ffffff',badge=false) {
      const canvas=document.createElement('canvas');canvas.width=badge==='level'?256:badge?128:512;canvas.height=96;
      const context=canvas.getContext('2d');context.fillStyle=color;context.fillRect(0,0,canvas.width,96);
      context.strokeStyle='#32473e';context.lineWidth=5;context.strokeRect(2,2,canvas.width-4,92);
      context.fillStyle=badge?'#ffffff':'#20352a';context.font=`bold ${badge?70:44}px system-ui`;context.textAlign='center';context.textBaseline='middle';context.fillText(text,canvas.width/2,48,canvas.width-20);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,fog:false,sizeAttenuation:false}));
      sprite.position.set(x,height(x,z)+.65,z);sprite.scale.set(width,width*96/canvas.width,1);sprite.renderOrder=25;group.add(sprite);return sprite;
    }
    for(const zone of zones)label(zone.id,...zone.label,.028,colorFor(zone),true).name='grading-zone-label-'+zone.id;
    for(const mark of data.levelMarks??[]) {
      const sprite=label((mark.relativeLevel>0?'+':'')+mark.relativeLevel.toFixed(2).replace('.',',').replace('-','−'),...mark.position,.045,'#17649e','level');sprite.name='grading-level-mark-'+mark.id;
    }
    const terrain=terrainMarks(garden,data);
    function terrainLine(points,name,color='#93502e') {
      const vertices=[];
      for(let i=1;i<points.length;i++) {
        const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.15));
        for(let j=0;j<=steps;j++){const t=j/steps,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;vertices.push(new THREE.Vector3(x,height(x,z)+.08,z));}
      }
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false,fog:false}));line.name=name;line.renderOrder=24;group.add(line);
    }
    for(const bank of [...terrain.banks,...terrain.slopes]) {
      if(bank.points) {
        terrainLine([...bank.points,bank.points[0]],'grading-bank-'+bank.id);
        const min=Math.min(...bank.points.map(p=>p[0]+p[1])),max=Math.max(...bank.points.map(p=>p[0]+p[1]));
        for(let k=min+.4;k<max;k+=.55) {
          const hits=[];
          for(let i=0;i<bank.points.length;i++){const a=bank.points[i],b=bank.points[(i+1)%bank.points.length],da=a[0]+a[1]-k,db=b[0]+b[1]-k;if(da*db<0){const t=da/(da-db);hits.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}
          if(hits.length===2)terrainLine(hits,'grading-bank-hatch-'+bank.id);
        }
      }
      if(bank.from&&bank.to){const a=bank.from,b=bank.to,length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;terrainLine([a,b],'grading-downhill-'+bank.id);terrainLine([[b[0]-.4*ux-.2*uz,b[1]-.4*uz+.2*ux],b,[b[0]-.4*ux+.2*uz,b[1]-.4*uz-.2*ux]],'grading-downhill-tip-'+bank.id);}
    }
    for(const mark of terrain.flats){const [x,z]=mark.position;for(const offset of [-.1,.1])terrainLine([[x-.3,z+offset],[x+.3,z+offset]],'grading-flat-'+mark.id,'#17649e');}
    for(const [i,segment] of terrain.fences.entries()){const x=(segment.start[0]+segment.end[0])/2,z=(segment.start[1]+segment.end[1])/2;for(const sign of [-1,1])terrainLine([[x-.2,z-sign*.2],[x+.2,z+sign*.2]],'grading-preserve-'+i,'#243b32');}
    const spots=bankSpots(garden);
    for(const spot of spots)label(spot.id,...spot.position,.021,'#49595f',true).name='grading-bank-spot-'+spot.id;
    const dimensions=new THREE.Group();dimensions.visible=false;group.add(dimensions);
    for(const dimension of data.dimensions.filter(d=>d.from&&d.to)){
      const from=dimension.from.map((v,i)=>v+(dimension.displayOffset?.[i]??0)),to=dimension.to.map((v,i)=>v+(dimension.displayOffset?.[i]??0));
      const points=[];
      for(let i=0;i<=20;i++){const t=i/20,x=from[0]+(to[0]-from[0])*t,z=from[1]+(to[1]-from[1])*t;points.push(new THREE.Vector3(x,height(x,z)+.12,z));}
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#273a31',depthTest:false}));line.renderOrder=21;dimensions.add(line);
      label(dimension.value,(from[0]+to[0])/2,(from[1]+to[1])/2,.09);
      dimensions.add(group.children.at(-1));
    }
    scene.add(group);
    const wrapper=document.createElement('div'),toggle=document.createElement('input'),toggleLabel=document.createElement('label');
    toggle.type='checkbox';toggle.id='gradingAreas';toggleLabel.append(toggle,` Work areas ${zones[0].id}–${zones.at(-1).id}`);
    const dimensionToggle=document.createElement('input'),dimensionLabel=document.createElement('label');dimensionToggle.type='checkbox';dimensionToggle.id='gradingDimensions';dimensionLabel.append(dimensionToggle,' Plan dimensions');dimensionLabel.style.display='block';
    const legend=document.createElement('div');legend.hidden=true;legend.style.cssText='font-size:11px;line-height:1.6;margin-top:6px';
    for(const zone of zones){const row=document.createElement('div');row.textContent=`${zone.id} · ${zone.name} · ${zone.area.toLocaleString('cs-CZ',{maximumFractionDigits:1})} m²`;row.style.cssText=`border-left:4px solid ${colorFor(zone)};padding-left:6px;margin:3px 0`;legend.append(row);}
    const levelKey=document.createElement('div');levelKey.textContent='Výšky vůči podlaze domu ±0,00 m';legend.append(levelKey);
    for(const [kind,text] of terrainLegend){const row=document.createElement('div');row.textContent=({flat:'═ ',slope:'↘ ',fixed:'× '})[kind]+text;legend.append(row);}
    if(existingHeight)for(const spot of spots){const before=existingHeight(...spot.position)-houseFFL,after=height(...spot.position)-houseFFL,row=document.createElement('div');row.textContent=`${spot.id} · ${spot.name}: ${before.toFixed(2).replace('.',',')} → ${after.toFixed(2).replace('.',',')} m · +${Math.max(0,after-before).toFixed(2).replace('.',',')} m`;legend.append(row);}
    const terrainMode=document.getElementById('terrainMode');
    const sync=()=>{group.visible=toggle.checked&&terrainMode.value!=='existing';legend.hidden=!group.visible;dimensions.visible=dimensionToggle.checked;};
    terrainMode.addEventListener('change',sync);
    toggle.addEventListener('change',sync);dimensionToggle.addEventListener('change',()=>{if(dimensionToggle.checked)toggle.checked=true;sync();});
    wrapper.append(toggleLabel,dimensionLabel,legend);panel.append(wrapper);
    return {group,data,toggle,dimensionToggle};
  }
  return {create,colorFor,boundaryOrder,svgLabels,svgLevelMarks,bankSpots,svgBankSpots,terrainMarks,terrainLegend,svgTerrainLegend,svgTerrainMarks};
})();
if(typeof module!=='undefined')module.exports={GradingOverlay};
