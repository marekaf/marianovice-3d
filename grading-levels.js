const GradingLevels = (() => {
  const number=value=>value.toFixed(2).replace('.',',').replace('-','−');
  const relative=value=>Math.abs(value)<.0005?'±0,000':(value>0?'+':'')+value.toFixed(3).replace('.',',').replace('-','−');
  function controls({garden,terrain,site,survey,quantities,banks}) {
    const absolute=h=>terrain.bpvDatum+h-terrain.houseFFLInternal;
    const finish=(id,position,label,height,offset=[0,0])=>({id,position,label,surface:'finish',proposed:absolute(height),offset});
    const ground=(id,position,label,box,compare=true)=>({id,position,label,box,compare,surface:'ground',existing:absolute(survey.height(...position)),proposed:absolute(site.height(...position))});
    const house=garden.elements.find(e=>e.id==='house').meta.bbox;
    const terrace=garden.elements.find(e=>e.id==='eastTerrace').parts.find(p=>p.kind==='rect');
    const pergola=garden.elements.find(e=>e.id==='pergola').parts.find(p=>p.kind==='rect');
    const sw=site.spec.fixedFences.segments.flatMap(s=>[s.start,s.end]).filter(p=>p[1]>house[3]).sort((a,b)=>a[0]-b[0])[0];
    return [
      ground('north-west',[12,2],'SEVER · ZÁPAD',[90,42]),
      ground('north-middle',[20,2],'SEVER · STŘED',[220,42]),
      ...banks.filter(b=>b.id==='pergola-north').flatMap(bank=>[
        ground('pergola-ground',[bank.spotCrest[0],pergola.y+pergola.d*.8],'PERGOLA · TERÉN',[350,42]),
        ground('pergola-fence',bank.spotFoot,'PLOT U PERGOLY',[480,42])
      ]),
      ...garden.gradingBanks.filter(b=>b.id==='north').flatMap(bank=>[
        ground('north-crest',bank.spotCrest,'HORNÍ HRANA SVAHU',[610,42]),
        ground('north-foot',bank.spotFoot,'SEVERNÍ PLOT',[740,42])
      ]),
      ...garden.gradingBanks.filter(b=>b.id==='east').map(bank=>ground('east-foot',bank.spotFoot,'VÝCHODNÍ PLOT',[810,180])),
      ground('southwest',sw,'JIHOZÁPADNÍ PLOT',[100,600]),
      ...[
        ['west-upper',[-1.35,7.64],'ZÁPADNÍ PLOT',[52,190]],
        ['west-middle',[-.83,15.04],'ZÁPADNÍ PLOT',[52,330]],
        ['west-lower',[-.22,22.57],'ZÁPADNÍ PLOT',[52,465]],
        ['east-middle',[42.68,13.44],'VÝCHODNÍ PLOT',[817,300]],
        ['east-lower',[43.43,22.31],'VÝCHODNÍ PLOT',[817,420]],
        ['south-house',[10,31.44764],'JIŽNÍ HRANICE',[250,600]],
        ['south-apron',[26,32.89525],'JIŽNÍ HRANICE',[430,600]],
        ['south-ramp',[38,33.980998],'JIŽNÍ HRANICE',[600,600]],
        ['west-bank',[5,20],'TERÉN · ZÁPAD',[165,360],false],
        ['drainage',[9.105,22],'TERÉN · SNÍŽENÝ PÁS',[220,425],false],
        ['lower-fill',[37,10],'TERÉN · NÁSYP',[667,275],false],
        ['east-apron',[41.25,23.45],'TERÉN U ŠACHTY',[665,465],false],
        ['firepit',[31.5,6.5],'TERÉN U OHNIŠTĚ',[612,180],false],
        ['bench',[32.3,18.55],'TERÉN U LAVIČKY',[610,405],false]
      ].map(args=>ground(...args)),
      finish('house',[(house[0]+house[2])/2,house[1]+8],'PODLAHA DOMU',terrain.houseFFLInternal),
      finish('eastTerrace',[terrace.x+terrace.w/2,terrace.y+terrace.d*.7],'TERASA BEZ SCHODŮ',site.spec.deckTop,[75,-10]),
      ...[
        ['sauna',[5.9,3.2],'PODLAHA SAUNY',terrain.houseFFLInternal,[180,135]],
        ['greenhouse',[2.5,8.1],'PODLAHA SKLENÍKU',site.spec.productiveCourt.greenhouseFinish,[155,245]],
        ['westTerrace',[9.98,18],'ZÁPADNÍ TERASA',terrain.houseFFLInternal,[325,355]],
        ['pergola',[25.42785414913,3.4],'POVRCH PERGOLY',site.spec.gatheringPads[0].level+.1,[462,145]],
        ['service',[19,27],'SERVISNÍ ŠTĚRK',site.spec.drivewayProfile.startLevel+.07,[375,505]],
        ['gate',site.spec.drivewayProfile.gate,'PRÁH BRÁNY',site.spec.gateRunback.finishedLevel,[745,600]],
        ['wicket',site.spec.wicketLanding.points[2],'PLOCHA BRANKY',site.spec.wicketLanding.finishedLevel,[840,600]]
      ].map(([id,position,label,height,box])=>({...finish(id,position,label,height),box})),
      ...quantities.levelMarks.map(mark=>{
        const level=mark.id==='raisedBeds'?site.routeHeight(...mark.position):site.height(...mark.position)+(mark.id==='C'?.04:site.spec.drivewayProfile.surfaceOffset);
        const label={carport:'PŘÍSTŘEŠEK',A:'PŘÍJEZD',C:'ROVNÁ ČÁST C',raisedBeds:'POVRCH MEZI ZÁHONY'}[mark.id];
        const offset={carport:[0,12],A:[-5,8],C:[60,-30],raisedBeds:[-8,15]}[mark.id];
        return finish(mark.id,mark.position,label,level,offset);
      })
    ];
  }
  const mapIds=new Set(['north-middle','pergola-ground','pergola-fence','north-crest','north-foot','east-foot','southwest','drainage']);
  function svg({garden,terrain,site,survey,quantities,banks,px,pz}) {
    return controls({garden,terrain,site,survey,quantities,banks}).filter(mark=>mapIds.has(mark.id)||mark.surface==='finish'&&mark.id!=='house').map(mark=>{
      const x=px(mark.position[0]),y=pz(mark.position[1]);
      const nearby={
        'north-middle':[-5,5],'pergola-ground':[0,34],'pergola-fence':[-10,-28],
        'north-crest':[35,25],'north-foot':[0,-28],'east-foot':[35,0],
        'southwest':[-20,30],'drainage':[-8,0],
        'eastTerrace':[0,0],'westTerrace':[0,0],'sauna':[0,22],
        'greenhouse':[28,0],'pergola':[0,15],'service':[-20,27],
        'gate':[-24,13],'wicket':[30,20],'carport':[0,15],
        'A':[0,0],'C':[0,0],'raisedBeds':[43,0]
      }[mark.id];
      const [cx,cy]=nearby?[x+nearby[0],y+nearby[1]]:mark.box??[x+mark.offset[0],y+mark.offset[1]];
      const ground=mark.surface==='ground'&&mark.compare!==false,width=34,left=cx-width/2,top=cy-12;
      const leader=[Math.max(left,Math.min(left+width,x)),Math.max(top,Math.min(top+24,y))];
      const existing=mark.surface==='ground'?mark.existing.toFixed(5):'';
      const label={gate:'BRÁNA',wicket:'BRANKA',service:'SERVIS',raisedBeds:'ZÁHONY',C:'TRÁVNÍK',drainage:'TERÉN', 'pergola-ground':'TERÉN'}[mark.id]??(ground?mark.label:'');
      const rows=`<text x="${cx}" y="${cy-3}" text-anchor="middle" font-size="9">${number(mark.proposed)}</text><text x="${cx}" y="${cy+9}" text-anchor="middle" font-size="9">${relative(mark.proposed-terrain.bpvDatum)}</text>`;
      return `<g data-elevation="${mark.id}" data-surface="${mark.surface}" data-existing="${existing}" data-proposed="${mark.proposed.toFixed(5)}"><title>${mark.label}: ${mark.surface==='ground'?'upravený terén':'hotový povrch'} · Bpv / relativní výška</title><path d="M${x-2} ${y}h4M${x} ${y-2}v4M${x} ${y}L${leader[0]} ${leader[1]}" fill="none" stroke="#555" stroke-width=".45"/><rect data-level-box="${mark.id}" x="${left}" y="${top}" width="${width}" height="24" fill="white" stroke="#222" stroke-width=".5"/><path d="M${left} ${cy}h${width}" stroke="#222" stroke-width=".35"/>${label?`<text x="${cx}" y="${top-3}" text-anchor="middle" font-size="6.5" stroke="white" stroke-width="2" paint-order="stroke">${label}</text>`:''}${ground?`<text data-existing-height="${mark.id}" x="${cx}" y="${cy+21}" text-anchor="middle" font-size="7" style="fill:#999">${number(mark.existing)}</text>`:''}${rows}</g>`;
    }).join('');
  }
  function schedule({garden,terrain,site,survey,quantities,banks}) {
    const zones={house:'F',eastTerrace:'D',sauna:'G',greenhouse:'G',westTerrace:'K',pergola:'C',service:'A',gate:'B',wicket:'B',carport:'M',A:'A',C:'C',raisedBeds:'G'};
    return controls({garden,terrain,site,survey,quantities,banks}).filter(mark=>mark.surface==='finish').map(mark=>({...mark,zone:zones[mark.id],absoluteText:number(mark.proposed),relativeText:relative(mark.proposed-terrain.bpvDatum)}));
  }
  return {controls,svg,schedule};
})();
if(typeof module!=='undefined')module.exports={GradingLevels};
