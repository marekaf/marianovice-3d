const PlantingGuide = (() => {
  function create(plants,trees=[]) {
    const panel=document.createElement('details');
    panel.id='plantingGuide';
    const summary=document.createElement('summary');summary.textContent='Trees and perennial palette';
    const note=document.createElement('p');
    note.textContent='Proposed planting forms from the local design notes where available. Heights and flowering months are approximate. Rendered clumps are not purchase quantities. Use the date slider to compare flowering, seedheads and dormancy.';
    note.style.cssText='max-width:290px;font-size:11px;line-height:1.4';
    const select=document.createElement('select');select.setAttribute('aria-label','Planting bed');select.style.maxWidth='290px';
    const list=document.createElement('ul');list.style.cssText='max-width:270px;padding-left:18px;font-size:11px;line-height:1.5';
    const zones=[...new Set(plants.map(p=>p.userData.zoneId))].sort();
    for(const zone of zones){const option=document.createElement('option');option.value=zone;option.textContent=zone.replace(/([a-z])([A-Z])/g,'$1 $2');select.append(option);}
    function update(){
      list.replaceChildren();
      const names=[...new Set(plants.filter(p=>p.userData.zoneId===select.value).map(p=>p.name))].sort();
      for(const name of names){const item=document.createElement('li');item.textContent=name;list.append(item);}
    }
    select.addEventListener('change',update);update();
    const treeList=document.createElement('ul');treeList.style.cssText=list.style.cssText;
    const treeCounts=new Map();
    for(const tree of trees){const label=tree.userData.treeLabel??tree.userData.treeForm;treeCounts.set(label,(treeCounts.get(label)??0)+1);}
    for(const [label,count] of treeCounts){const item=document.createElement('li');item.textContent=`${label}: ${count}`;treeList.append(item);}
    panel.append(summary,note,treeList,select,list);document.getElementById('timeBar').append(panel);
    return {panel,dispose(){panel.remove();}};
  }
  return {create};
})();
