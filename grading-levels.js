const GradingLevels = (() => {
  const number=value=>value.toFixed(2).replace('.',',').replace('-','−');
  const relative=value=>Math.abs(value)<.005?'±0,00':(value>0?'+':'')+number(value);
  function controls({garden,terrain,site,survey,quantities,banks}) {
    const absolute=h=>terrain.bpvDatum+h-terrain.houseFFLInternal;
    const finish=(id,position,label,height,offset=[0,0])=>({id,position,label,surface:'finish',proposed:absolute(height),offset});
    const ground=(id,position,label,box)=>({id,position,label,box,surface:'ground',existing:absolute(survey.height(...position)),proposed:absolute(site.height(...position))});
    const house=garden.elements.find(e=>e.id==='house').meta.bbox;
    const terrace=garden.elements.find(e=>e.id==='eastTerrace').parts.find(p=>p.kind==='rect');
    const sw=site.spec.fixedFences.segments.flatMap(s=>[s.start,s.end]).filter(p=>p[1]>house[3]).sort((a,b)=>a[0]-b[0])[0];
    return [
      ground('north-west',[12,2],'SEVER · ZÁPAD',[90,42]),
      ground('north-middle',[20,2],'SEVER · STŘED',[220,42]),
      ...banks.filter(b=>b.id==='pergola-north').flatMap(bank=>[
        ground('pergola-ground',bank.spotCrest,'PERGOLA · TERÉN',[350,42]),
        ground('pergola-fence',bank.spotFoot,'PLOT U PERGOLY',[480,42])
      ]),
      ...garden.gradingBanks.filter(b=>b.id==='north').flatMap(bank=>[
        ground('north-crest',bank.spotCrest,'HORNÍ HRANA SVAHU',[610,42]),
        ground('north-foot',bank.spotFoot,'SEVERNÍ PLOT',[740,42])
      ]),
      ...garden.gradingBanks.filter(b=>b.id==='east').map(bank=>ground('east-foot',bank.spotFoot,'VÝCHODNÍ PLOT',[810,180])),
      ground('southwest',sw,'JIHOZÁPADNÍ PLOT',[100,600]),
      finish('house',[(house[0]+house[2])/2,house[1]+8],'PODLAHA DOMU',terrain.houseFFLInternal),
      finish('eastTerrace',[terrace.x+terrace.w/2,terrace.y+terrace.d*.7],'TERASA BEZ SCHODŮ',site.spec.deckTop,[75,-10]),
      ...quantities.levelMarks.map(mark=>{
        const level=mark.id==='raisedBeds'?site.routeHeight(...mark.position):site.height(...mark.position)+(mark.id==='C'?.04:site.spec.drivewayProfile.surfaceOffset);
        const label={carport:'PŘÍSTŘEŠEK',A:'PŘÍJEZD',C:'ROVNÁ ČÁST C',raisedBeds:'POVRCH MEZI ZÁHONY'}[mark.id];
        const offset={carport:[0,12],A:[-5,8],C:[60,-30],raisedBeds:[-8,15]}[mark.id];
        return finish(mark.id,mark.position,label,level,offset);
      })
    ];
  }
  function svg({garden,terrain,site,survey,quantities,banks,px,pz}) {
    return controls({garden,terrain,site,survey,quantities,banks}).map(mark=>{
      const x=px(mark.position[0]),y=pz(mark.position[1]);
      const [cx,cy]=mark.box??[x+mark.offset[0],y+mark.offset[1]];
      const ground=mark.surface==='ground',width=ground?96:56,left=cx-width/2,top=cy-15;
      const existing=ground?mark.existing.toFixed(5):'';
      const values=ground?[mark.existing,mark.proposed]:[mark.proposed];
      const rows=values.map((value,i)=>{
        const tx=left+(ground?24+i*48:28),color=ground&&i===0?'#666':'#9e3028';
        return `<text x="${tx}" y="${cy-3}" text-anchor="middle" font-size="10" style="fill:${color}">${number(value)}</text><text x="${tx}" y="${cy+10}" text-anchor="middle" font-size="10" style="fill:${color}">${relative(value-terrain.bpvDatum)}</text>`;
      }).join('');
      return `<g data-elevation="${mark.id}" data-surface="${mark.surface}" data-existing="${existing}" data-proposed="${mark.proposed.toFixed(5)}"><title>${mark.label}: ${ground?'stávající / upravený terén':'hotový povrch'} · Bpv / relativní výška</title><path d="M${x-3} ${y}h6M${x} ${y-3}v6M${x} ${y}L${cx} ${cy+15}" fill="none" stroke="#555" stroke-width=".6"/><rect data-level-box="${mark.id}" x="${left}" y="${top}" width="${width}" height="30" fill="white" stroke="#555" stroke-width=".6"/><path d="M${left} ${cy}h${width}${ground?`M${cx} ${top}v30`:''}" stroke="#888" stroke-width=".4"/><text x="${cx}" y="${top-13}" text-anchor="middle" font-size="8" font-weight="600" stroke="white" stroke-width="2.5" paint-order="stroke">${mark.label}</text>${ground?`<text x="${cx-24}" y="${top-3}" text-anchor="middle" font-size="8">ST</text><text x="${cx+24}" y="${top-3}" text-anchor="middle" font-size="8" style="fill:#9e3028">UT</text>`:''}${rows}</g>`;
    }).join('');
  }
  return {controls,svg};
})();
if(typeof module!=='undefined')module.exports={GradingLevels};
