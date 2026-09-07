const TerrainPreview = (() => {
  function create({THREE,scene,ground,existingHeight,proposedHeight,surveyed}) {
    const panel=document.createElement('details');
    panel.id='terrainPreview';
    const summary=document.createElement('summary');summary.textContent='Ground and grading';
    const label=document.createElement('label');label.textContent=' Ground view ';
    const select=document.createElement('select');select.id='terrainMode';
    for(const [value,text] of [['proposed','Proposed ground'],['existing','Existing ground'],['difference','Cut / fill comparison']]) {
      const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
    }
    label.append(select);
    const note=document.createElement('p');
    note.style.cssText='max-width:290px;font-size:11px;line-height:1.4;margin:6px 0';
    const source=surveyed?'Existing ground is interpolated from the local survey.':'Existing ground uses the approximate fallback plane.';
    note.textContent=source+' Grading and deck supports are design proposals, not construction approval. Drainage, foundations and retaining design need technical coordination. Buildings remain at their proposed levels; existing-ground mode may intersect proposed structures.';
    const legend=document.createElement('p');legend.textContent='Blue: fill · rust: cut · grey: under 5 cm. Full colour at 1 m.';
    legend.style.cssText='max-width:290px;font-size:11px;margin:6px 0';legend.hidden=true;
    panel.append(summary,label,note,legend);document.getElementById('timeBar').append(panel);
    const geometry=ground.geometry.clone();
    const positions=geometry.attributes.position;
    const existing=new Float32Array(positions.count),proposed=new Float32Array(positions.count),colors=new Float32Array(positions.count*3);
    const neutral=new THREE.Color('#b8b7aa'),fill=new THREE.Color('#3679ad'),cut=new THREE.Color('#bd643d');
    for(let i=0;i<positions.count;i++) {
      const x=positions.getX(i),z=positions.getZ(i);
      existing[i]=existingHeight(x,z);proposed[i]=proposedHeight(x,z);
      const delta=proposed[i]-existing[i];
      const color=neutral.clone().lerp(delta>=0?fill:cut,Math.max(0,Math.min(1,(Math.abs(delta)-.05)/.95)));
      color.toArray(colors,i*3);
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
    const comparison=new THREE.Mesh(geometry,material);comparison.visible=false;comparison.receiveShadow=true;scene.add(comparison);
    function update() {
      const mode=select.value;ground.visible=mode==='proposed';comparison.visible=!ground.visible;
      legend.hidden=mode!=='difference';
      material.vertexColors=mode==='difference';material.color.set(mode==='existing'?'#b0b49b':'#ffffff');material.needsUpdate=true;
      for(let i=0;i<positions.count;i++)positions.setY(i,(mode==='existing'?existing[i]:proposed[i])+.002);
      positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
    }
    select.addEventListener('change',update);
    return {panel,select,comparison,update,dispose(){panel.remove();scene.remove(comparison);geometry.dispose();material.dispose();}};
  }
  return {create};
})();
