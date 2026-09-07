const SeasonalPlanting = (() => {
  function create({ THREE, treesGroup, renderer }) {
    const canopies = [];
    treesGroup.traverse(mesh => {
      if (!mesh.userData.leafHabit || !mesh.instanceColor) return;
      canopies.push({ mesh, count: mesh.count, visible: mesh.visible, colors: mesh.instanceColor.array.slice() });
    });
    const autumn = new THREE.Color('#bd843b');
    const color = new THREE.Color();
    let current = '';
    function update(day) {
      const season = day < 95 || day > 320 ? 'winter' : day < 145 ? 'spring' : day > 245 ? 'autumn' : 'summer';
      if (season === current) return;
      current = season;
      for (const { mesh, count, visible, colors } of canopies) {
        const deciduous = mesh.userData.leafHabit === 'deciduous';
        mesh.visible = visible && !(deciduous && season === 'winter');
        mesh.count = Math.floor(count * (deciduous && season === 'spring' ? 0.35 : deciduous && season === 'autumn' ? 0.75 : 1));
        mesh.instanceColor.array.set(colors);
        if (deciduous && season === 'autumn') {
          for (let i = 0; i < count; i++) {
            color.fromArray(colors, i * 3).lerp(autumn, 0.45 + (i % 7) * 0.065);
            mesh.setColorAt(i, color);
          }
        }
        mesh.instanceColor.needsUpdate = true;
      }
      renderer.shadowMap.needsUpdate = true;
    }
    return { update, get season() { return current; }, canopyCount: canopies.length };
  }
  return { create };
})();
