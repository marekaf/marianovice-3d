const GradingOverlay = (() => {
  const palette={A:'#667785',B:'#b37943',C:'#2f845b',D:'#c7992e',E:'#a66081',F:'#8470ad',G:'#758c36',H:'#397f9b',I:'#9a9381',J:'#468d8d',K:'#ba753c',L:'#a86642',M:'#346d9c'};
  const colorFor=zone=>palette[zone.id]??zone.color;
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
    for(const zone of zones) {
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
      const border=new THREE.Mesh(borderGeometry,new THREE.MeshBasicMaterial({color:colorFor(zone),side:THREE.DoubleSide,depthTest:false,depthWrite:false,fog:false}));border.name='grading-zone-border-'+zone.id;border.renderOrder=22;group.add(border);
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
    const spots=bankSpots(garden);
    for(const spot of spots)label(spot.id,...spot.position,.021,'#49595f',true).name='grading-bank-spot-'+spot.id;
    const dimensions=new THREE.Group();dimensions.visible=false;group.add(dimensions);
    for(const dimension of data.dimensions.filter(d=>d.from&&d.to)){
      const points=[];
      for(let i=0;i<=20;i++){const t=i/20,x=dimension.from[0]+(dimension.to[0]-dimension.from[0])*t,z=dimension.from[1]+(dimension.to[1]-dimension.from[1])*t;points.push(new THREE.Vector3(x,height(x,z)+.12,z));}
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#273a31',depthTest:false}));line.renderOrder=21;dimensions.add(line);
      label(dimension.value,(dimension.from[0]+dimension.to[0])/2,(dimension.from[1]+dimension.to[1])/2,.09);
      dimensions.add(group.children.at(-1));
    }
    scene.add(group);
    const wrapper=document.createElement('div'),toggle=document.createElement('input'),toggleLabel=document.createElement('label');
    toggle.type='checkbox';toggle.id='gradingAreas';toggleLabel.append(toggle,` Work areas ${zones[0].id}–${zones.at(-1).id}`);
    const dimensionToggle=document.createElement('input'),dimensionLabel=document.createElement('label');dimensionToggle.type='checkbox';dimensionToggle.id='gradingDimensions';dimensionLabel.append(dimensionToggle,' Plan dimensions');dimensionLabel.style.display='block';
    const legend=document.createElement('div');legend.hidden=true;legend.style.cssText='font-size:11px;line-height:1.6;margin-top:6px';
    for(const zone of zones){const row=document.createElement('div');row.textContent=`${zone.id} · ${zone.name} · ${zone.area.toLocaleString('cs-CZ',{maximumFractionDigits:1})} m²`;row.style.cssText=`border-left:4px solid ${colorFor(zone)};padding-left:6px;margin:3px 0`;legend.append(row);}
    const levelKey=document.createElement('div');levelKey.textContent='Výšky vůči podlaze domu ±0,00 m';legend.append(levelKey);
    if(existingHeight)for(const spot of spots){const before=existingHeight(...spot.position)-houseFFL,after=height(...spot.position)-houseFFL,row=document.createElement('div');row.textContent=`${spot.id} · ${spot.name}: ${before.toFixed(2).replace('.',',')} → ${after.toFixed(2).replace('.',',')} m · +${Math.max(0,after-before).toFixed(2).replace('.',',')} m`;legend.append(row);}
    const terrainMode=document.getElementById('terrainMode');
    const sync=()=>{group.visible=toggle.checked&&terrainMode.value!=='existing';legend.hidden=!group.visible;dimensions.visible=dimensionToggle.checked;};
    terrainMode.addEventListener('change',sync);
    toggle.addEventListener('change',sync);dimensionToggle.addEventListener('change',()=>{if(dimensionToggle.checked)toggle.checked=true;sync();});
    wrapper.append(toggleLabel,dimensionLabel,legend);panel.append(wrapper);
    return {group,data,toggle,dimensionToggle};
  }
  return {create,colorFor,svgLabels,svgLevelMarks,bankSpots,svgBankSpots};
})();
if(typeof module!=='undefined')module.exports={GradingOverlay};
