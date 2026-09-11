const GradingReport = (() => {
  const esc = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const f = (value, digits=2) => Number(value).toFixed(digits);
  const cz = (value,digits=2) => f(value,digits).replace('.',',');
  const css=`
    *{box-sizing:border-box}body{margin:0;background:#e9ece5;color:#283b32;font:14px/1.4 system-ui,sans-serif}nav{padding:16px 28px;display:flex;gap:20px;align-items:center}a{color:#345c45}button{padding:10px 18px;border:1px solid #a0b09e;background:white;border-radius:6px;cursor:pointer;font:inherit}.sheet{background:#fffef9;max-width:1480px;margin:20px auto;padding:28px}h1{font:30px Georgia,serif;margin:0 0 16px}h2{font:21px Georgia,serif;margin:0 0 8px}.columns{display:grid;grid-template-columns:2.25fr 1fr;gap:22px}svg{display:block;width:100%;height:auto}svg text{font-family:system-ui,sans-serif;fill:#283b32}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px}th,td{padding:6px 4px;border-bottom:1px solid #d8dfd3;text-align:right}th:first-child,td:first-child{text-align:left}thead th{background:#edf1e9}.chip{display:inline-block;width:15px;height:9px;margin-right:5px}.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:11px}
    @media(max-width:800px){.sheet{padding:18px;margin:12px}.columns{grid-template-columns:1fr}h1{font-size:25px}}
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
    const quantities = (typeof module!=='undefined'?require('./grading-zones.js').GradingZones:GradingZones).create(garden);
    const rev = revision([garden,site.spec,survey.data.points,terrain.bpvDatum,terrain.houseFFLInternal,data]);
    const minX = Math.min(...garden.plot.vertices.map(p=>p[0])), minZ = Math.min(...garden.plot.vertices.map(p=>p[1]));
    const maxX = Math.max(...garden.plot.vertices.map(p=>p[0])), maxZ = Math.max(...garden.plot.vertices.map(p=>p[1]));
    const scale = Math.min(790/(maxX-minX),550/(maxZ-minZ)), px=x=>50+(x-minX)*scale, pz=z=>40+(z-minZ)*scale;
    const polygon = points => points.map(([x,z])=>`${f(px(x))},${f(pz(z))}`).join(' ');
    const geometry = part => {
      if(part.kind==='rect')return `<rect x="${px(part.x)}" y="${pz(part.y)}" width="${part.w*scale}" height="${part.d*scale}"/>`;
      if(part.kind==='polygon')return `<polygon points="${polygon(part.points)}"/>`;
      if(part.kind==='circle')return `<circle cx="${px(part.cx)}" cy="${pz(part.cy)}" r="${part.r*scale}"/>`;
      if(part.kind==='ellipse')return `<ellipse cx="${px(part.cx)}" cy="${pz(part.cy)}" rx="${part.rx*scale}" ry="${part.ry*scale}"/>`;
      return '';
    };
    const map = [`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650" viewBox="0 0 900 650" role="img" aria-label="Pojmenované pracovní oblasti úprav terénu"><title>Koordinační situace zemních prací</title><defs><clipPath id="plotClip"><polygon points="${polygon(garden.plot.vertices)}"/></clipPath><pattern id="unmeasured" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#6e7772" stroke-width="1"/></pattern></defs><rect width="900" height="650" fill="#fffef9"/><g clip-path="url(#plotClip)">`];
    for(const zone of quantities.zones)map.push(`<g data-zone="${zone.id}" fill="${presentation.colorFor(zone)}" fill-opacity=".24">${zone.polygons.map(p=>`<polygon points="${polygon(p)}"/>`).join('')}</g>`);
    const mapFeatures = new Set(['driveway','eastTerrace','westTerrace','pergola','pond','firePit','zasivarna','heatPumpService','heatPumpPad','raisedBedsPad','raisedBed1','raisedBed2','raisedBed3','raisedBed4','compost','toolStore','binStore','softub','westDrainageStrip','rainTank','waterSource']);
    for(const element of garden.elements.filter(e=>data.metadata.exclusions.includes(e.id)||mapFeatures.has(e.id))) {
      const shapes=element.parts.map(geometry).join('');
      const bed=/^raisedBed\d+$/.test(element.id);
      const fill=bed?'#7a5a3a':element.id==='driveway'?'#d8d8d2':'none';
      map.push(`<g data-feature="${esc(element.id)}"><title>${esc(({rainTank:'Dešťová nádrž',waterSource:'Vodovodní šachta'})[element.id]??element.name)}</title><g fill="${fill}" fill-opacity="${bed?.65:.25}" stroke="#fffef9" stroke-width="3.2">${shapes}</g><g fill="none" stroke="${bed?'#54391f':'#34463c'}" stroke-width="${element.id==='driveway'?1.8:1.2}"${element.id==='rainTank'?' stroke-dasharray="4 3"':''}>${shapes}</g></g>`);
    }
    const tank=garden.elements.find(e=>e.id==='rainTank')?.parts.find(p=>p.kind==='rect');
    if(tank)map.push(`<text x="${px(tank.x+tank.w/2)}" y="${pz(tank.y+tank.d/2)}" font-size="9" text-anchor="middle" stroke="#fffef9" stroke-width="3" paint-order="stroke">dešťová nádrž</text>`);
    const waterSource=garden.elements.find(e=>e.id==='waterSource')?.parts.find(p=>p.kind==='circle');
    if(waterSource)map.push(`<text x="${px(waterSource.cx-.8)}" y="${pz(waterSource.cy)+3}" font-size="9" text-anchor="end" stroke="#fffef9" stroke-width="3" paint-order="stroke">vodovodní šachta</text>`);
    map.push('</g>');
    map.push(`<polygon points="${polygon(garden.plot.vertices)}" fill="none" stroke="#939991" stroke-width=".7"/>`);
    map.push(`<path d="M820 85V45M812 57L820 45L828 57" fill="none" stroke="#283b32" stroke-width="2"/><text x="820" y="35" text-anchor="middle" font-size="12">sever</text><path d="M50 635h${scale*5}" stroke="#283b32" stroke-width="4"/><text x="${50+scale*2.5}" y="630" text-anchor="middle" font-size="11">5 m</text></svg>`);
    const mapSVG=map.join('');
    const legend='<div class="legend"><span>Hnědé obdélníky: vyvýšené záhony</span><span>Čárkovaný obrys: podzemní nádrž</span><span>Tmavá přerušovaná čára: zaměřený plot</span></div>';
    const spots=presentation.bankSpots(garden).map(spot=>({...spot,existing:survey.height(...spot.position)-terrain.houseFFLInternal,proposed:site.height(...spot.position)-terrain.houseFFLInternal}));
    const heightRows=spots.map(spot=>`<tr><td>${spot.id} · ${esc(spot.name)}</td><td>${cz(spot.existing)} → ${cz(spot.proposed)}</td><td>+${cz(Math.max(0,spot.proposed-spot.existing))}</td></tr>`).join('');
    const zoneRows=quantities.zones.map(z=>`<tr><td><i class="chip" style="background:${presentation.colorFor(z)}"></i><strong>${z.id}</strong> · ${esc(z.name)}</td><td>${cz(z.area,1)}</td></tr>`).join('');
    const dimensionMarks=quantities.dimensions.filter(d=>d.from&&d.to).map(d=>{const a=d.from,b=d.to;return `<g stroke="#354e3d" stroke-width=".8"><path d="M${px(a[0])} ${pz(a[1])}L${px(b[0])} ${pz(b[1])}"/><path d="M${px(a[0])-2} ${pz(a[1])-4}l4 8M${px(b[0])-2} ${pz(b[1])-4}l4 8"/></g><text x="${px((a[0]+b[0])/2)}" y="${pz((a[1]+b[1])/2)-(d.id==='heatPumpPad'?17:5)}" font-size="9" text-anchor="middle" stroke="#fffef9" stroke-width="3" paint-order="stroke">${cz(Math.hypot(b[0]-a[0],b[1]-a[1]))} m</text>`;}).join('');
    const zoneBoundaries=quantities.zones.map(z=>z.boundaries.map(p=>`<polyline points="${polygon(p)}" fill="none" stroke="#fffef9" stroke-width="4.2"/><polyline points="${polygon(p)}" fill="none" stroke="${presentation.colorFor(z)}" stroke-width="${z.id==='C'?2.8:2.1}"/>`).join('')).join('');
    const fenceMarks=quantities.fenceSegments.map(segment=>`<path data-measured-fence="${esc(segment.id??segment.side??'fence')}" d="M${px(segment.start[0])} ${pz(segment.start[1])}L${px(segment.end[0])} ${pz(segment.end[1])}" fill="none" stroke="#243b32" stroke-width="2" stroke-dasharray="6 3"/>`).join('');
    const zoneMap=mapSVG.replace('</svg>',zoneBoundaries+fenceMarks+dimensionMarks+presentation.svgLabels(quantities.zones,px,pz)+presentation.svgLevelMarks(quantities.levelMarks,px,pz)+presentation.svgBankSpots(spots,px,pz)+'</svg>');
    const html=`<section class="sheet"><h1>Zemní práce · pracovní oblasti</h1><div class="columns"><div>${zoneMap}${legend}</div><aside><h2>Legenda oblastí</h2><table><thead><tr><th>Oblast</th><th>m²</th></tr></thead><tbody>${zoneRows}<tr><td>Celý pozemek</td><td>${cz(quantities.plotArea,1)}</td></tr></tbody></table><h2>Výměry povrchů</h2><table><thead><tr><th>Povrch</th><th>m²</th></tr></thead><tbody>${quantities.surfaces.map(surface=>`<tr><td>${esc(surface.name)}</td><td>${cz(surface.area,2)}</td></tr>`).join('')}</tbody></table><h2>Výšky H / L</h2><div class="legend">Výšky vůči podlaze domu ±0,00 m</div><table><thead><tr><th>Bod</th><th>Stav → návrh (m)</th><th>Násyp (m)</th></tr></thead><tbody>${heightRows}</tbody></table></aside></div></section>`;
    let rowY=78;
    const svgRows=(rows,heading)=>{let out=`<text x="930" y="${rowY}" font-size="18" font-weight="600">${heading}</text><text x="1300" y="${rowY}" font-size="11" text-anchor="end">m²</text>`;rowY+=26;for(const row of rows){out+=`<text x="930" y="${rowY}" font-size="11">${esc(row.name)}</text><text x="1300" y="${rowY}" font-size="11" text-anchor="end">${cz(row.area,2)}</text><path d="M930 ${rowY+7}H1300" stroke="#d8dfd3"/>`;rowY+=20;}rowY+=14;return out;};
    const exportSVG=`<svg xmlns="http://www.w3.org/2000/svg" width="1330" height="840" viewBox="0 0 1330 840"><rect width="1330" height="840" fill="#fffef9"/><style>text{font-family:system-ui,sans-serif;fill:#283b32}</style><text x="28" y="34" font-size="26">Zemní práce · pracovní oblasti</text><g transform="translate(0 50)">${zoneMap}</g>${svgRows(quantities.zones.map(z=>({name:z.id+' · '+z.name,area:z.area})),'Legenda oblastí')}${svgRows(quantities.surfaces,'Výměry povrchů')}<text x="930" y="${rowY}" font-size="16">Výšky vůči podlaze domu ±0,00 m</text>${spots.map((spot,i)=>`<text x="930" y="${rowY+25+i*22}" font-size="11">${spot.id} · ${spot.name}</text><text x="1300" y="${rowY+25+i*22}" text-anchor="end" font-size="11">${cz(spot.existing)} → ${cz(spot.proposed)} m · +${cz(Math.max(0,spot.proposed-spot.existing))} m</text>`).join('')}</svg>`;
    return {html,css,mapSVG:zoneMap,exportSVG,revision:rev};
  }
  return {render};
})();
if(typeof module !== 'undefined') module.exports = {GradingReport};
