const PlantingProfiles = (() => {
  const defaults = [
    {name:'Fine grass form',profile:'grass',height:.75,bloom:[7,8,9],winterInterest:true},
    {name:'White flower spires',profile:'spire',height:.5,bloom:[6,7,8]},
    {name:'Pale yellow daisies',profile:'daisy',height:.45,bloom:[6,7,8,9]},
    {name:'Flat flower heads',profile:'umbel',height:.8,bloom:[6,7,8],winterInterest:true},
  ];
  function hash(x,z) {
    const n=Math.sin(x*127.1+z*311.7)*43758.5453123;
    return n-Math.floor(n);
  }
  function form(name) {
    if(/Helictotrichon|Sporobolus|Molinia|Carex|Chasmanthium|Miscanthus|Sesleria|Hakonechloa/.test(name))return {profile:'grass',color:'#bca56c'};
    if(/Salvia|Agastache|Persicaria|Veronica/.test(name))return {profile:'spire',color:/Schneehügel/.test(name)?'#eee9dc':'#8050af'};
    if(/Achillea|Solidaster|Cephalaria|Sanguisorba|Verbena/.test(name))return {profile:'umbel',color:/Verbena/.test(name)?'#9860b8':'#e8c458'};
    if(/Bergenia|Geranium|Epimedium|Vinca|Polygonatum|Helleborus|Heuchera|Galium/.test(name))return {profile:'broadleaf',color:'#ca94ba'};
    return {profile:'daisy',color:/Moonbeam/.test(name)?'#e4d680':/Coreopsis|Rudbeckia|paradoxa|Gaillardia/.test(name)?'#efbf3f':/Echinacea/.test(name)?'#c65e91':'#e6e2d7'};
  }
  function sample(zoneId,x,z,kind='perennials',palette={}) {
    const choices=palette[zoneId]?.length?palette[zoneId]:defaults;
    const weights=choices.map(s=>(s.share??1)*({kosterni:.08,skupinove:.5,pudopokryvne:.3,vtrousene:.12}[s.role]??1));
    const total=weights.reduce((a,b)=>a+b,0);
    let pick=hash(Math.floor(x/1.5),Math.floor(z/1.5))*total,index=0;
    while(index<choices.length-1&&pick>=weights[index])pick-=weights[index++];
    const source=choices[index];
    const seed=Math.round(hash(x,z)*1e8);
    const height=Math.max(.15,source.height*(.88+hash(z,x)*.2))*(kind==='meadow'?.72:1);
    return {...form(source.name),...source,height,
      spread:Math.min(.48,Math.max(.28,height*.4)),seed,
      bloom:source.bloom??[6,7,8],winterInterest:!!source.winterInterest};
  }
  return {sample,hash};
})();
if(typeof module!=='undefined')module.exports={PlantingProfiles};
