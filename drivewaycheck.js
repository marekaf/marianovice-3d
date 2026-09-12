// Static body footprints and planar clearances do not establish swept-path feasibility.
// Regenerate with: node generate-driveway-check.js
const { GateModel } = require('./gate-model.js');
const ROWS = "abcdefghijklmnopqrstuvwxyz";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const inPoly = (pts, x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const distToEdge = (pts, x, y) => {
  let m = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
    m = Math.min(m, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return m;
};

const rectRing = (r) => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.d], [r.x, r.y + r.d]];
const insideRect = (r, x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.d;

// Sampled empty-space circle, not a vehicle turning envelope or a guaranteed global maximum.
function largestClearCircle(area, plot, blockers = []) {
  const xs = area.map((p) => p[0]), ys = area.map((p) => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const clearance = (x, y) => {
    if (!inPoly(area, x, y) || !inPoly(plot, x, y)) return -1;
    if (blockers.some((r) => insideRect(r, x, y))) return -1;
    return Math.min(distToEdge(area, x, y), distToEdge(plot, x, y),
                    ...blockers.map((r) => distToEdge(rectRing(r), x, y)));
  };
  let best = { r: -1, x: x0, y: y0 };
  for (let step = 0.25, pass = 0; pass < 7; pass++, step /= 3) {
    for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) {
      const r = clearance(x, y);
      if (r > best.r) best = { r, x, y };
    }
    x0 = best.x - step * 3; x1 = best.x + step * 3; y0 = best.y - step * 3; y1 = best.y + step * 3;
  }
  return best;
}

function drivewayStudy(garden) {
  const elements = Object.fromEntries(garden.elements.map(e => [e.id, e]));
  const line = elements.gate.parts.find(p => p.kind === 'line');
  const gate = GateModel.build({openingStart:[line.x1,line.y1],direction:[line.x2-line.x1,line.y2-line.y1],open:0,wicketOpen:0});
  const {wicketHinge, wicketOpening, direction} = gate.dims;
  const post = gate.parts.find(p => p.name === 'gate_post_1');
  const sharedFace = Math.max(...post.vertices.map(p => (p[0]-line.x1)*direction[0]+(p[1]-line.y1)*direction[1]));
  const wicketStart = [line.x1+direction[0]*sharedFace,line.y1+direction[1]*sharedFace];
  const wicketEnd = wicketStart.map((v,i)=>v+direction[i]*wicketOpening);
  const bays = Object.fromEntries(['carport','garage'].map(id => {
    const rect=elements[id].parts.find(p=>p.kind==='rect');
    const wall=id==='garage'?elements.garage.meta.wallT:0;
    const bench=id==='garage'?elements.garage.meta.workbench.d:0;
    const vehicles=garden.vehicles.filter(v=>v.bay===id).sort((a,b)=>a.cx-b.cx);
    const gaps=vehicles.slice(1).map((v,i)=>v.cx-v.w/2-(vehicles[i].cx+vehicles[i].w/2));
    const boundaryClearance=Math.min(...vehicles.flatMap(v=>[v.cx-v.w/2-rect.x-wall,rect.x+rect.w-wall-v.cx-v.w/2,v.noseZ-rect.y-wall-bench,rect.y+rect.d-wall-v.noseZ-v.l]));
    return [id,{rect,gaps,boundaryClearance}];
  }));
  return {gate,bays,wicketStart,wicketEnd,wicketHinge};
}

function renderDrivewayCheckSVG(garden) {
  const study = drivewayStudy(garden);
  const VEH = garden.vehicles;
  const EL = Object.fromEntries(garden.elements.map((e) => [e.id, e]));
  const S = garden.m2px;
  const px = (m) => Math.round(m * S * 100) / 100;
  const cell = garden.gridCellM * S, major = cell * 5;
  const maxX = Math.max(...garden.plot.vertices.map((v) => v[0]));
  const maxY = Math.max(...garden.plot.vertices.map((v) => v[1]));
  const cols = Math.floor((maxX - garden.gridCellM / 2) / garden.gridCellM) + 1;
  const rows = Math.floor((maxY - garden.gridCellM / 2) / garden.gridCellM) + 1;
  const plotPts = garden.plot.vertices.map(([x, y]) => `${px(x)},${px(y)}`).join(" ");
  const out = [];

  const cp = EL.carport.parts.find((p) => p.kind === "rect");
  const ga = EL.garage.parts.find((p) => p.kind === "rect");
  const gaDoor = EL.garage.parts.filter((p) => p.kind === "rect")[1]; // 5 m door on the S wall
  const dw = EL.driveway.parts.find((p) => p.kind === "polygon").points;
  const gt = EL.gate.parts.find((p) => p.kind === "line");

  const worst = VEH.filter((v) => !v.moto).reduce((a, v) => (v.turn > a.turn ? v : a));
  const circle = largestClearCircle(dw, garden.plot.vertices, [cp, ga]);
  const have = circle.r * 2;
  const emptied = largestClearCircle(dw, garden.plot.vertices, [ga]).r * 2;
  const turn = {
    need: worst.turn, have, circle,
    headline: 'Bez simulace vlečných křivek vozidel',
    lines: [
      `Brána ${study.gate.dims.opening.toFixed(1)} m; branka ${study.gate.dims.wicketOpening.toFixed(1)} m světlost.`,
      `Největší uvedený průměr otáčení ${worst.turn.toFixed(1)} m.`,
      `Volný kruh Ø ${have.toFixed(1)} m mimo obě stání;`,
      `Ø ${emptied.toFixed(1)} m při vyloučení samotné garáže.`,
      'Kruhy neprokazují průjezd ani možnost otočení.',
      'Před stavbou ověřit dráhy kol, převisy a řízení',
      'se skutečnými vozidly.',
    ],
  };

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 880" font-family="-apple-system, BlinkMacSystemFont, sans-serif">`);
  out.push(`  <defs>
    <pattern id="cg" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><path d="M ${cell} 0 L 0 0 0 ${cell}" fill="none" stroke="#e2e2e2" stroke-width="0.6"/></pattern>
    <pattern id="mg" width="${major}" height="${major}" patternUnits="userSpaceOnUse"><rect width="${major}" height="${major}" fill="url(#cg)"/><path d="M ${major} 0 L 0 0 0 ${major}" fill="none" stroke="#bcbcbc" stroke-width="1"/></pattern>
    <clipPath id="plot"><polygon points="${plotPts}"/></clipPath>
    <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#c0392b"/></marker>
  </defs>`);
  out.push(`  <style>
    text{font-family:-apple-system,sans-serif;fill:#2a2a2a}
    .title{font-size:18px;font-weight:700;text-anchor:middle}
    .sub{font-size:11px;fill:#666;text-anchor:middle}
    .axis{font-size:9px;fill:#777;text-anchor:middle;font-weight:600}
    .bay{font-size:10px;font-weight:700}
    .vlbl{font-size:8px;font-weight:700;fill:#fff}
    .dim{font-size:9px;fill:#c0392b;text-anchor:middle;font-weight:600}
    .ph{font-size:11px;font-weight:700}
    .pt{font-size:8.5px}
    .ok{font-size:10px;font-weight:700;fill:#1f7a3d}
    .bad{font-size:10px;font-weight:700;fill:#c0392b}
  </style>`);
  out.push(`  <rect width="1100" height="880" fill="white"/>`);
  out.push(`  <text x="430" y="26" class="title">Schéma parkování a volných průchodů</text>`);
  out.push(`  <text x="430" y="44" class="sub">Půdorysy podle modelu. Bez simulace vlečných křivek; neslouží k vytyčení stavby.</text>`);

  out.push(`  <g transform="translate(70, 96)">`);
  out.push(`    <g clip-path="url(#plot)"><rect x="-50" y="-10" width="900" height="720" fill="url(#mg)"/></g>`);
  out.push(`    <polygon points="${plotPts}" fill="none" stroke="#2a2a2a" stroke-width="2.5"/>`);
  const cl = [];
  for (let i = 1; i <= cols; i++) cl.push(`<text x="${(i - 0.5) * cell}" y="-6">${i}</text>`);
  out.push(`    <g class="axis">${cl.join("")}</g>`);
  const rl = [];
  for (let j = 0; j < rows; j++) rl.push(`<text x="-12" y="${j * cell + 22}">${ROWS[j]}</text>`);
  out.push(`    <g class="axis">${rl.join("")}</g>`);

  // Context faint
  out.push(`    <g clip-path="url(#plot)" fill="#f1f1f1" stroke="#d6d6d6" stroke-width="0.8">`);
  for (const id of ["house", "sauna", "saunaShelter", "pergola"]) {
    const e = EL[id]; if (!e) continue;
    for (const p of e.parts) {
      if (p.kind === "rect") out.push(`      <rect x="${px(p.x)}" y="${px(p.y)}" width="${px(p.w)}" height="${px(p.d)}"/>`);
      else if (p.kind === "polygon") out.push(`      <polygon points="${p.points.map(([x, y]) => `${px(x)},${px(y)}`).join(" ")}"/>`);
    }
  }
  out.push(`    </g>`);

  // Driveway + bays
  out.push(`    <polygon points="${dw.map(([x, y]) => `${px(x)},${px(y)}`).join(" ")}" fill="#e7edf2" stroke="#8aa0b4" stroke-width="1"/>`);
  const sewer=EL.sewerInspection?.parts.find(p=>p.kind==='circle');
  if(sewer)out.push(`<g data-feature="sewerInspection"><circle cx="${px(sewer.cx)}" cy="${px(sewer.cy)}" r="${px(sewer.r)}" fill="#444" stroke="#222"/><text x="${px(sewer.cx-.5)}" y="${px(sewer.cy)-8}" class="dim" text-anchor="end">kanalizační šachta DN400</text></g>`);
  out.push(`    <rect x="${px(cp.x)}" y="${px(cp.y)}" width="${px(cp.w)}" height="${px(cp.d)}" fill="#e7f3ea" stroke="#3f8f52" stroke-width="1.6"/>`);
  out.push(`    <rect x="${px(ga.x)}" y="${px(ga.y)}" width="${px(ga.w)}" height="${px(ga.d)}" fill="#efe9dd" stroke="#9a9074" stroke-width="1.6"/>`);
  // Garage door opening (5 m) marked on the S wall
  out.push(`    <line x1="${px(gaDoor.x)}" y1="${px(ga.y + ga.d)}" x2="${px(gaDoor.x + gaDoor.w)}" y2="${px(ga.y + ga.d)}" stroke="#3a2a18" stroke-width="3"/>`);
  out.push(`    <text x="${px(cp.x + cp.w / 2)}" y="${px(cp.y + cp.d) - 4}" class="bay" fill="#2f6f43" text-anchor="middle">PŘÍSTŘEŠEK</text>`);
  out.push(`    <text x="${px(ga.x + ga.w / 2)}" y="${px(ga.y + ga.d) - 4}" class="bay" fill="#7a6f52" text-anchor="middle">GARÁŽ</text>`);

  // Garage workbench across the north wall (full width) — cars park south of it
  const gaM = EL.garage.meta;
  out.push(`    <rect x="${px(ga.x + gaM.wallT + 0.1)}" y="${px(ga.y + gaM.wallT)}" width="${px(ga.w - 2 * gaM.wallT - 0.2)}" height="${px(gaM.workbench.d)}" fill="#8a6a44" stroke="#5a4530" stroke-width="1"/>`);
  out.push(`    <text x="${px(ga.x + ga.w / 2)}" y="${px(ga.y + gaM.wallT + 0.5)}" class="vlbl" text-anchor="middle" fill="#fff">pracovní stůl</text>`);
  // Carport walkways to the two pedestrian doors (keep clear of parked cars)
  out.push(`    <rect x="${px(cp.x)}" y="${px(cp.y)}" width="${px(0.8)}" height="${px(cp.d)}" fill="#fbe9c7" fill-opacity="0.7"/>`);
  out.push(`    <rect x="${px(cp.x + cp.w - 0.85)}" y="${px(cp.y)}" width="${px(0.85)}" height="${px(cp.d)}" fill="#fbe9c7" fill-opacity="0.7"/>`);
  const personnelDoor=gaM.openings.find(o=>o.wall==='W'&&o.kind==='door');
  out.push(`    <line x1="${px(ga.x)}" y1="${px(personnelDoor.from)}" x2="${px(ga.x)}" y2="${px(personnelDoor.from+personnelDoor.w)}" stroke="#1f7a3d" stroke-width="3"/>`);
  // Vehicles to scale, drawn with the two front doors open. `reversed` = parked nose-out (front
  // toward the south/door). fy = front edge in local y; rs = local direction toward the rear.
  for (const v of VEH) {
    const cz = v.noseZ + v.l / 2, w = px(v.w), l = px(v.l);
    const fy = v.reversed ? l / 2 : -l / 2, rs = v.reversed ? -1 : 1;
    out.push(`    <g transform="translate(${px(v.cx)},${px(cz)})">`);
    if (v.moto) {
      out.push(`      <rect x="${-w / 2}" y="${-l / 2}" width="${w}" height="${l}" rx="${w / 2}" fill="${v.col}" stroke="#1a1a1a" stroke-width="1"/>`);
      out.push(`      <line x1="${-px(0.45)}" y1="${-l / 2 + px(0.5)}" x2="${px(0.45)}" y2="${-l / 2 + px(0.5)}" stroke="#1a1a1a" stroke-width="1.4"/>`);
    } else {
      // Open front doors: hinged at the A-pillar, swung ~70° out. Leaf length is per-vehicle
      // (the coupe's door is noticeably longer). The door sits BEHIND the windscreen.
      const s = 0.94, c = 0.34, hy = fy + rs * px(v.hinge), dl = px(v.doorLen);
      for (const sx of [-1, 1]) {
        const hx = sx * w / 2;
        out.push(`      <line x1="${hx}" y1="${hy}" x2="${hx + sx * dl * s}" y2="${hy + rs * dl * c}" stroke="${v.col}" stroke-width="3.2" stroke-linecap="round"/>`);
      }
      out.push(`      <rect x="${-w / 2}" y="${-l / 2}" width="${w}" height="${l}" rx="4" fill="${v.col}" fill-opacity="0.9" stroke="#111" stroke-width="1.2"/>`);
      const wa = fy + rs * px(v.hinge - 0.55), wb = fy + rs * px(v.hinge - 0.05);
      out.push(`      <rect x="${-w / 2 + 2}" y="${Math.min(wa, wb)}" width="${w - 4}" height="${Math.abs(wb - wa)}" rx="2" fill="#2a3542"/>`); // windscreen, just ahead of the doors
      out.push(`      <line x1="${-w / 2 + 2}" y1="${fy}" x2="${w / 2 - 2}" y2="${fy}" stroke="#e6edf4" stroke-width="2.4" stroke-linecap="round"/>`); // front bumper (lighter = front)
    }
    out.push(`    </g>`);
    const lab = v.name.replace("Yamaha ", "").replace(" allroad", " allr.").replace(" Compact", " Comp.").replace("Škoda ", "").replace("BMW ", "");
    out.push(`    <text x="${px(v.cx)}" y="${px(cz)}" class="vlbl" text-anchor="middle" transform="rotate(90 ${px(v.cx)} ${px(cz)})">${esc(lab)}</text>`);
  }

  // Gate + access route + the turning space actually available (getting to the carport)
  out.push(`    <line x1="${px(gt.x1)}" y1="${px(gt.y1)}" x2="${px(gt.x2)}" y2="${px(gt.y2)}" stroke="#c0392b" stroke-width="3" stroke-dasharray="2,2"/>`);
  out.push(`    <text x="${px(gt.x1) + 8}" y="${px((gt.y1 + gt.y2) / 2)}" class="dim" text-anchor="start">brána ${study.gate.dims.opening.toFixed(1)} m</text>`);
  { const [a,b]=[study.wicketStart,study.wicketEnd];
    out.push(`    <line id="wicket-clear-opening" x1="${px(a[0])}" y1="${px(a[1])}" x2="${px(b[0])}" y2="${px(b[1])}" stroke="#1f7a3d" stroke-width="3" stroke-dasharray="2,2"/>`);
    out.push(`    <text x="${px(b[0]) + 8}" y="${px((a[1]+b[1])/2)}" class="dim" fill="#1f7a3d" text-anchor="start">branka ${study.gate.dims.wicketOpening.toFixed(1)} m</text>`); }
  out.push(`    <circle cx="${px(turn.circle.x)}" cy="${px(turn.circle.y)}" r="${px(turn.need / 2)}" fill="none" stroke="#c0392b" stroke-width="1" stroke-dasharray="5,4"/>`);
  out.push(`    <circle cx="${px(turn.circle.x)}" cy="${px(turn.circle.y)}" r="${px(turn.circle.r)}" fill="#1f7a3d" fill-opacity="0.07" stroke="#1f7a3d" stroke-width="1.4"/>`);
  out.push(`    <text x="${px(turn.circle.x)}" y="${px(turn.circle.y)}" class="dim" fill="#1f7a3d">volný Ø ${turn.have.toFixed(1)} m</text>`);
  out.push(`    <text x="${px(turn.circle.x)}" y="${px(turn.circle.y) + 11}" class="dim">referenční Ø ${turn.need.toFixed(1)} m</text>`);

  out.push(`  </g>`);

  // Compass
  out.push(`  <g transform="translate(840, 92)"><circle r="22" fill="white" stroke="#555" stroke-width="1.3"/><path d="M 0 -17 L 5 3 L 0 -5 L -5 3 Z" fill="#2a2a2a"/><path d="M 0 5 L 5 -3 L 0 17 L -5 -3 Z" fill="#999"/><text y="-26" font-size="12" font-weight="700" text-anchor="middle">S</text></g>`);

  // Fit table
  out.push(`  <g transform="translate(872, 150)">`);
  out.push(`    <text x="0" y="0" class="ph">ROZMĚRY VOZIDEL (jmenovité)</text>`);
  out.push(`    <text x="0" y="16" class="pt" font-weight="700" fill="#555">vozidlo</text><text x="142" y="16" class="pt" font-weight="700" fill="#555" text-anchor="end">D × Š m</text><text x="170" y="16" class="pt" font-weight="700" fill="#555" text-anchor="end">Ø</text>`);
  out.push(`    <line x1="0" y1="20" x2="170" y2="20" stroke="#bbb" stroke-width="0.8"/>`);
  let y = 33;
  const grp = Object.fromEntries(Object.entries(study.bays).map(([id,{rect}])=>[id,`${id==='carport'?'PŘÍSTŘEŠEK':'GARÁŽ'} ${rect.w.toFixed(2)} × ${rect.d.toFixed(2)} m půdorys`]));
  for (const bay of ["carport", "garage"]) {
    out.push(`    <text x="0" y="${y}" class="pt" font-weight="700" fill="#333">${esc(grp[bay])}</text>`);
    y += 13;
    for (const v of VEH.filter((v) => v.bay === bay)) {
      const sn = v.name.replace("Yamaha ", "").replace("Škoda ", "").replace("BMW ", "").replace("Audi ", "");
      out.push(`    <rect x="0" y="${y - 7}" width="8" height="8" fill="${v.col}"/>`);
      out.push(`    <text x="13" y="${y}" class="pt">${esc(sn)}</text><text x="142" y="${y}" class="pt" text-anchor="end">${v.l.toFixed(2)} × ${v.w.toFixed(2)}</text><text x="170" y="${y}" class="pt" text-anchor="end">${v.turn.toFixed(1)}</text>`);
      y += 12;
    }
    const {gaps,boundaryClearance}=study.bays[bay];
    out.push(`    <text x="0" y="${y}" class="pt">Mezery mezi karoseriemi: ${gaps.map(g=>g.toFixed(2)+' m').join(', ')||'neuvedeno'}</text>`);
    y += 12;
    out.push(`    <text x="0" y="${y}" class="pt">Min. odstup karoserie od okraje: ${boundaryClearance.toFixed(2)} m</text>`);
    y += 20;
  }
  out.push(`    <text x="0" y="${y}" class="pt" fill="#444" font-weight="700">Dveře a pěší průchody pod přístřeškem</text>`);
  y += 12;
  for (const line of [
    'Žluté pásy označují navržené pěší průchody.',
    'Otevřené dveře jsou ilustrační; bez kontroly kolizí.',
    'Mezery nezahrnují zrcátka, osoby a zavazadla.',
    'Garážové stání zohledňuje stěny a pracovní stůl.',
    'Sloupy přístřešku nejsou zahrnuty do odstupů.',
    'Přístupy ke dveřím a průchody ověřit na místě.',
  ]) { out.push(`    <text x="0" y="${y}" class="pt" fill="#555">${esc(line)}</text>`); y += 12; }
  y += 6;
  out.push(`    <text x="0" y="${y}" class="pt" fill="#444" font-weight="700">Příjezd od brány</text>`);
  y += 12;
  out.push(`    <text x="0" y="${y}" class="bad" font-size="8.5">${esc(turn.headline)}</text>`);
  y += 13;
  for (const line of turn.lines) { out.push(`    <text x="0" y="${y}" class="pt" fill="#555">${esc(line)}</text>`); y += 12; }
  y += 6;
  out.push(`    <text x="0" y="${y}" class="pt" fill="#888">Jmenovité rozměry vozidel nutno ověřit.</text>`);
  out.push(`    <text x="0" y="${y + 12}" class="pt" fill="#888">Sklony a průjezdné výšky nejsou posouzeny.</text>`);
  out.push(`  </g>`);

  out.push(`</svg>`);
  return out.join("\n");
}

module.exports = { renderDrivewayCheckSVG, drivewayStudy };
