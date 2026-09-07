const PlantingPreview = (() => {
  function create({ scene, camera, renderer, treesGroup }) {
    const plants = treesGroup.children.filter(plant => Number.isFinite(plant.userData.plantingScale));
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Compare planting sizes';
    button.style.cssText = 'margin-top:8px;background:#526c50;color:white;border:0;border-radius:4px;padding:6px 9px;cursor:pointer';
    document.getElementById('timeBar').append(button);
    const dialog = document.createElement('dialog');
    dialog.id = 'plantingComparison';
    dialog.style.cssText = 'background:#202820;color:#f1f1e8;border:1px solid #788574;border-radius:8px;padding:18px;width:min(1400px,94vw);max-width:94vw;max-height:90vh;overflow:auto';
    dialog.innerHTML = '<h2 style="margin:0 0 8px;font:600 20px system-ui">Planting size comparison</h2><p style="font:14px system-ui">Same viewpoint, season and light. Illustrative nursery-size and established trees, shrubs, climbers and perennial clumps, not a growth forecast.</p><div data-comparison style="display:flex;flex-wrap:wrap;gap:12px"></div><button type="button" data-close style="margin-top:14px;padding:7px 18px">Close</button>';
    document.body.append(dialog);
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    const row = dialog.querySelector('[data-comparison]');
    const images = ['Newly planted · illustrative nursery size', 'Established · design size'].map(label => {
      const figure = document.createElement('figure');
      figure.style.cssText = 'margin:0;flex:1 1 420px';
      const image = document.createElement('img');
      image.alt = label;
      image.style.cssText = 'display:block;width:100%;height:auto;border-radius:4px';
      const caption = document.createElement('figcaption');
      caption.textContent = label;
      caption.style.cssText = 'font:14px system-ui;margin-top:6px';
      figure.append(image, caption);
      row.append(figure);
      return image;
    });
    const capture = () => {
      const scales = plants.map(plant => plant.scale.clone());
      const visible = treesGroup.visible;
      const autoUpdate = renderer.shadowMap.autoUpdate;
      try {
        treesGroup.visible = true;
        renderer.shadowMap.autoUpdate = true;
        for (const [index, nursery] of [true, false].entries()) {
          plants.forEach((plant, i) => plant.scale.copy(scales[i]).multiplyScalar(nursery ? plant.userData.plantingScale : 1));
          scene.updateMatrixWorld(true);
          renderer.shadowMap.needsUpdate = true;
          renderer.render(scene, camera);
          images[index].src = renderer.domElement.toDataURL('image/png');
        }
        dialog.showModal();
      } finally {
        plants.forEach((plant, i) => plant.scale.copy(scales[i]));
        treesGroup.visible = visible;
        renderer.shadowMap.autoUpdate = autoUpdate;
        renderer.shadowMap.needsUpdate = true;
        scene.updateMatrixWorld(true);
        renderer.render(scene, camera);
      }
    };
    button.addEventListener('click', capture);
    return { capture, plantCount: plants.length, dispose() { button.remove(); dialog.remove(); } };
  }
  return { create };
})();
