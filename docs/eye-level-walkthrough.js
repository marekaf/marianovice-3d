export const WALK_STARTS = {
  living: { label: 'Living room', position: [6, 10.3], target: [8, 11.8] },
  kitchen: { label: 'Kitchen', position: [6.5, 6.9], target: [9.2, 5.5] },
  entrance: { label: 'Entrance', position: [5.2, 14.1], target: [8.6, 14.6] },
  southOffice: { label: 'Office 1.05', position: [3.5, 14.1], target: [1.5, 12.8] },
  northOffice: { label: 'Office 1.08', position: [3, 6.2], target: [1.5, 7.8] },
};

export function canWalkAt(data, x, z, radius = .18) {
  const inside = (px, pz) => {
    let result = false;
    for (let i = 0, j = data.outline.length - 1; i < data.outline.length; j = i++) {
      const [ax, az] = data.outline[i], [bx, bz] = data.outline[j];
      if ((az > pz) !== (bz > pz) && px < (bx - ax) * (pz - az) / (bz - az) + ax) result = !result;
    }
    return result;
  };
  if (![[x-radius,z],[x+radius,z],[x,z-radius],[x,z+radius]].every(([px,pz]) => inside(px,pz))) return false;
  for (const wall of [...data.extWalls, ...data.intWalls]) {
    const [x0,z0] = wall.a, [x1,z1] = wall.b;
    if (x + radius <= x0 || x - radius >= x1 || z + radius <= z0 || z - radius >= z1) continue;
    const alongX = x1-x0 > z1-z0, along = alongX ? x : z, start = alongX ? x0 : z0;
    if (!(wall.openings || []).some(o => !o.sill && o.h >= 1.9 && along-radius >= start+o.at && along+radius <= start+o.at+o.w)) return false;
  }
  return true;
}

export function attachEyeLevelWalkthrough(THREE, { data, floorY, camera, controls, canvas, container, activate }) {
  const panel = document.createElement('details');
  panel.id = 'walkthrough';
  panel.innerHTML = `<summary>Eye-level walkthrough</summary>
    <label>Start in <select id="walkRoom"></select></label>
    <label>Viewer <select id="walkViewer"><option value="1.68">180 cm stature · approx. 168 cm eyes</option><option value="1.46">158 cm stature · approx. 146 cm eyes</option></select></label>
    <label>Eye height <input id="walkHeight" type="number" min="110" max="190" step="1" value="168" style="width:55px"> cm</label>
    <button id="walkStart" type="button">Start walking</button>
    <button id="walkStop" type="button" hidden>Return to orbit · Esc</button>
    <small>WASD or arrow keys move. Drag the view to look. Ground floor only. Walls block movement; furniture and door leaves do not. Eye heights are adjustable estimates.</small>`;
  container.append(panel);
  for (const [value, preset] of Object.entries(WALK_STARTS)) panel.querySelector('#walkRoom').add(new Option(preset.label, value));
  const startButton = panel.querySelector('#walkStart'), stopButton = panel.querySelector('#walkStop');
  const heightInput = panel.querySelector('#walkHeight');
  const keys = new Set(), direction = new THREE.Vector3(), euler = new THREE.Euler(0,0,0,'YXZ');
  let active = false, pointer = null, lastTime = null;
  function look() { camera.quaternion.setFromEuler(euler); camera.getWorldDirection(direction); controls.target.copy(camera.position).add(direction); }
  function stop() {
    if (!active) return;
    active = false; keys.clear(); pointer = null; controls.enabled = true;
    startButton.hidden = false; stopButton.hidden = true; canvas.style.cursor = '';
  }
  function start() {
    setHeight();
    const preset = WALK_STARTS[panel.querySelector('#walkRoom').value];
    activate(preset, Number(heightInput.value)/100);
    active = true; controls.enabled = false; euler.setFromQuaternion(camera.quaternion,'YXZ');
    lastTime = null; startButton.hidden = true; stopButton.hidden = false; canvas.style.cursor = 'grab';
    canvas.tabIndex = 0; canvas.focus();
  }
  function setHeight() {
    const height = Math.min(190,Math.max(110,Number(heightInput.value)||168));
    heightInput.value = height;
    if (active) { camera.position.y = floorY + height/100; look(); }
  }
  startButton.addEventListener('click',start); stopButton.addEventListener('click',stop);
  heightInput.addEventListener('change',setHeight);
  panel.querySelector('#walkViewer').addEventListener('change',e => { heightInput.value = Math.round(Number(e.target.value)*100); setHeight(); });
  window.addEventListener('keydown',e => {
    if (!active) return;
    if (e.code === 'Escape') { stop(); return; }
    if (e.target.closest?.('input,select,button')) return;
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) { keys.add(e.code); e.preventDefault(); }
  });
  window.addEventListener('keyup',e => keys.delete(e.code));
  window.addEventListener('blur',() => { keys.clear(); pointer = null; });
  document.addEventListener('visibilitychange',() => keys.clear());
  canvas.addEventListener('pointerdown',e => { if (active && e.button===0) { pointer = { id:e.pointerId,x:e.clientX,y:e.clientY }; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove',e => {
    if (!active || !pointer || pointer.id!==e.pointerId) return;
    euler.y -= (e.clientX-pointer.x)*.003;
    euler.x = Math.max(-Math.PI*.45,Math.min(Math.PI*.45,euler.x-(e.clientY-pointer.y)*.003));
    pointer.x=e.clientX; pointer.y=e.clientY; look();
  });
  for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,() => { pointer=null; });
  return {
    get active() { return active; }, start, stop,
    setVisible(visible) { panel.hidden=!visible; },
    update(time) {
      const delta = lastTime===null ? 0 : Math.min((time-lastTime)/1000,.05); lastTime=time;
      if (!active) return;
      const forward = Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
      const sideways = Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
      const scale = delta*1.1/(Math.hypot(forward,sideways)||1);
      const dx = (-Math.sin(euler.y)*forward+Math.cos(euler.y)*sideways)*scale;
      const dz = (-Math.cos(euler.y)*forward-Math.sin(euler.y)*sideways)*scale;
      const origin = data.originPlot;
      if (canWalkAt(data,camera.position.x+dx-origin.x,camera.position.z-origin.z)) camera.position.x+=dx;
      if (canWalkAt(data,camera.position.x-origin.x,camera.position.z+dz-origin.z)) camera.position.z+=dz;
      look();
    },
  };
}
