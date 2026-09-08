export function mountInteriorUI() {
  const root = document.getElementById('views');
  const style = document.createElement('style');
  style.textContent = `
    :root { --paper:#f5f4ec; --ink:#303e36; --green:#526e58; }
    body > canvas { position:fixed; inset:0; width:100%!important; height:100%!important; display:block; }
    #views { position:static; width:auto; padding:0; background:none; overflow:visible; max-height:none; color:var(--ink); }
    #views button,#restoreInteriorUI { min-height:44px; border:1px solid #d9ded3; border-radius:8px; background:var(--paper); color:var(--ink); font:14px system-ui; padding:10px 12px; cursor:pointer; margin:0; }
    #views button:hover,#views button[aria-expanded=true] { background:#dfe8da; }
    #views button.active { background:var(--green); color:white; }
    #views :focus-visible,#restoreInteriorUI:focus-visible { outline:3px solid #6e916f; outline-offset:2px; }
    #interiorToolbar { position:fixed; top:16px; left:16px; z-index:110; display:flex; gap:4px; align-items:center; padding:6px; border-radius:14px; background:var(--paper); box-shadow:0 4px 24px #17271c25; }
    #interiorToolbar strong { font:20px Georgia,serif; padding:0 14px; }
    #interiorToolbar button { width:auto; border-color:transparent; }
    .interior-panel { position:fixed; left:16px; top:86px; z-index:110; box-sizing:border-box; width:370px; max-width:calc(100vw - 32px); max-height:calc(100dvh - 110px); overflow:auto; overscroll-behavior:contain; padding:16px; border-radius:14px; background:var(--paper); box-shadow:0 8px 32px #17271c30; }
    .interior-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
    .interior-heading h2 { font:24px Georgia,serif; margin:0; }
    #views .interior-heading button { width:auto; }
    #views h4 { color:#657362; font-size:12px; letter-spacing:.07em; margin:20px 0 8px; }
    #views .view-group { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
    #views label { color:var(--ink); font-size:14px; padding:9px 0; margin:0; }
    #views input[type=checkbox] { width:18px; height:18px; accent-color:var(--green); vertical-align:middle; }
    #views select { max-width:100%; min-height:44px; font:13px system-ui; }
    #views details { margin-top:12px; }
    #views summary { cursor:pointer; padding:10px 0; }
    #views p,#views small { font-size:13px; line-height:1.5; color:#566252; }
    #info { position:static; background:none; color:var(--ink); max-width:none; padding:0; }
    #info a { color:#3e6449; }
    #info h3 { display:none; }
    #viewlabel { top:auto; bottom:20px; max-width:calc(100vw - 180px); box-sizing:border-box; background:var(--paper); color:var(--ink); font-size:12px; text-align:center; pointer-events:none; }
    #restoreInteriorUI { position:fixed; top:16px; right:16px; z-index:120; }
    body.interior-clean #views,body.interior-clean #viewlabel,body.interior-clean #scalebar { display:none!important; }
    @media(max-width:700px) {
      #interiorToolbar { top:auto; bottom:12px; left:12px; right:12px; padding:4px; gap:0; }
      #interiorToolbar strong { display:none; }
      #interiorToolbar button { flex:1; min-width:0; padding:8px 3px; font-size:12px; white-space:normal; }
      .interior-panel { top:auto; bottom:78px; left:12px; width:calc(100vw - 24px); max-width:none; max-height:calc(100dvh - 100px); }
      #viewlabel { top:12px; bottom:auto; max-width:calc(100vw - 24px); }
      #scalebar { bottom:78px; }
    }
  `;
  document.head.append(style);
  const original = [...root.children];
  const toolbar = document.createElement('nav');
  toolbar.id = 'interiorToolbar';
  toolbar.setAttribute('aria-label', 'Interior controls');
  toolbar.innerHTML = '<strong>Interiors</strong>';
  root.append(toolbar);
  const panels = new Map();
  let active = null;
  function close(focus = true) {
    if (!active) return;
    const { panel, button } = panels.get(active);
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    active = null;
    if (focus) button.focus();
  }
  for (const [id, label, title] of [['rooms','Rooms','Rooms & views'],['layers','Layers','Walls & furnishings'],['walk','Walk','Eye-level walkthrough'],['more','More','Tools & information']]) {
    const button = document.createElement('button');
    button.textContent = label; button.dataset.panel = id;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', `interior-${id}`);
    toolbar.append(button);
    const panel = document.createElement('section');
    panel.id = `interior-${id}`; panel.className = 'interior-panel'; panel.hidden = true;
    panel.setAttribute('aria-labelledby', `interior-heading-${id}`);
    panel.innerHTML = `<div class="interior-heading"><h2 id="interior-heading-${id}">${title}</h2><button aria-label="Close ${title}">Close</button></div>`;
    panel.querySelector('button').onclick = () => close();
    button.onclick = () => {
      const wasOpen = active === id; close(false);
      if (wasOpen) return;
      active = id; panel.hidden = false; button.setAttribute('aria-expanded','true'); panel.querySelector('button').focus();
    };
    root.append(panel); panels.set(id, { panel, button });
  }
  const rooms = panels.get('rooms').panel;
  rooms.append(root.querySelector('.bswitch'));
  const groups = [
    ['Drawings & overview',['cut3d','plan','north','south','east','west']],
    ['Living & kitchen',['living','overview','cathedral','kitchen','garden','dining']],
    ['Bedrooms',['bedroom','windowSeat','guest']],
    ['Bathrooms',['bathroom','mainShower','guestShower','mirror']],
    ['Entrance',['entrance','entranceSeat','entranceCoats','entranceControls']],
    ['Utility & stairs',['utilityLaundry','utilityRack','utility','stairs']],
    ['Loft',['room','sim','trainer','landing','attic']],
  ];
  const sections = [];
  for (const [title, names] of groups) {
    const section = document.createElement('div');
    const heading = document.createElement('h4'); heading.textContent = title;
    const grid = document.createElement('div'); grid.className = 'view-group';
    for (const name of names) {
      const button = root.querySelector(`[data-view="${name}"]`);
      button.addEventListener('click', () => close()); grid.append(button);
    }
    section.append(heading, grid); rooms.append(section); sections.push(section);
  }
  for (const child of original) {
    if (child.tagName === 'H4') child.remove();
    else if (child.tagName === 'LABEL') panels.get('layers').panel.append(child);
  }
  const walk = document.getElementById('walkthrough');
  if (walk) { walk.open = true; panels.get('walk').panel.append(walk); }
  else panels.get('walk').button.hidden = true;
  const electrical = document.getElementById('electrical') || document.getElementById('electricalError');
  if (electrical) panels.get('more').panel.append(electrical);
  panels.get('more').panel.append(document.getElementById('exportBtn'), document.getElementById('info'));
  const hide = document.createElement('button'); hide.textContent = 'Hide UI'; hide.id = 'hideInteriorUI';
  toolbar.append(hide);
  const restore = document.createElement('button'); restore.id = 'restoreInteriorUI'; restore.textContent = 'Show controls'; restore.hidden = true;
  document.body.append(restore);
  function clean(value) { close(false); document.body.classList.toggle('interior-clean', value); restore.hidden = !value; (value ? restore : hide).focus(); }
  hide.onclick = () => clean(true); restore.onclick = () => clean(false);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (restore.hidden) close(); else clean(false); } });
  document.querySelector('body > canvas').addEventListener('pointerdown', () => close(false));
  document.getElementById('walkStart')?.addEventListener('click', () => close(false));
  document.getElementById('electricalFocus')?.addEventListener('click', () => close());
  const stop = document.getElementById('walkStop');
  const exitWalk = document.createElement('button');
  exitWalk.textContent = 'Stop walking'; exitWalk.id = 'exitInteriorWalk'; exitWalk.hidden = true;
  toolbar.append(exitWalk);
  exitWalk.onclick = () => stop.click();
  function sync() {
    if (walk) {
      if (panels.get('walk').button.hidden !== walk.hidden) panels.get('walk').button.hidden = walk.hidden;
      if (walk.hidden && active === 'walk') close(false);
      if (exitWalk.hidden !== stop.hidden) exitWalk.hidden = stop.hidden;
    }
    for (const section of sections) {
      const hidden = ![...section.querySelectorAll('[data-view]')].some(button => !button.hidden);
      if (section.hidden !== hidden) section.hidden = hidden;
    }
    for (const button of root.querySelectorAll('[data-view],[data-building]')) button.setAttribute('aria-pressed', String(button.classList.contains('active')));
  }
  new MutationObserver(sync).observe(root, { subtree:true, attributes:true, attributeFilter:['hidden','class'] });
  sync();
}
