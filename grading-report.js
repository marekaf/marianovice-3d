const GradingReport = (() => {
  const esc = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const f = (value, digits=2) => Number(value).toFixed(digits);
  const signed = value => `${value>=0?'+':''}${f(value)}`;
  const css = `
    *{box-sizing:border-box}body{margin:0;background:#e9ece5;color:#283b32;font:14px/1.45 system-ui,sans-serif}
    nav{padding:16px 28px;display:flex;gap:20px;align-items:center}a{color:#345c45}button{padding:10px 18px;border:1px solid #a0b09e;background:white;border-radius:6px;cursor:pointer;font:inherit}
    .sheet{background:#fffef9;max-width:1480px;margin:20px auto;padding:32px;break-after:page;position:relative}.sheet:last-child{break-after:auto}
    header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #47664f;padding-bottom:12px;margin-bottom:16px}h1{font:32px Georgia,serif;margin:0}h2{font:25px Georgia,serif;margin:0 0 12px}h3{font-size:15px;margin:15px 0 6px}p{margin:8px 0}.kicker{font-size:11px;text-transform:uppercase;letter-spacing:.1em}.issue{text-align:right;font-size:12px;min-width:230px}.warning{border-left:4px solid #a86e39;background:#f8eee0;padding:10px 14px}.columns{display:grid;grid-template-columns:2.25fr 1fr;gap:22px}.balanced{display:grid;grid-template-columns:1fr 1fr;gap:24px}svg{display:block;width:100%;height:auto}svg text{font-family:system-ui,sans-serif;fill:#283b32}.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px}.chip{display:inline-block;width:18px;height:10px;margin-right:5px}.muted{color:#5c6a60;font-size:12px}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.metric{padding:10px;background:#edf1e9}.metric strong{display:block;font-size:25px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:7px 5px;border-bottom:1px solid #d8dfd3;text-align:right}th:first-child,td:first-child{text-align:left}thead th{background:#edf1e9;font-weight:600}ul,ol{padding-left:20px}.footer{margin-top:14px;padding-top:8px;border-top:1px solid #c7d0c2;font-size:11px}.section-card{margin-bottom:14px;break-inside:avoid}.section-card h3{margin:4px 0}.section-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.section-card svg{max-height:235px}.notes li{margin-bottom:8px}
    @media(max-width:800px){.sheet{padding:18px;margin:12px}.columns,.balanced,.section-grid{grid-template-columns:1fr}header{display:block}.issue{text-align:left;margin-top:12px}.scroll{overflow:auto}h1{font-size:26px}}
    @page{size:A3 landscape;margin:10mm}
    @media print{body{background:white;font-size:10pt}nav{display:none}.sheet{width:400mm;max-width:none;height:277mm;margin:0;padding:4mm;overflow:hidden}header{margin-bottom:3mm;padding-bottom:2mm}h1{font-size:23pt}h2{font-size:17pt}h3{font-size:11pt}table{font-size:9pt}th,td{padding:1.6mm 1mm}.columns{grid-template-columns:2.25fr 1fr}.balanced,.section-grid{grid-template-columns:1fr 1fr}.section-card svg{max-height:84mm}.muted,.legend{font-size:9pt}.footer{font-size:8pt}.metric strong{font-size:19pt}.warning{padding:2mm 3mm}.notes li{margin-bottom:2mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  `;
  function revision(values) {
    let hash = 2166136261;
    for (const char of JSON.stringify(values)) hash = Math.imul(hash ^ char.charCodeAt(0),16777619);
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function render({garden,terrain,site,survey,data,baseline}) {
    const rev = revision([garden,site.spec,survey.data.points,terrain.bpvDatum,terrain.houseFFLInternal,data]);
    const bpv = h => terrain.bpv(h), level = h => f(bpv(h));
    const header = (title,number) => `<header><div><div class="kicker">House & garden · terrain coordination</div><h1>${title}</h1></div><div class="issue">MODEL SNAPSHOT ${rev}<br>Sheet ${number} · metres / Bpv<br>Proposal for review · NOT FOR SETTING OUT</div></header>`;
    const footer = `<div class="footer">Snapshot ${rev} · Same grading engine and datum as the 3D viewer · House FFL ±0.000 = ${f(terrain.bpvDatum,3)} m Bpv · Dimensions in metres. Printed scales must be checked against the scale bar. Verify survey age, benchmarks and all boundaries on site.</div>`;
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
    const map = [`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650" viewBox="0 0 900 650" role="img" aria-label="Proposed grading and cut fill map"><title>Terrain works coordination plan</title><defs><clipPath id="plotClip"><polygon points="${polygon(garden.plot.vertices)}"/></clipPath><pattern id="unmeasured" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#6e7772" stroke-width="1"/></pattern></defs><rect width="900" height="650" fill="#fffef9"/><g clip-path="url(#plotClip)">`];
    for(const cell of data.cells) {
      const color=cell.excluded?'#e4e6e0':Math.abs(cell.delta)<.05?'#f0f1e9':cell.delta>0?'#75a4ba':'#ca9674';
      const opacity=cell.excluded?1:Math.abs(cell.delta)<.05?1:Math.min(.95,.25+Math.abs(cell.delta)*.6);
      map.push(`<rect x="${px(cell.x-.25)}" y="${pz(cell.z-.25)}" width="${scale*.5+.1}" height="${scale*.5+.1}" fill="${color}" opacity="${opacity}"/>`);
      if(!cell.surveyed)map.push(`<rect x="${px(cell.x-.25)}" y="${pz(cell.z-.25)}" width="${scale*.5}" height="${scale*.5}" fill="url(#unmeasured)"/>`);
    }
    const grid = new Map(data.cells.map(c=>[`${c.x},${c.z}`,c]));
    const contourLabels = new Map();
    for(const cell of data.cells) {
      const square=[cell,grid.get(`${cell.x+.5},${cell.z}`),grid.get(`${cell.x+.5},${cell.z+.5}`),grid.get(`${cell.x},${cell.z+.5}`)];
      if(square.some(c=>!c||c.excluded))continue;
      for(const tri of [[square[0],square[1],square[2]],[square[0],square[2],square[3]]]) {
        const lo=Math.min(...tri.map(c=>bpv(c.proposed))),hi=Math.max(...tri.map(c=>bpv(c.proposed)));
        for(let h=Math.ceil(lo*2)/2;h<hi;h+=.5) {
          const ends=[];
          for(let i=0;i<3;i++) {
            const a=tri[i],b=tri[(i+1)%3],ha=bpv(a.proposed),hb=bpv(b.proposed);
            if((ha<=h&&hb>h)||(hb<=h&&ha>h)) {const t=(h-ha)/(hb-ha);ends.push([a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t]);}
          }
          if(ends.length===2) {
            map.push(`<polyline points="${polygon(ends)}" fill="none" stroke="#397351" stroke-width=".8" opacity=".7"/>`);
            if(!contourLabels.has(h))contourLabels.set(h,ends[0]);
          }
        }
      }
    }
    for(const element of garden.elements.filter(e=>data.metadata.exclusions.includes(e.id)||['eastTerrace','westTerrace','pergola','pond','firePit','zasivarna'].includes(e.id))) {
      const part=element.parts.find(p=>['rect','polygon','circle','ellipse'].includes(p.kind));
      map.push(`<g fill="none" stroke="#425449" stroke-width="1.2">${geometry(part)}</g>`);
    }
    for(const route of garden.gardenRoutes??[])map.push(`<polyline points="${polygon(route.points)}" fill="none" stroke="#fffef9" stroke-width="${route.width*scale}" opacity=".65"/>`);
    for(const [i,section] of data.sections.entries()) {
      const a=section.vertices[0];
      map.push(`<polyline points="${polygon(section.vertices)}" fill="none" stroke="#57446d" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${px(a[0])+5}" y="${pz(a[1])-7}" font-size="13" font-weight="bold">S${i+1}</text>`);
    }
    for(const [i,review] of (site.spec.bankReview??[]).entries()) {
      const [x0,x1,z0,z1]=review.bounds;
      map.push(`<rect x="${px(x0)}" y="${pz(z0)}" width="${(x1-x0)*scale}" height="${(z1-z0)*scale}" fill="none" stroke="#a85f22" stroke-dasharray="3 3" stroke-width="1.5"/><text x="${px(x0)+3}" y="${pz(z0)+13}" font-size="12" font-weight="bold">R${i+1}</text>`);
    }
    map.push('</g>');
    for(const [h,p] of contourLabels)map.push(`<text x="${Math.max(55,Math.min(795,px(p[0])+3))}" y="${Math.max(52,pz(p[1])-3)}" font-size="10" stroke="#fffef9" stroke-width="3" paint-order="stroke">${f(h,1)}</text>`);
    map.push(`<polygon points="${polygon(garden.plot.vertices)}" fill="none" stroke="#293f32" stroke-width="2"/>`);
    for(const [i,point] of data.points.entries())map.push(`<circle cx="${px(point.x)}" cy="${pz(point.z)}" r="8" fill="#fffef9" stroke="#354e3d"/><text x="${px(point.x)}" y="${pz(point.z)+3}" font-size="8" text-anchor="middle">${i+1}</text>`);
    for(let x=Math.ceil(minX/5)*5;x<=maxX;x+=5)map.push(`<text x="${px(x)}" y="25" text-anchor="middle" font-size="11">${x}</text>`);
    for(let z=Math.ceil(minZ/5)*5;z<=maxZ;z+=5)map.push(`<text x="35" y="${pz(z)+4}" text-anchor="end" font-size="11">${z}</text>`);
    map.push('<text x="50" y="615" font-size="11">Local model coordinates: x east / z south · Not cadastral setting-out coordinates</text>');
    map.push(`<path d="M820 85V45M812 57L820 45L828 57" fill="none" stroke="#283b32" stroke-width="2"/><text x="820" y="35" text-anchor="middle" font-size="13">N</text><path d="M50 635h${scale*5}" stroke="#283b32" stroke-width="4"/><text x="${50+scale*2.5}" y="630" text-anchor="middle" font-size="11">5 m</text></svg>`);
    const mapSVG=map.join('');
    const t=data.totals;
    const pond=site.spec.pond;
    const steep=[...data.cells].filter(c=>!c.excluded&&c.surveyed&&((c.x-pond.cx)/pond.rx)**2+((c.z-pond.cz)/pond.rz)**2>1).sort((a,b)=>b.slope-a.slope).filter((c,i,a)=>a.slice(0,i).every(p=>Math.hypot(p.x-c.x,p.z-c.z)>2)).slice(0,5);
    const sheet1=`<section class="sheet">${header('Terrain works · grading overview',1)}<div class="warning">Discussion / pricing basis only. Proposed model ground is not a verified excavation formation or finished landscaping specification. Do not construct directly from this drawing.</div><div class="columns"><div>${mapSVG}<div class="legend"><span><i class="chip" style="background:#ca9674"></i>Cut: proposed below survey</span><span><i class="chip" style="background:#75a4ba"></i>Fill: proposed above survey</span><span>Grey: building exclusions / neutral</span><span>Hatching: extrapolated ground</span><span>Purple: section traces</span><span>Green contours: proposed Bpv every 0.5 m</span><span>Amber R boxes: unresolved details</span></div></div><aside><h2>Reading this plan</h2><p>Numbered points refer to the level schedule. Section traces S1–S${data.sections.length} show the ground between destinations. Blue and rust indicate height difference, not separate soil layers.</p><h3>Indicative geometric comparison</h3><div class="metrics"><div class="metric">Cut<strong>${f(t.cut,0)} m³</strong></div><div class="metric">Fill<strong>${f(t.fill,0)} m³</strong></div></div><p class="muted">Only ${f(t.area,0)} m² of non-building ground within the survey hull. Excludes ${f(t.excludedArea,0)} m² of building footprints and ${f(t.extrapolatedArea,0)} m² of extrapolated non-building ground. Rounded estimates, NOT order quantities.</p><p class="muted">${esc(data.metadata.volumeMethod)}. No demolition or disposal classification. Ground beneath terraces is the model surface, not a designed sub-base.</p><h3>Highest sampled banks outside pond</h3><table><thead><tr><th>x / z</th><th>Grade</th></tr></thead><tbody>${steep.map(c=>`<tr><td>${f(c.x)} / ${f(c.z)}</td><td>${f(c.slope,1)}%</td></tr>`).join('')}</tbody></table><p class="muted">Excludes building footprints and pond basin. Numerical gradients across 0.5 m identify places to review, not allowable slope limits. Steep transitions may require redesign or retaining details.</p></aside></div>${footer}</section>`;
    const finished=[['House finished floor',terrain.houseFFLInternal],['Terraces / sauna finish',site.spec.deckTop],['Pergola finish',site.spec.gatheringPads[0].level+.1],['Fire apron finish',garden.elements.find(e=>e.id==='firePit').meta.grading.level+garden.elements.find(e=>e.id==='firePit').meta.grading.surfaceOffset+.008],['Gate / wicket paving',site.spec.gateRunback.finishedLevel],['Bench mineral pad',site.spec.benchPad.level+.02]];
    for(const [id,label] of [['greenhouse','Greenhouse model floor (provisional)'],['raisedBeds','Raised-bed central aisle finish (provisional)']]){
      const point=data.points.find(p=>p.id===id);
      if(Number.isFinite(point?.finished))finished.push([label,point.finished]);
    }
    const sheet2=`<section class="sheet">${header('Levels & contractor coordination',2)}<div class="balanced"><div><h2>Ground sampling schedule</h2><p class="muted">Existing = interpolated survey, not a measured spot at every point. Proposed = model ground. Neither column is automatically a finished paving level.</p><table><thead><tr><th>Point / location</th><th>x / z</th><th>Existing Bpv</th><th>Ground Bpv</th><th>Δ m</th></tr></thead><tbody>${data.points.map((p,i)=>`<tr><td>${i+1}. ${esc(p.label)}${p.surveyed?'':' *'}</td><td>${f(p.x)} / ${f(p.z)}</td><td>${level(p.existing)}</td><td>${level(p.proposed)}</td><td>${signed(p.delta)}</td></tr>`).join('')}</tbody></table><p class="muted">* Outside survey hull, extrapolated. Positive Δ = fill; negative Δ = cut. Building-centre samples are orientation only and excluded from volume estimates.</p><h3>Modelled finish references</h3><table><thead><tr><th>Surface</th><th>Bpv m</th><th>Relative to house</th></tr></thead><tbody>${finished.map(([name,h])=>`<tr><td>${esc(name)}</td><td>${level(h)}</td><td>${signed(terrain.relToHouse(h))}</td></tr>`).join('')}</tbody></table></div><div><h2>Agree before excavation</h2><ol class="notes"><li><strong>Survey & setting out.</strong> Verify that the supplied ground survey represents today's site. Re-establish the house benchmark and property boundary with the surveyor. Local model x/z coordinates are not a setting-out system.</li><li><strong>Build-ups.</strong> Set topsoil stripping, reused soil quality, paving/sub-base thicknesses, compaction and actual formation levels. The model offsets do not specify construction layers.</li><li><strong>Water.</strong> Coordinate falls, drainage outlets, thresholds, waterproofing and pond overflow. No drainage design or discharge approval is implied by this ground model.</li><li><strong>Banks & retaining.</strong> Review the highest gradients and all sections. Determine stable slopes from the actual ground conditions and usable space. No retaining structure or soil stability calculation is included.</li><li><strong>Boundaries & services.</strong> Locate buried services, tank, shared electrical pillar and fence foundations. Do not attach the gate to the shared pillar or grade the neighbour's land.</li><li><strong>Access.</strong> Retain step-free house-to-sauna access, a level wicket swing, the 4 m vehicle opening and the 1 m wicket opening. Confirm paving clearances after build-ups are agreed.</li><li><strong>Quantities.</strong> Agree excavation and fill quantities from the approved formation model, not this geometric comparison. The net difference is not a soil reuse or haulage calculation.</li></ol><div class="warning">Recorded design intent: pergola below house level; firepit lower again; no new stairs; broad planted transitions; bench remains beside the garage.</div><h3>Source & revision</h3><p class="muted">${survey.data.points.length} supplied survey samples, triangulated by SurveySurface; proposed terrain by SiteTerrain through GradingSite. Model snapshot ${rev}. A snapshot identifies the calculation inputs, not an approved revision or survey date.</p></div></div>${footer}</section>`;
    function sectionSVG(section) {
      const values=section.samples.flatMap(s=>[s.existing,s.proposed,s.previous,s.finished].filter(Number.isFinite).map(bpv)), lo=Math.floor(Math.min(...values)*2)/2-.25,hi=Math.ceil(Math.max(...values)*2)/2+.25;
      const x=d=>65+d/section.length*550,y=h=>185-(bpv(h)-lo)/(hi-lo)*150;
      let out=`<svg xmlns="http://www.w3.org/2000/svg" width="650" height="230" viewBox="0 0 650 230" role="img" aria-label="${esc(section.label)} section"><title>${esc(section.label)}</title>`;
      for(let h=Math.ceil(lo*2)/2;h<=hi;h+=.5)out+=`<path d="M65 ${185-(h-lo)/(hi-lo)*150}H615" stroke="#dce2d7"/><text x="57" y="${189-(h-lo)/(hi-lo)*150}" text-anchor="end" font-size="10">${f(h,1)}</text>`;
      for(const [key,color] of [['existing','#986f49'],['previous','#7982a3'],['proposed','#397351'],['finished','#714d91']]) {
        if(key==='previous'&&!baseline)continue;
        for(let i=1;i<section.samples.length;i++) {
          const a=section.samples[i-1],b=section.samples[i];
          if(!Number.isFinite(a[key])||!Number.isFinite(b[key]))continue;
          out+=`<path d="M${x(a.distance)} ${y(a[key])}L${x(b.distance)} ${y(b[key])}" fill="none" stroke="${color}" stroke-width="2"${key==='previous'?' stroke-dasharray="6 3"':!a.surveyed||!b.surveyed?' stroke-dasharray="3 3"':''} opacity="${key!=='finished'&&(a.excluded||b.excluded)?'.35':'1'}"/>`;
        }
      }
      const interval=section.length<=5?1:5;
      for(let d=0;d<section.length-.35;d+=interval)out+=`<text x="${x(d)}" y="206" font-size="10" text-anchor="middle">${f(d,0)}</text>`;
      out+=`<text x="615" y="206" font-size="10" text-anchor="end">${f(section.length)}</text>`;
      out+=`<text x="615" y="222" font-size="10" text-anchor="end">Distance along section · m</text><text x="65" y="17" font-size="10">Bpv m · H/V scales differ; do not measure slopes from the graphic</text></svg>`;
      return out;
    }
    const sections=[];
    const sectionNote=s=>`Length ${f(s.length)} m · Highest sampled ground grade ${f(s.maxSlope,1)}% outside buildings. ${Number.isFinite(s.maxFinishSlope)?`Highest sampled walking-finish grade ${f(s.maxFinishSlope,1)}% along the centreline.`:`${s.id==='fire-pond'?'Includes the pond basin; NOT a pedestrian route. ':''}Ground only, not the walking surface.`} Sampling every ≤${s.sampleStep} m; not structural formation.`;
    for(let first=0;first<data.sections.length;first+=4)sections.push(`<section class="sheet">${header('Ground, walking finish & transitions',3+first/4)}<div class="legend"><span style="color:#986f49">Brown: existing survey interpolation</span><span style="color:#397351">Green: proposed model ground</span><span style="color:#714d91">Purple: modeled walking finish</span><span>Dashed: extrapolated · Faded ground: building footprint</span>${baseline?'<span style="color:#7982a3">Blue-grey dashed: previous proposal</span>':''}</div><p class="muted">${esc(data.metadata.routeSlopeMethod)}</p><div class="section-grid">${data.sections.slice(first,first+4).map((s,i)=>`<div class="section-card"><h3>S${first+i+1} · ${esc(s.label)}</h3>${sectionSVG(s)}<p class="muted">${sectionNote(s)}</p></div>`).join('')}</div>${footer}</section>`);
    const reviewSheet=site.spec.bankReview?.length?`<section class="sheet">${header('Changes & unresolved details',3+Math.ceil(data.sections.length/4))}<div class="balanced"><div><h2>Surface changes and comparison</h2>${baseline?`<p>Before snapshot ${esc(baseline.revision)}. Current snapshot ${rev}. Dashed blue-grey section lines show the previous proposed ground; brown is the survey and green is current proposed ground.</p><table><thead><tr><th>Indicative volume</th><th>Before</th><th>Current</th><th>Difference</th></tr></thead><tbody>${['cut','fill'].map(key=>`<tr><td>${key}</td><td>${f(baseline.totals[key],0)} m³</td><td>${f(t[key],0)} m³</td><td>${signed(t[key]-baseline.totals[key])} m³</td></tr>`).join('')}</tbody></table><p class="muted">Same grid and exclusions. This compares model surfaces, not construction quantities or truck movements.</p>`:'<p>No previous snapshot is available. The sections show current ground and the supplied survey only.</p>'}<h3>Preserved constraints</h3><ul><li>House, terrace, sauna, pergola and firepit finish levels.</li><li>Greenhouse, raised-bed and compost footprints; bench position and platform.</li><li>No new stairs; the southern one-metre strip.</li><li>Sampled boundary levels, vehicle gate and wicket landing.</li></ul><h3>What changed</h3>${site.spec.productiveCourt?'<p>The productive court is lowered and regraded into a sloped walking approach with two level crossfall aisles. The greenhouse and each individual raised bed stay level; their bases meet the sloping ground. The former single flat raised-bed platform is not retained.</p>':''}<p>The west and south banks use longer transitions instead of wide flat runouts ending in abrupt slopes. The gathering path has broader shoulders, and the daily dining shoulder blends around fixed platform footprints.</p></div><div><h2>Resolve before construction</h2>${site.spec.bankReview.map((r,i)=>`<div class="warning"><h3>R${i+1} · ${esc(r.label)}</h3><p>${esc(r.status)}</p></div>`).join('')}<p>The amber boxes on the plan identify coordination areas, not designed retaining-wall locations. Wall type, foundations, soil stability, drainage and surface build-ups remain unresolved.</p><p>Residual banks are still steep. This pass reduces local peaks; it does not certify safe slopes or make the entire model construction-ready.</p></div></div>${footer}</section>`:'';
    return {html:sheet1+sheet2+sections.join('')+reviewSheet,css,mapSVG,revision:rev};
  }
  return {render};
})();
if(typeof module !== 'undefined') module.exports = {GradingReport};
