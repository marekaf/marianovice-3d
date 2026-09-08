export function mountViewerUI({ stopTour }) {
  const style = document.createElement('style');
  style.textContent = `
    :root { --ui-paper:#f5f4ec; --ui-ink:#303e36; --ui-green:#526e58; }
    body > canvas { position:fixed; inset:0; width:100%!important; height:100%!important; display:block; }
    .viewer-ui { color:var(--ui-ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif; }
    .viewer-ui [hidden], #walkStatus[hidden], #restoreUI[hidden] { display:none!important; }
    #viewerUI[hidden] { display:none!important; }
    body.viewer-clean #walkStatus,body.viewer-clean #tourLabel,body.viewer-clean #tooltip { display:none!important; }
    .viewer-ui button, #restoreUI { font:inherit; cursor:pointer; border:1px solid #d9ded3; border-radius:8px; padding:10px 13px; min-height:44px; color:var(--ui-ink); background:var(--ui-paper); }
    .viewer-ui button:hover, .viewer-ui button[aria-expanded=true], .viewer-ui button[aria-pressed=true] { background:#dfe8da; }
    .viewer-ui :focus-visible, #restoreUI:focus-visible { outline:3px solid #6e916f; outline-offset:3px; }
    #viewerToolbar { position:fixed; top:16px; left:16px; right:16px; z-index:110; display:flex; align-items:center; gap:6px; width:fit-content; max-width:calc(100% - 32px); padding:6px; border:1px solid #ffffff70; border-radius:14px; background:var(--ui-paper); box-shadow:0 4px 24px #17271c25; }
    #viewerToolbar .brand { padding:0 14px; font-family:Georgia,serif; font-size:20px; white-space:nowrap; }
    #viewerToolbar button { border-color:transparent; white-space:nowrap; }
    #viewerToolbar #walkButton { background:var(--ui-green); color:white; }
    .viewer-panel { position:fixed; left:16px; top:86px; z-index:110; width:350px; max-width:calc(100vw - 64px); max-height:calc(100dvh - 126px); overflow:auto; overscroll-behavior:contain; padding:16px; border-radius:14px; background:var(--ui-paper); box-shadow:0 8px 32px #17271c30; }
    .panel-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
    .panel-heading h2 { font:400 24px Georgia,serif; margin:0; }
    .viewer-panel h3 { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#657362; margin:22px 0 8px; }
    .viewer-panel p { font-size:13px; }
    .viewer-panel a { color:#3e6449!important; }
    #presets,#toggles,#timeBar,#info { position:static; padding:0; margin:0; background:transparent; color:var(--ui-ink); max-height:none; max-width:none; font-size:14px; overflow:visible; }
    #presets button { display:block; width:100%; background:#e9ece2; color:var(--ui-ink); padding:10px 12px; margin:5px 0; font-size:14px; border-radius:8px; min-height:44px; }
    #presets button[aria-current=true] { background:var(--ui-green); color:white; }
    #toggles label { padding:8px 0; margin:0; display:flex; align-items:center; }
    .viewer-panel input[type=checkbox] { width:18px; height:18px; accent-color:var(--ui-green); }
    #timeBar input[type=range] { display:block; width:100%; margin:12px 0; accent-color:var(--ui-green); }
    #timeBar .seasons { display:grid; grid-template-columns:1fr 1fr; }
    #timeBar .seasons button { background:#e9ece2; color:var(--ui-ink); min-height:44px; font-size:12px; }
    #timeBar .seasons button.active { background:var(--ui-green); color:white; }
    .viewer-panel details { margin:12px 0; border-top:1px solid #d9ded3; padding-top:12px; }
    .viewer-panel summary { cursor:pointer; padding:8px 0; }
    .viewer-panel small,.viewer-panel p { color:#566252!important; }
    .viewer-panel select { max-width:100%!important; min-height:40px; }
    #restoreUI { position:fixed; top:16px; right:16px; z-index:120; font:14px system-ui; }
    #walkStatus { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:120; background:var(--ui-paper); padding:10px 16px; border-radius:12px; box-shadow:0 4px 24px #17271c25; display:flex; gap:16px; align-items:center; max-width:calc(100% - 64px); }
    @media(max-width:800px) {
      #viewerToolbar { top:auto; bottom:12px; left:12px; right:12px; max-width:none; width:auto; justify-content:space-around; gap:0; padding:4px; }
      #viewerToolbar .brand { display:none; }
      #viewerToolbar button { font-size:12px; padding:6px 5px; white-space:normal; flex:1; min-width:0; }
      #viewerToolbar #hideUI { display:none; }
      .viewer-panel { top:auto; bottom:78px; left:12px; right:12px; width:auto; max-width:none; max-height:calc(100dvh - 130px); border-radius:18px; }
      #walkStatus { bottom:80px; width:calc(100% - 64px); font-size:12px; }
    }
  `;
  document.head.append(style);
  const root = document.createElement('div');
  root.className = 'viewer-ui';
  root.id = 'viewerUI';
  root.innerHTML = `<nav id="viewerToolbar" aria-label="Viewer controls"><span class="brand">House & garden</span><button data-panel="views">Views</button><button data-panel="sun">Sun & seasons</button><button data-panel="layers">Layers</button><button data-panel="more">More</button><button id="walkButton">Walk around</button><button id="hideUI" aria-label="Hide interface" title="Hide interface">Hide UI</button></nav>`;
  document.body.append(root);
  const panels = new Map();
  let active = null;
  function closePanel(restoreFocus = true) {
    if (!active) return;
    const button = root.querySelector(`[data-panel="${active}"]`);
    const panel = panels.get(active);
    panel.hidden = true;
    const probes = panel.querySelector('#privacyProbes');
    if (probes) probes.open = false;
    button.setAttribute('aria-expanded', 'false');
    active = null;
    if (restoreFocus) button.focus();
  }
  for (const [id, title] of [['views','Choose a view'],['sun','Sun & seasons'],['layers','Scene layers'],['more','Tools & information']]) {
    const panel = document.createElement('section');
    panel.id = `panel-${id}`;
    panel.className = 'viewer-panel';
    panel.hidden = true;
    panel.setAttribute('aria-labelledby', `heading-${id}`);
    panel.innerHTML = `<div class="panel-heading"><h2 id="heading-${id}">${title}</h2><button aria-label="Close ${title}">Close</button></div>`;
    panel.querySelector('button').addEventListener('click', () => closePanel());
    panels.set(id, panel);
    root.append(panel);
    const button = root.querySelector(`[data-panel="${id}"]`);
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      const wasOpen = active === id;
      closePanel(false);
      if (wasOpen) return;
      panel.hidden = false;
      active = id;
      button.setAttribute('aria-expanded', 'true');
      panel.querySelector('button').focus();
    });
  }
  const presets = document.getElementById('presets');
  const viewButtons = [...presets.querySelectorAll('button')];
  const groups = [
    ['Overview',['iso','top','east','north','south','ground']],
    ['House',['garage','eastLounge','atriumLounge','cars','entranceGate']],
    ['Through the windows',['marekOfficeView','cristinaOfficeView','dressingRoomView']],
    ['Garden',['sauna','tubSeat','pergola','pergolaSeat','westPath','greenhouse','raisedBeds','firepit','hiddenBench']],
  ];
  presets.replaceChildren();
  for (const [title, names] of groups) {
    const heading = document.createElement('h3'); heading.textContent = title; presets.append(heading);
    for (const name of names) {
      const button = viewButtons.find(b => b.getAttribute('onclick') === `setPreset('${name}')`);
      button.dataset.view = name;
      button.addEventListener('click', () => {
        viewButtons.forEach(b => b.removeAttribute('aria-current'));
        button.setAttribute('aria-current', 'true');
        closePanel();
      });
      presets.append(button);
    }
  }
  panels.get('views').append(presets);
  panels.get('sun').append(document.getElementById('timeBar'));
  panels.get('layers').append(document.getElementById('toggles'));
  const advanced = document.createElement('details');
  advanced.innerHTML = '<summary>Advanced checks</summary>';
  advanced.append(document.getElementById('toggleAxes').closest('label'), document.getElementById('terrainPreview'), document.getElementById('privacyProbes'));
  advanced.append(document.querySelector('[data-advanced-links]'));
  panels.get('more').append(advanced, document.getElementById('info'));
  for (const link of document.querySelectorAll('#timeBar a')) advanced.append(link);
  document.getElementById('legend').remove();
  const tourButton = viewButtons.find(b => b.getAttribute('onclick') === 'startTour()');
  tourButton.removeAttribute('style');
  tourButton.textContent = 'Play guided garden tour';
  panels.get('views').append(tourButton);
  const fp = document.getElementById('toggleFP');
  fp.closest('label').hidden = true;
  const status = document.createElement('div');
  status.id = 'walkStatus'; status.className = 'viewer-ui'; status.hidden = true;
  status.innerHTML = '<span role="status">WASD to move · Mouse to look · Esc to exit</span><button>Exit walk</button>';
  document.body.append(status);
  const walkButton = document.getElementById('walkButton');
  const touchWalk = matchMedia('(pointer:coarse)').matches;
  let touring = false;
  const originalStartTour = window.startTour;
  window.startTour = () => { originalStartTour(); touring = true; closePanel(false); updateWalk(); };
  const originalSetPreset = window.setPreset;
  window.setPreset = name => {
    endTour();
    if (fp.checked) { fp.checked = false; fp.dispatchEvent(new Event('change')); }
    originalSetPreset(name);
    for (const button of presets.querySelectorAll('[data-view]')) {
      if (button.dataset.view === name) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  };
  const initialView = location.hash.slice(1) || 'iso';
  for (const button of presets.querySelectorAll('[data-view]')) if (button.dataset.view === initialView) button.setAttribute('aria-current', 'true');
  function endTour() { stopTour(); touring = false; updateWalk(); }
  function updateWalk() {
    status.hidden = !fp.checked && !touring;
    status.querySelector('span').textContent = touring ? 'Guided garden walk' : 'WASD to move · Mouse to look · Esc to exit';
    walkButton.textContent = fp.checked || touring ? 'Exit walk' : 'Walk around';
    walkButton.setAttribute('aria-pressed', String(fp.checked || touring));
  }
  function toggleWalk() {
    if (touring) { endTour(); return; }
    if (touchWalk) { window.startTour(); return; }
    endTour();
    closePanel(false);
    fp.checked = !fp.checked;
    fp.dispatchEvent(new Event('change'));
  }
  walkButton.addEventListener('click', toggleWalk);
  status.querySelector('button').addEventListener('click', toggleWalk);
  fp.addEventListener('change', updateWalk);
  document.addEventListener('viewer-tour-ended', () => { touring = false; updateWalk(); });
  updateWalk();
  const restore = document.createElement('button');
  restore.id = 'restoreUI'; restore.textContent = 'Show controls'; restore.hidden = true;
  document.body.append(restore);
  function showUI() { root.hidden = false; restore.hidden = true; document.body.classList.remove('viewer-clean'); root.querySelector('[data-panel="views"]').focus(); }
  function hideUI() { closePanel(false); root.hidden = true; restore.hidden = false; document.body.classList.add('viewer-clean'); restore.focus(); }
  document.getElementById('hideUI').addEventListener('click', hideUI);
  const cleanButton = document.createElement('button');
  cleanButton.textContent = 'Hide interface';
  cleanButton.addEventListener('click', hideUI);
  panels.get('more').append(cleanButton);
  restore.addEventListener('click', showUI);
  tourButton.addEventListener('click', () => { closePanel(); updateWalk(); });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closePanel();
    endTour();
    if (root.hidden) showUI();
  });
  document.querySelector('canvas').addEventListener('pointerdown', () => closePanel(false));
  document.addEventListener('pointerlockerror', () => {
    if (!fp.checked) return;
    fp.checked = false; fp.dispatchEvent(new Event('change'));
  });
  return { closePanel };
}
