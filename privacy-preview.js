const PrivacyPreview = (() => {
  function create({ THREE, scene, terrainHeight, saunaModel, pergolaModel, saunaGroup, pergolaGroup }) {
    const tub = saunaModel.parts.find(part => part.name === 'tub_water').position;
    const seat = [...pergolaModel.diningSeats].sort((a, b) => a.center[1] - b.center[1])[0];
    const northTub = saunaModel.privacyScreens.find(screen => screen.side === 'north');
    const westTub = saunaModel.privacyScreens.find(screen => screen.side === 'west');
    const northPergola = pergolaModel.privacyScreens.find(screen => screen.side === 'north');
    const probes = [
      { id: 'tub-north', label: 'North → bathing position', screen: northTub, target: [tub[0], saunaModel.floorHeight + 0.95, tub[1]], side: 'north' },
      { id: 'tub-west', label: 'West → bathing position', screen: westTub, target: [tub[0], saunaModel.floorHeight + 0.95, tub[1]], side: 'west' },
      { id: 'pergola-north', label: 'North → pergola seat', screen: northPergola, target: [seat.center[0], pergolaModel.floorHeight + seat.seatHeight + 0.75, seat.center[1]], side: 'north' },
    ];
    const structure = [];
    for (const group of [saunaGroup, pergolaGroup]) group.traverse(object => {
      if (!object.isMesh || object.material.transmission > 0 || object.material.transparent) return;
      let category = object;
      while (category.parent && category.parent !== group) category = category.parent;
      if (!['furniture', 'light'].includes(category.name)) structure.push(object);
    });
    const overlay = new THREE.Group();
    overlay.name = 'Hypothetical privacy probes';
    overlay.visible = false;
    scene.add(overlay);
    const sphereGeometry = new THREE.SphereGeometry(0.065, 12, 8);
    const details = document.createElement('details');
    details.id = 'privacyProbes';
    details.style.cssText = 'margin-top:8px;border-top:1px solid #697369;padding-top:7px;max-width:320px';
    details.innerHTML = '<summary style="cursor:pointer;font-weight:600">Neighbour sightline probes</summary><p style="margin:8px 0">Hypothetical observation points, not surveyed neighbour windows. Height is above the model ground at each point.</p><label>Observer eye height <output data-height-value>1.70 m</output><input aria-label="Observer eye height" data-privacy-height type="range" min="1" max="4" step="0.05" value="1.7" style="display:block;width:100%"></label><label>Distance outside screen <output data-distance-value>3.0 m</output><input aria-label="Distance outside screen" data-privacy-distance type="range" min="1" max="8" step="0.25" value="3" style="display:block;width:100%"></label><div data-probes></div><p style="margin:8px 0 0;color:#d3dfcf">Green: blocked. Orange: open. Only opaque sauna/pergola structures are tested; foliage and furniture are excluded. A single ray does not prove privacy across an entire screen. Bathing target: 0.95 m above deck. Dining target: 0.75 m above seat.</p>';
    document.getElementById('timeBar').append(details);
    const heightInput = details.querySelector('[data-privacy-height]');
    const distanceInput = details.querySelector('[data-privacy-distance]');
    for (const probe of probes) {
      const row = document.createElement('label');
      row.style.cssText = 'display:block;margin-top:8px';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.setAttribute('aria-label', probe.label);
      const status = document.createElement('span');
      status.dataset.privacyState = probe.id;
      status.style.cssText = 'display:block;margin-left:20px';
      row.append(checkbox, ` ${probe.label}`, status);
      details.querySelector('[data-probes]').append(row);
      const material = new THREE.LineBasicMaterial({ color: 0x56ce80, depthTest: false, transparent: true, opacity: 0.88 });
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geometry, material);
      line.renderOrder = 100;
      line.raycast = () => {};
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x56ce80, depthTest: false });
      const markers = Array.from({ length: 2 }, () => {
        const marker = new THREE.Mesh(sphereGeometry, markerMaterial);
        marker.renderOrder = 101;
        marker.raycast = () => {};
        return marker;
      });
      overlay.add(line, ...markers);
      Object.assign(probe, { checkbox, status, line, markers, material, markerMaterial });
    }
    let results = [];
    function update() {
      const eyeHeight = Number(heightInput.value), distance = Number(distanceInput.value);
      details.querySelector('[data-height-value]').value = `${eyeHeight.toFixed(2)} m`;
      details.querySelector('[data-distance-value]').value = `${distance.toFixed(2)} m`;
      overlay.visible = details.open;
      scene.updateMatrixWorld(true);
      results = probes.map(probe => {
        const target = new THREE.Vector3(...probe.target);
        const x = probe.side === 'west' ? probe.screen.start[0] - distance : target.x;
        const z = probe.side === 'north' ? probe.screen.start[1] - distance : target.z;
        const ground = terrainHeight(x, z);
        const observer = new THREE.Vector3(x, ground + eyeHeight, z);
        const direction = target.clone().sub(observer);
        const raycaster = new THREE.Raycaster(observer, direction.clone().normalize(), 0.005, direction.length() - 0.005);
        const hit = raycaster.intersectObjects(structure, false)[0];
        const blocked = Boolean(hit);
        const color = blocked ? 0x56ce80 : 0xffa94d;
        probe.material.color.setHex(color);
        probe.markerMaterial.color.setHex(color);
        probe.line.geometry.setFromPoints([observer, target]);
        probe.line.geometry.computeBoundingSphere();
        probe.markers[0].position.copy(observer);
        probe.markers[1].position.copy(target);
        for (const object of [probe.line, ...probe.markers]) object.visible = probe.checkbox.checked;
        probe.status.textContent = `${blocked ? 'Blocked by structure' : 'Open sightline'}${probe.checkbox.checked ? '' : ' · hidden'}`;
        probe.status.style.color = blocked ? '#7bdd9a' : '#ffb866';
        probe.status.dataset.blocked = String(blocked);
        return { id: probe.id, blocked, observer: observer.toArray(), target: target.toArray(), ground,
          eyeHeight, distance, enabled: probe.checkbox.checked, intersection: hit?.point.toArray() || null };
      });
      return results;
    }
    details.addEventListener('toggle', update);
    details.addEventListener('input', update);
    update();
    return { update, getResults: () => structuredClone(results), dispose() {
      details.remove();
      scene.remove(overlay);
      sphereGeometry.dispose();
      for (const probe of probes) {
        probe.line.geometry.dispose();
        probe.material.dispose();
        probe.markerMaterial.dispose();
      }
    } };
  }
  return { create };
})();
