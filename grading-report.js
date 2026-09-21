const GradingReport = (() => {
  const esc = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const f = (value, digits=2) => Number(value).toFixed(digits);
  const cz = (value,digits=2) => f(value,digits).replace('.',',');
  const css=`
    *{box-sizing:border-box}body{margin:0;background:#e9eaeb;color:#252525;font:14px/1.4 Arial,sans-serif}nav{padding:16px 28px;display:flex;gap:20px;align-items:center}a{color:#345c45}button{padding:10px 18px;border:1px solid #a0b09e;background:white;border-radius:6px;cursor:pointer;font:inherit}.sheet{background:white;max-width:1480px;margin:20px auto;padding:28px}h1{font:500 25px Arial,sans-serif;margin:0 0 16px;border-bottom:1px solid #333;padding-bottom:10px;letter-spacing:.04em}h2{font:16px Arial,sans-serif;margin:0 0 8px;text-transform:uppercase}.columns{display:grid;grid-template-columns:2.25fr 1fr;gap:22px}svg{display:block;width:100%;height:auto}svg text{font-family:Arial,sans-serif;fill:#252525}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px}th,td{padding:6px 4px;border-bottom:1px solid #ddd;text-align:right}th:first-child,td:first-child{text-align:left}thead th{background:#f3f3f3}.chip{display:inline-block;width:15px;height:3px;margin-right:5px;vertical-align:middle}.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:11px}
    @media(max-width:800px){.sheet{padding:18px;margin:12px}.columns{grid-template-columns:1fr}h1{font-size:25px}}
    .notation{font-size:11px;line-height:1.5}.level-schedule{display:grid;grid-template-columns:1fr 1fr 1.15fr;gap:14px;border-top:1px solid #555;padding-top:10px;margin-top:8px}.level-schedule table{font-size:12px;margin:0}.level-schedule td,.level-schedule th{padding:3px 2px}.level-schedule h2{font-size:11px}.level-schedule .datum{font-size:11px;margin:0 0 7px}.datum{font-size:13px;font-weight:bold;margin:10px 0}
    @page{size:A3 landscape;margin:10mm}
    @media print{body{background:white}nav{display:none}.sheet{width:400mm;height:277mm;max-width:none;margin:0;padding:4mm}h1{font-size:23pt;margin-bottom:3mm}h2{font-size:15pt}table{font-size:8.5pt;margin-bottom:4mm}th,td{padding:1.15mm 1mm}.columns{grid-template-columns:2.25fr 1fr;gap:5mm}.legend{font-size:8pt}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
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
    const scale = Math.min(735/(maxX-minX),500/(maxZ-minZ)), px=x=>75+(x-minX)*scale, pz=z=>75+(z-minZ)*scale;
    const polygon = points => points.map(([x,z])=>`${f(px(x))},${f(pz(z))}`).join(' ');
    const geometry = part => {
      if(part.kind==='rect')return `<rect x="${px(part.x)}" y="${pz(part.y)}" width="${part.w*scale}" height="${part.d*scale}"/>`;
      if(part.kind==='polygon')return `<polygon points="${polygon(part.points)}"/>`;
      if(part.kind==='circle')return `<circle cx="${px(part.cx)}" cy="${pz(part.cy)}" r="${part.r*scale}"/>`;
      if(part.kind==='ellipse')return `<ellipse cx="${px(part.cx)}" cy="${pz(part.cy)}" rx="${part.rx*scale}" ry="${part.ry*scale}"/>`;
      return '';
    };
    const map = [`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650" viewBox="0 0 900 650" role="img" aria-label="Pojmenované pracovní oblasti úprav terénu"><title>Koordinační situace zemních prací</title><defs><clipPath id="plotClip"><polygon points="${polygon(garden.plot.vertices)}"/></clipPath><pattern id="unmeasured" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#6e7772" stroke-width="1"/></pattern></defs><rect width="900" height="650" fill="#fffef9"/><g clip-path="url(#plotClip)">`];
    for(const zone of quantities.zones)map.push(`<g data-zone="${zone.id}" fill="${presentation.colorFor(zone)}" fill-opacity=".015">${zone.polygons.map(p=>`<polygon points="${polygon(p)}"/>`).join('')}</g>`);
    map.push(notation.svg({surface,px,pz}));
    const mapFeatures = new Set(['driveway','eastTerrace','westTerrace','pergola','pond','firePit','zasivarna','heatPumpService','heatPumpPad','raisedBedsPad','raisedBed1','raisedBed2','raisedBed3','raisedBed4','compost','toolStore','binStore','softub','westDrainageStrip','rainTank','waterSource','sewerInspection']);
    for(const element of garden.elements.filter(e=>data.metadata.exclusions.includes(e.id)||mapFeatures.has(e.id))) {
      const shapes=element.parts.map(geometry).join('');
      const bed=/^raisedBed\d+$/.test(element.id);
      const fill=bed?'#7a5a3a':element.id==='driveway'?'#d8d8d2':'none';
      map.push(`<g data-feature="${esc(element.id)}"><title>${esc(({rainTank:'Dešťová nádrž',waterSource:'Vodovodní šachta'})[element.id]??element.name)}</title><g fill="${fill}" fill-opacity="${bed?.65:.25}" stroke="#fffef9" stroke-width="3.2">${shapes}</g><g fill="none" stroke="${bed?'#54391f':'#222'}" stroke-width="${element.id==='driveway'?1.8:1.2}"${element.id==='rainTank'?' stroke-dasharray="4 3"':''}>${shapes}</g></g>`);
    }
    const tank=garden.elements.find(e=>e.id==='rainTank')?.parts.find(p=>p.kind==='rect');
    if(tank)map.push(`<text x="${px(tank.x+tank.w/2)}" y="${pz(tank.y+tank.d/2)}" font-size="9" text-anchor="middle" stroke="#fffef9" stroke-width="3" paint-order="stroke">dešťová nádrž · orientačně</text>`);
    const waterSource=garden.elements.find(e=>e.id==='waterSource')?.parts.find(p=>p.kind==='circle');
    if(waterSource)map.push(`<text x="${px(waterSource.cx-.8)}" y="${pz(waterSource.cy)+3}" font-size="9" text-anchor="end" stroke="#fffef9" stroke-width="3" paint-order="stroke">vodovodní šachta</text>`);
    const sewer=garden.elements.find(e=>e.id==='sewerInspection')?.parts.find(p=>p.kind==='circle');
    map.push('</g>');
    if(sewer)map.push(`<g data-feature-label="sewerInspection"><path d="M${px(sewer.cx)} ${pz(sewer.cy)}L${px(44.3)} ${pz(28.4)}" fill="none" stroke="#34463c" stroke-width=".8"/><text x="${px(44.5)}" y="${pz(27.5)}" font-size="9" text-anchor="start">kanalizační šachta</text><text x="${px(44.5)}" y="${pz(28.1)}" font-size="9" text-anchor="start">DN400</text></g>`);
    map.push(`<polygon points="${polygon(garden.plot.vertices)}" fill="none" stroke="#333" stroke-width="1.1"/>`);
    const gate=garden.elements.find(e=>e.id==='gate')?.parts.find(p=>p.kind==='line');
    if(gate){
      const a=[px(gate.x1),pz(gate.y1)],b=[px(gate.x2),pz(gate.y2)],width=Math.hypot(gate.x2-gate.x1,gate.y2-gate.y1),offset=25;
      map.push(`<g data-gate-width="${width.toFixed(3)}"><path d="M${a}L${b}" stroke="#222" stroke-width="2.5"/><path d="M${a}h${offset+4}M${b}h${offset+4}M${a[0]+offset} ${a[1]}L${b[0]+offset} ${b[1]}M${a[0]+offset-3} ${a[1]-3}l6 6M${b[0]+offset-3} ${b[1]-3}l6 6" fill="none" stroke="#222" stroke-width=".6"/><text x="${(a[0]+b[0])/2+offset+9}" y="${(a[1]+b[1])/2}" font-size="10">${cz(width)} m</text><text x="${(a[0]+b[0])/2+offset+9}" y="${(a[1]+b[1])/2+13}" font-size="8">SVĚTLÝ PRŮJEZD</text></g>`);
    }
    map.push(`<path d="M820 85V45M812 57L820 45L828 57" fill="none" stroke="#283b32" stroke-width="2"/><text x="820" y="35" text-anchor="middle" font-size="12">sever</text><path d="M735 635h${scale*5}" stroke="#283b32" stroke-width="4"/><text x="${735+scale*2.5}" y="630" text-anchor="middle" font-size="11">5 m</text></svg>`);
    const mapSVG=map.join('');
    const heightLegend=`<div class="notation"><div class="datum">±0,000 = ${cz(terrain.bpvDatum)} m Bpv</div>Horní číslo: nadmořská výška Bpv [m]<br>Dolní číslo: výška vůči podlaze domu [m]<br>Šedá kóta st.: stávající terén<br>Rámeček: navržený terén / povrch dle popisu<br>Šrafy svahu: dlouhé / krátké čáry od horní hrany<br>Šipka: směr klesání<br>Čárkovaný obrys: podzemní nádrž</div>`;
    const zoneRows=quantities.zones.map(z=>`<tr><td><i class="chip" style="background:${presentation.colorFor(z)}"></i><strong>${z.id}</strong> · ${esc(z.name)}${z.features.length?`<small data-zone-features="${z.id}" style="display:block;font-size:.85em;color:#52614f">${esc(z.features.join(', '))}</small>`:''}</td><td>${cz(z.area,1)}</td></tr>`).join('');
    const dimensionMarks=quantities.dimensions.filter(d=>d.from&&d.to&&!(gate&&d.from[0]===gate.x1&&d.from[1]===gate.y1&&d.to[0]===gate.x2&&d.to[1]===gate.y2)).map(d=>{
      const a=d.from.map((v,i)=>v+(d.displayOffset?.[i]??0)),b=d.to.map((v,i)=>v+(d.displayOffset?.[i]??0));
      const extensions=d.displayOffset?`<path d="M${px(d.from[0])} ${pz(d.from[1])}L${px(a[0])} ${pz(a[1])}M${px(d.to[0])} ${pz(d.to[1])}L${px(b[0])} ${pz(b[1])}" stroke-width=".4"/>`:'';
      return `<g data-dimension="${esc(d.id??d.name)}" stroke="#222" stroke-width=".8">${extensions}<path d="M${px(a[0])} ${pz(a[1])}L${px(b[0])} ${pz(b[1])}"/><path d="M${px(a[0])-2} ${pz(a[1])-4}l4 8M${px(b[0])-2} ${pz(b[1])-4}l4 8"/></g><text data-dimension-label="${esc(d.id??d.name)}" x="${px((a[0]+b[0])/2)}" y="${pz((a[1]+b[1])/2)-(d.id==='heatPumpPad'?17:5)}" font-size="9" text-anchor="middle" stroke="#fffef9" stroke-width="3" paint-order="stroke">${cz(Math.hypot(b[0]-a[0],b[1]-a[1]))} m</text>`;
    }).join('');
    const zoneBoundaries=presentation.boundaryOrder(quantities.zones).map(z=>z.boundaries.map(p=>`<polyline points="${polygon(p)}" fill="none" stroke="white" stroke-width="2"/><polyline data-zone-boundary="${z.id}" points="${polygon(p)}" fill="none" stroke="${['F','M'].includes(z.id)?'#e00000':presentation.colorFor(z)}" stroke-width="${['F','M'].includes(z.id)?2:['C'].includes(z.id)?1:.65}"/>`).join('')).join('');
    const banks=presentation.terrainMarks(garden,quantities).banks;
    const terrainMarks=presentation.svgTerrainMarks(garden,px,pz,quantities,{bankFill:false,technical:true});
    const elevationMarks=levels.svg({garden,terrain,site,survey,quantities,banks,px,pz});
    const finishRows=levels.schedule({garden,terrain,site,survey,quantities,banks});
    const finishTable=rows=>`<table><thead><tr><th>Hotový povrch</th><th>Bpv</th><th>±0,000</th></tr></thead><tbody>${rows.map(mark=>`<tr data-finish-level="${mark.id}" data-proposed="${mark.proposed.toFixed(5)}"><td>${mark.zone} · ${mark.label.toLocaleLowerCase('cs')}</td><td>${mark.absoluteText}</td><td>${mark.relativeText}</td></tr>`).join('')}</tbody></table>`;
    const finishSchedule=`<div class="level-schedule">${finishTable(finishRows.slice(0,7))}${finishTable(finishRows.slice(7))}${heightLegend}</div>`;
    const datum=`<text x="300" y="635" font-size="11" font-weight="600">±0,000 = ${cz(terrain.bpvDatum)} m Bpv</text>`;
    const zoneMap=mapSVG.replace('</svg>',zoneBoundaries+terrainMarks+dimensionMarks+presentation.svgLabels(quantities.zones,px,pz)+elevationMarks+datum+'</svg>').replaceAll('#fffef9','#ffffff');
    const html=`<section class="sheet"><h1>SITUACE · TERÉNNÍ ÚPRAVY</h1><div class="columns"><div>${zoneMap}${finishSchedule}</div><aside><h2>Legenda oblastí</h2><table><thead><tr><th>Oblast</th><th>m²</th></tr></thead><tbody>${zoneRows}<tr><td>Celý pozemek</td><td>${cz(quantities.plotArea,1)}</td></tr></tbody></table><h2>Výměry povrchů</h2><table><thead><tr><th>Povrch</th><th>m²</th></tr></thead><tbody>${quantities.surfaces.map(surface=>`<tr><td>${esc(surface.name)}</td><td>${cz(surface.area,2)}</td></tr>`).join('')}</tbody></table></aside></div></section>`;
    let rowY=78;
    const svgRows=(rows,heading)=>{let out=`<text x="930" y="${rowY}" font-size="18" font-weight="600">${heading}</text><text x="1300" y="${rowY}" font-size="11" text-anchor="end">m²</text>`;rowY+=26;for(const row of rows){out+=`${row.color?`<rect x="916" y="${rowY-8}" width="9" height="8" fill="${row.color}"/>`:''}<text x="930" y="${rowY}" font-size="11">${esc(row.name)}</text><text x="1300" y="${rowY}" font-size="11" text-anchor="end">${cz(row.area,2)}</text>`;for(const line of row.featureLines??[]){rowY+=14;out+=`<text data-zone-features="${row.id}" x="930" y="${rowY}" font-size="10" style="fill:#52614f">${esc(line)}</text>`;}out+=`<path d="M930 ${rowY+7}H1300" stroke="#d8dfd3"/>`;rowY+=20;}rowY+=14;return out;};
    const finishSVG=finishRows.map((mark,i)=>{
      const x=i<7?50:345,y=754+(i%7)*19;
      return `<g data-finish-level="${mark.id}" data-proposed="${mark.proposed.toFixed(5)}" font-size="11"><text x="${x}" y="${y}">${mark.zone} · ${esc(mark.label.toLocaleLowerCase('cs'))}</text><text x="${x+218}" y="${y}" text-anchor="end">${mark.absoluteText}</text><text x="${x+275}" y="${y}" text-anchor="end">${mark.relativeText}</text></g>`;
    }).join('');
    const exportSVG=`<svg xmlns="http://www.w3.org/2000/svg" width="1330" height="910" viewBox="0 0 1330 910"><rect width="1330" height="910" fill="white"/><style>text{font-family:Arial,sans-serif;fill:#252525}</style><text x="28" y="34" font-size="24">SITUACE · TERÉNNÍ ÚPRAVY</text><g transform="translate(0 50)">${zoneMap}</g><text x="50" y="730" font-size="12">HOTOVÉ POVRCHY · Bpv / VŮČI PODLAZE DOMU [m]</text>${finishSVG}<text x="650" y="730" font-size="11">Šipka: směr klesání</text><g font-size="10"><text x="650" y="780">Šrafy svahu: dlouhé / krátké čáry od horní hrany</text><text x="650" y="800">Horní číslo: Bpv · dolní: vůči podlaze [m]</text><text x="650" y="820">Šedá kóta st.: stávající terén</text><text x="650" y="840">Rámeček: navržený terén / povrch dle popisu</text><text x="650" y="860">Čárkovaný obrys: podzemní nádrž</text></g>${svgRows(quantities.zones.map(z=>({id:z.id,name:z.id+' · '+z.name,area:z.area,color:presentation.colorFor(z),featureLines:presentation.featureLines(z)})),'Legenda oblastí')}${svgRows(quantities.surfaces,'Výměry povrchů')}</svg>`;
    return {html,css,mapSVG:zoneMap,exportSVG,revision:rev};
  }
  return {render};
})();
if(typeof module !== 'undefined') module.exports = {GradingReport};
