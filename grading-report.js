const GradingReport = (() => {
  const esc = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const f = (value, digits=2) => Number(value).toFixed(digits);
  const cz = (value,digits=2) => f(value,digits).replace('.',',');
  const css=`
    *{box-sizing:border-box}body{margin:0;background:#e9eaeb;color:#111;font:14px/1.2 "Arial Narrow",Arial,sans-serif}nav{padding:16px 28px;display:flex;gap:20px;align-items:center}a{color:#222}button{padding:10px 18px;border:1px solid #999;background:white;cursor:pointer;font:inherit}.sheet{background:white;width:1480px;max-width:100%;height:1025px;margin:20px auto;padding:18px;border:1px solid #222}.columns{display:grid;grid-template-columns:minmax(0,3.35fr) minmax(0,1fr);gap:14px;height:100%}.plan-panel{display:flex;flex-direction:column;min-width:0;justify-content:flex-start;padding-top:40px;position:relative}.drawing-caption{position:absolute;left:12px;top:12px;font-size:19px;font-weight:normal;letter-spacing:.02em}.drawing-caption b{font-size:28px;margin-right:10px;font-weight:normal}svg{display:block;width:100%;height:auto}svg text{font-family:"Arial Narrow",Arial,sans-serif;fill:#111}.technical-sidebar{display:flex;flex-direction:column;min-height:0;padding:10px 0 0 10px;border-left:1px solid #aaa}.technical-sidebar h2{font-size:12px;margin:0 0 6px;font-weight:600;letter-spacing:.02em}.technical-sidebar table{border-collapse:collapse;width:100%;font-size:10px;line-height:1.15;margin:0 0 12px}.technical-sidebar td,.technical-sidebar th{padding:2px 0;vertical-align:top;font-weight:normal}.technical-sidebar th{border-bottom:1px solid #888}.technical-sidebar td:last-child,.technical-sidebar th:last-child{text-align:right;white-space:nowrap;padding-left:7px}.technical-sidebar td:first-child,.technical-sidebar th:first-child{text-align:left}.technical-sidebar small{font-size:8px;color:#666;display:block;margin-top:1px}.notation{font-size:10px;line-height:1.45;margin-bottom:15px}.datum{font-weight:600;margin-bottom:6px}.title-block{margin-top:auto;border:1px solid #222;font-size:10px}.title-block>div{padding:4px 8px;border-bottom:1px solid #555}.title-block>div:last-child{border-bottom:0}.title-block small{display:block;font-size:8px;color:#555;margin-bottom:2px}.title-block .project{font-size:14px}.title-block .drawing-name{font-size:14px;line-height:1.2}.title-block .meta{display:grid;grid-template-columns:1fr 1fr;gap:3px}.red-key{display:inline-block;width:24px;height:10px;border:2px solid #e00000;vertical-align:middle;margin-right:6px}.bank-key{display:inline-block;width:24px;height:10px;border-top:1px solid #777;background:repeating-linear-gradient(90deg,transparent 0 4px,#aaa 4px 5px);vertical-align:middle;margin-right:6px}
    @media(max-width:900px){body{overflow-x:auto}.sheet{max-width:none;margin:10px;width:1480px}}
    @page{size:A3 landscape;margin:10mm}
    @media print{body{background:white}nav{display:none}.sheet{width:400mm;height:277mm;max-width:none;margin:0;padding:4mm}.columns{gap:3mm}.technical-sidebar{padding:2mm 0 0 2mm}.technical-sidebar h2{font-size:8pt}.technical-sidebar table{font-size:6.5pt;margin-bottom:2mm}.technical-sidebar small{font-size:5.4pt}.notation{font-size:6.5pt;margin-bottom:3mm}.title-block{font-size:6.5pt}.title-block .project{font-size:9pt}.title-block .drawing-name{font-size:10pt}.title-block small{font-size:5.5pt}.title-block>div{padding:1.5mm}.drawing-caption{font-size:12pt}.drawing-caption b{font-size:18pt}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  `;
  function revision(values) {
    let hash = 2166136261;
    for (const char of JSON.stringify(values)) hash = Math.imul(hash ^ char.charCodeAt(0),16777619);
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function render({garden,terrain,site,survey,data}) {
    const presentation=typeof module!=='undefined'?require('./grading-overlay.js').GradingOverlay:GradingOverlay;
    const notation=typeof module!=='undefined'?require('./grading-surface-notation.js').GradingSurfaceNotation:GradingSurfaceNotation;
    const levels=typeof module!=='undefined'?require('./grading-levels.js').GradingLevels:GradingLevels;
    const quantities = (typeof module!=='undefined'?require('./grading-zones.js').GradingZones:GradingZones).create(garden);
    const surface=notation.create({garden,site,quantities,datum:terrain.houseFFLInternal});
    const rev = revision([garden,site.spec,survey.data.points,terrain.bpvDatum,terrain.houseFFLInternal,data,quantities.zones.map(({id,name,features})=>({id,name,features}))]);
    const minX = Math.min(...garden.plot.vertices.map(p=>p[0])), minZ = Math.min(...garden.plot.vertices.map(p=>p[1]));
    const maxX = Math.max(...garden.plot.vertices.map(p=>p[0])), maxZ = Math.max(...garden.plot.vertices.map(p=>p[1]));
    const scale = Math.min(755/(maxX-minX),570/(maxZ-minZ)), px=x=>55+(x-minX)*scale, pz=z=>50+(z-minZ)*scale;
    const polygon = points => points.map(([x,z])=>`${f(px(x))},${f(pz(z))}`).join(' ');
    const geometry = part => {
      if(part.kind==='rect')return `<rect x="${px(part.x)}" y="${pz(part.y)}" width="${part.w*scale}" height="${part.d*scale}"/>`;
      if(part.kind==='polygon')return `<polygon points="${polygon(part.points)}"/>`;
      if(part.kind==='circle')return `<circle cx="${px(part.cx)}" cy="${pz(part.cy)}" r="${part.r*scale}"/>`;
      if(part.kind==='ellipse')return `<ellipse cx="${px(part.cx)}" cy="${pz(part.cy)}" rx="${part.rx*scale}" ry="${part.ry*scale}"/>`;
      return '';
    };
    const map = [`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650" viewBox="0 0 900 650" role="img" aria-label="Pojmenované pracovní oblasti úprav terénu"><title>Koordinační situace zemních prací</title><defs><clipPath id="plotClip"><polygon points="${polygon(garden.plot.vertices)}"/></clipPath><pattern id="unmeasured" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#6e7772" stroke-width="1"/></pattern></defs><rect width="900" height="650" fill="#fffef9"/><g clip-path="url(#plotClip)">`];
    for(const zone of quantities.zones)map.push(`<g data-zone="${zone.id}" fill="${presentation.colorFor(zone)}" fill-opacity="0">${zone.polygons.map(p=>`<polygon points="${polygon(p)}"/>`).join('')}</g>`);
    map.push(notation.svg({surface,px,pz}));
    const mapFeatures = new Set(['driveway','eastTerrace','westTerrace','pergola','pond','firePit','zasivarna','heatPumpService','heatPumpPad','raisedBedsPad','raisedBed1','raisedBed2','raisedBed3','raisedBed4','compost','toolStore','binStore','softub','westDrainageStrip','rainTank','waterSource','sewerInspection']);
    for(const element of garden.elements.filter(e=>data.metadata.exclusions.includes(e.id)||mapFeatures.has(e.id))) {
      const shapes=element.parts.map(geometry).join('');
      const bed=/^raisedBed\d+$/.test(element.id);
      const fill=bed?'#dedede':'none';
      map.push(`<g data-feature="${esc(element.id)}"><title>${esc(({rainTank:'Dešťová nádrž',waterSource:'Vodovodní šachta'})[element.id]??element.name)}</title><g fill="${fill}" stroke="#fffef9" stroke-width="2">${shapes}</g><g fill="none" stroke="#555" stroke-width="${element.id==='driveway'?1:.7}"${['rainTank','carport','sauna','pergola'].includes(element.id)?' stroke-dasharray="4 3"':''}>${shapes}</g></g>`);
    }
    const tank=garden.elements.find(e=>e.id==='rainTank')?.parts.find(p=>p.kind==='rect');
    if(tank)map.push(`<text x="${px(tank.x+tank.w/2)}" y="${pz(tank.y+tank.d/2)}" font-size="9" text-anchor="middle" stroke="#fffef9" stroke-width="3" paint-order="stroke">dešťová nádrž · orientačně</text>`);
    const waterSource=garden.elements.find(e=>e.id==='waterSource')?.parts.find(p=>p.kind==='circle');
    if(waterSource)map.push(`<text x="${px(waterSource.cx-.8)}" y="${pz(waterSource.cy)+3}" font-size="9" text-anchor="end" stroke="#fffef9" stroke-width="3" paint-order="stroke">vodovodní šachta</text>`);
    const sewer=garden.elements.find(e=>e.id==='sewerInspection')?.parts.find(p=>p.kind==='circle');
    map.push('</g>');
    if(sewer)map.push(`<g data-feature-label="sewerInspection"><path d="M${px(sewer.cx)} ${pz(sewer.cy)}L${px(44.3)} ${pz(28.4)}" fill="none" stroke="#34463c" stroke-width=".8"/><text x="${px(44.5)}" y="${pz(27.5)}" font-size="9" text-anchor="start">kanalizační šachta</text><text x="${px(44.5)}" y="${pz(28.1)}" font-size="9" text-anchor="start">DN400</text></g>`);
    map.push(`<g data-existing-fence="survey" fill="none" stroke="#333" stroke-width=".65">${quantities.fenceSegments.map(s=>`<path d="M${px(s.start[0])} ${pz(s.start[1])}L${px(s.end[0])} ${pz(s.end[1])}"/>`).join('')}</g><polygon data-parcel-boundary="true" points="${polygon(garden.plot.vertices)}" fill="none" stroke="#c59b22" stroke-width="1.2" stroke-dasharray="12 5"/>`);
    const gate=garden.elements.find(e=>e.id==='gate')?.parts.find(p=>p.kind==='line');
    if(gate){
      const a=[px(gate.x1),pz(gate.y1)],b=[px(gate.x2),pz(gate.y2)],width=Math.hypot(gate.x2-gate.x1,gate.y2-gate.y1),offset=25;
      map.push(`<g data-gate-width="${width.toFixed(3)}"><path d="M${a}L${b}" stroke="#222" stroke-width="2.5"/><path d="M${a}h${offset+4}M${b}h${offset+4}M${a[0]+offset} ${a[1]}L${b[0]+offset} ${b[1]}M${a[0]+offset-3} ${a[1]-3}l6 6M${b[0]+offset-3} ${b[1]-3}l6 6" fill="none" stroke="#222" stroke-width=".6"/><text x="${(a[0]+b[0])/2+offset+9}" y="${(a[1]+b[1])/2}" font-size="10">${cz(width)} m</text><text x="${(a[0]+b[0])/2+offset+9}" y="${(a[1]+b[1])/2+13}" font-size="8">SVĚTLÝ PRŮJEZD</text></g>`);
    }
    map.push(`<path d="M860 85V45M852 57L860 45L868 57" fill="none" stroke="#222" stroke-width="1.5"/><text x="860" y="35" text-anchor="middle" font-size="12">sever</text><path d="M70 635h${scale*5}" stroke="#222" stroke-width="3"/><text x="${70+scale*2.5}" y="630" text-anchor="middle" font-size="10">5 m</text></svg>`);
    const mapSVG=map.join('');
    const heightLegend=`<div class="notation"><div class="datum">±0,000 = ${cz(terrain.bpvDatum)} m Bpv</div>Horní číslo: Bpv [m] · dolní: vůči podlaze [m]<br>Šedá kóta st.: stávající terén<br>Šrafy: dlouhé / krátké čáry od horní hrany<br>Šipka: směr klesání</div>`;
    const zoneRows=quantities.zones.map(z=>`<tr><td><strong>${z.id}</strong> · ${esc(z.name)}${z.features.length?`<small data-zone-features="${z.id}">${esc(z.features.join(', '))}</small>`:''}</td><td>${cz(z.area,1)}</td></tr>`).join('');
    const dimensionMarks=quantities.dimensions.filter(d=>d.from&&d.to&&!(gate&&d.from[0]===gate.x1&&d.from[1]===gate.y1&&d.to[0]===gate.x2&&d.to[1]===gate.y2)).map(d=>{
      const a=d.from.map((v,i)=>v+(d.displayOffset?.[i]??0)),b=d.to.map((v,i)=>v+(d.displayOffset?.[i]??0));
      const extensions=d.displayOffset?`<path d="M${px(d.from[0])} ${pz(d.from[1])}L${px(a[0])} ${pz(a[1])}M${px(d.to[0])} ${pz(d.to[1])}L${px(b[0])} ${pz(b[1])}" stroke-width=".4"/>`:'';
      return `<g data-dimension="${esc(d.id??d.name)}" stroke="#222" stroke-width=".8">${extensions}<path d="M${px(a[0])} ${pz(a[1])}L${px(b[0])} ${pz(b[1])}"/><path d="M${px(a[0])-2} ${pz(a[1])-4}l4 8M${px(b[0])-2} ${pz(b[1])-4}l4 8"/></g><text data-dimension-label="${esc(d.id??d.name)}" x="${px((a[0]+b[0])/2)}" y="${pz((a[1]+b[1])/2)-(d.id==='heatPumpPad'?17:5)}" font-size="9" text-anchor="middle" stroke="#fffef9" stroke-width="3" paint-order="stroke">${cz(Math.hypot(b[0]-a[0],b[1]-a[1]))} m</text>`;
    }).join('');
    const zoneBoundaries=['house','garage'].map(id=>`<g data-building-outline="${id}" fill="none" stroke="#e00000" stroke-width="2.2">${garden.elements.find(e=>e.id===id).parts.map(geometry).join('')}</g>`).join('');
    const banks=presentation.terrainMarks(garden,quantities).banks;
    const terrainMarks=presentation.svgTerrainMarks(garden,px,pz,quantities,{bankFill:false,technical:true});
    const elevationMarks=levels.svg({garden,terrain,site,survey,quantities,banks,px,pz});

    const datum='<text x="300" y="635" font-size="11" font-weight="600">±0,000 = '+cz(terrain.bpvDatum)+' m Bpv</text>';
    const buildingLabels=[
      {id:'house',at:[16,11.5],name:'RODINNÝ DŮM',relative:0},
      {id:'garage',at:[31,23],name:'GARÁŽ',relative:-.5}
    ].map(b=>'<g '+(b.id==='house'?'data-elevation="house" data-surface="finish" data-existing="" data-proposed="'+terrain.bpvDatum.toFixed(5)+'" ':'')+'data-building-label="'+b.id+'" text-anchor="middle"><text x="'+px(b.at[0])+'" y="'+pz(b.at[1])+'" font-size="'+(b.id==='house'?19:16)+'" style="fill:#e00000">'+b.name+'</text><text x="'+px(b.at[0])+'" y="'+(pz(b.at[1])+18)+'" font-size="12" style="fill:#e00000">'+(b.relative===0?'±0,000':'−0,500')+' = '+cz(terrain.bpvDatum+b.relative)+'</text></g>').join('');
    const featureLabels=[['sauna','SAUNA'],['pergola','PERGOLA'],['greenhouse','SKLENÍK'],['carport','PŘÍSTŘEŠEK'],['eastTerrace','TERASA BEZ SCHODŮ']].map(([id,label])=>{
      const part=garden.elements.find(e=>e.id===id)?.parts.find(p=>p.kind==='rect');if(!part)return '';
      const x=px(part.x+part.w/2),y=pz(part.y+part.d/2)-10;
      return id==='eastTerrace'?'<text data-feature-name="eastTerrace" x="'+x+'" y="'+(y-9)+'" text-anchor="middle" font-size="8"><tspan x="'+x+'">TERASA</tspan><tspan x="'+x+'" dy="10">BEZ SCHODŮ</tspan></text>':'<text data-feature-name="'+id+'" x="'+x+'" y="'+y+'" text-anchor="middle" font-size="10">'+label+'</text>';
    }).join('');
    const zoneMap=mapSVG.replace('</svg>',zoneBoundaries+terrainMarks+dimensionMarks+presentation.svgLabels(quantities.zones,px,pz,9,{technical:true})+buildingLabels+featureLabels+elevationMarks+datum+'</svg>').replaceAll('#fffef9','#ffffff');
    const titleBlock='<div class="title-block"><div><small>STAVBA</small><span class="project">Zahrada Mariánovice</span></div><div><small>VÝKRES</small><span class="drawing-name">SITUACE · HRUBÉ<br>TERÉNNÍ ÚPRAVY</span></div><div><small>PODKLAD</small>Zaměření pozemku a prostorový model</div><div class="meta"><span>Formát: A3</span><span>Výkres: C.4</span><span>Měřítko: grafické</span><span>Výšky: Bpv</span></div><div>±0,000 = '+cz(terrain.bpvDatum)+' m Bpv</div></div>';
    const html='<section class="sheet"><div class="columns"><div class="plan-panel"><div class="drawing-caption"><b>1</b> KOORDINAČNÍ SITUACE</div>'+zoneMap+'</div><aside class="technical-sidebar"><h2>LEGENDA</h2><div class="notation"><div><i class="red-key"></i>Nadzemní stavby</div><div><i class="bank-key"></i>Svahy terénních úprav</div><div>Černá čára: stávající oplocení</div><div>Okrová přerušovaná: hranice pozemku</div><div>Čárkovaný obrys: podzemní nádrž</div></div>'+heightLegend+'<h2>OBLASTI TERÉNNÍCH ÚPRAV</h2><table><thead><tr><th>Označení / plocha</th><th>m²</th></tr></thead><tbody>'+zoneRows+'<tr><td>Celý pozemek</td><td>'+cz(quantities.plotArea,1)+'</td></tr></tbody></table>'+titleBlock+'</aside></div></section>';
    const wrap=(text,limit)=>{const lines=[];let line='';for(const word of text.split(' ')){if((line+' '+word).trim().length>limit&&line){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;};
    let rowY=222;
    const text=(x,y,value,size=10,extra='')=>'<text x="'+x+'" y="'+y+'" font-size="'+size+'" '+extra+'>'+esc(value)+'</text>';
    const svgRows=(rows,heading)=>{
      let out=text(1100,rowY,heading,12,'font-weight="600"')+text(1438,rowY,'m²',10,'text-anchor="end"');rowY+=18;
      for(const row of rows){
        const lines=wrap(row.name,43);
        out+=text(1438,rowY,cz(row.area,1),10,'text-anchor="end"');
        for(const line of lines){out+=text(1100,rowY,line,10);rowY+=12;}
        for(const line of row.featureLines??wrap(row.features??'',52)){out+=text(1100,rowY,line,8,'style="fill:#666"');rowY+=10;}
        rowY+=4;
      }
      rowY+=10;return out;
    };
    const sidebar=svgRows(quantities.zones.map(z=>({id:z.id,name:z.id+' · '+z.name,area:z.area,featureLines:presentation.featureLines(z)})).concat([{name:'Celý pozemek',area:quantities.plotArea}]),'OBLASTI TERÉNNÍCH ÚPRAV');
    const exportSVG='<svg xmlns="http://www.w3.org/2000/svg" width="1480" height="1025" viewBox="0 0 1480 1025"><rect width="1480" height="1025" fill="white"/><rect x="16" y="16" width="1448" height="993" fill="none" stroke="#222" stroke-width=".8"/><style>text{font-family:Arial Narrow,Arial,sans-serif;fill:#111}</style>'+text(40,58,'1',28)+text(73,55,'KOORDINAČNÍ SITUACE',19)+'<g transform="translate(20 115) scale(1.17)">'+zoneMap+'</g><path d="M1085 30V995" stroke="#aaa" stroke-width=".5"/>'+text(1100,50,'LEGENDA',12,'font-weight="600"')+'<path d="M1100 64h26v10h-26z" fill="none" stroke="#e00000" stroke-width="2"/>'+text(1135,73,'Nadzemní stavby',10)+text(1100,93,'Šrafy: svahy terénních úprav',10)+text(1100,110,'Horní číslo: nadmořská výška Bpv [m]',10)+text(1100,125,'Dolní číslo: vůči podlaze domu [m]',10)+text(1100,140,'Šedá kóta st.: stávající terén',10)+text(1100,155,'Šipka: směr klesání',10)+text(1100,170,'Čárkovaný obrys: podzemní nádrž',10)+text(1100,185,'Černá čára: stávající oplocení',10)+text(1100,200,'Okrová přerušovaná: hranice pozemku',10)+sidebar+'<g><rect x="1100" y="825" width="348" height="167" fill="white" stroke="#222"/><path d="M1100 863H1448M1100 921H1448M1100 951H1448" stroke="#555" stroke-width=".6"/>'+text(1110,839,'STAVBA',8)+text(1110,854,'Zahrada Mariánovice',14)+text(1110,877,'VÝKRES',8)+text(1110,895,'SITUACE · HRUBÉ',16)+text(1110,913,'TERÉNNÍ ÚPRAVY',16)+text(1110,934,'PODKLAD',8)+text(1110,946,'Zaměření pozemku a prostorový model',10)+text(1110,967,'Formát: A3 · měřítko grafické',10)+text(1378,967,'C.4',12)+text(1110,984,'±0,000 = '+cz(terrain.bpvDatum)+' m Bpv',10)+'</g></svg>';
    return {html,css,mapSVG:zoneMap,exportSVG,revision:rev};
  }
  return {render};
})();
if(typeof module !== 'undefined') module.exports = {GradingReport};
