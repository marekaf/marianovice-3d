// Renders zahrada-driveway-check.svg — a top-down driveway maneuvering check: can a passenger car
// get from the gate to under the carport and park / reverse / turn around comfortably?
// Regenerate with: node generate-driveway-check.js
const ROWS = "abcdefghijklmnopqrstuvwxyz";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Vehicle envelope (typical mid-size passenger car — Škoda Octavia class)
const CAR = { len: 4.69, wid: 1.83, turnDia: 11.2 };  // curb-to-curb turning circle ≈ 11.2 m

function renderDrivewayCheckSVG(garden) {
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
  const dw = EL.driveway.parts.find((p) => p.kind === "polygon").points;
  const gt = EL.gate.parts.find((p) => p.kind === "line");

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
    .lbl{font-size:10px;font-weight:700;text-anchor:middle}
    .dim{font-size:9px;fill:#1f6f43;text-anchor:middle;font-weight:600}
    .ph{font-size:11px;font-weight:700}
    .pt{font-size:9px}
    .ok{font-size:10px;font-weight:700;fill:#1f7a3d}
  </style>`);
  out.push(`  <rect width="1100" height="880" fill="white"/>`);
  out.push(`  <text x="440" y="26" class="title">Driveway maneuvering check — gate → carport</text>`);
  out.push(`  <text x="440" y="44" class="sub">Passenger car ${CAR.len} × ${CAR.wid} m, turning circle Ø ${CAR.turnDia} m · park / reverse / turn-around</text>`);

  out.push(`  <g transform="translate(70, 96)">`);
  out.push(`    <g clip-path="url(#plot)"><rect x="-50" y="-10" width="900" height="720" fill="url(#mg)"/></g>`);
  out.push(`    <polygon points="${plotPts}" fill="none" stroke="#2a2a2a" stroke-width="2.5"/>`);
  const cl = [];
  for (let i = 1; i <= cols; i++) cl.push(`<text x="${(i - 0.5) * cell}" y="-6">${i}</text>`);
  out.push(`    <g class="axis">${cl.join("")}</g>`);
  const rl = [];
  for (let j = 0; j < rows; j++) rl.push(`<text x="-12" y="${j * cell + 22}">${ROWS[j]}</text>`);
  out.push(`    <g class="axis">${rl.join("")}</g>`);

  // Context: house + fence-relevant elements faint
  out.push(`    <g clip-path="url(#plot)" fill="#f1f1f1" stroke="#d6d6d6" stroke-width="0.8">`);
  for (const id of ["house", "garage", "sauna", "saunaShelter", "pergola"]) {
    const e = EL[id]; if (!e) continue;
    for (const p of e.parts) {
      if (p.kind === "rect") out.push(`      <rect x="${px(p.x)}" y="${px(p.y)}" width="${px(p.w)}" height="${px(p.d)}"/>`);
      else if (p.kind === "polygon") out.push(`      <polygon points="${p.points.map(([x, y]) => `${px(x)},${px(y)}`).join(" ")}"/>`);
    }
  }
  out.push(`    </g>`);

  // Driveway surface
  out.push(`    <polygon points="${dw.map(([x, y]) => `${px(x)},${px(y)}`).join(" ")}" fill="#dfe7ee" stroke="#8aa0b4" stroke-width="1.2"/>`);
  // Garage slab + carport bay
  out.push(`    <rect x="${px(ga.x)}" y="${px(ga.y)}" width="${px(ga.w)}" height="${px(ga.d)}" fill="#e6e0d4" stroke="#9a9074" stroke-width="1"/>`);
  out.push(`    <rect x="${px(cp.x)}" y="${px(cp.y)}" width="${px(cp.w)}" height="${px(cp.d)}" fill="#cfe8d6" stroke="#4a9a5c" stroke-width="1.6"/>`);
  out.push(`    <text x="${px(cp.x + cp.w / 2)}" y="${px(cp.y + cp.d / 2)}" class="lbl" fill="#2f6f43">CARPORT</text>`);
  out.push(`    <text x="${px(cp.x + cp.w / 2)}" y="${px(cp.y + cp.d / 2) + 13}" class="dim">6.35 × 7.05 m (45 m²)</text>`);
  out.push(`    <text x="${px(ga.x + ga.w / 2)}" y="${px(ga.y + ga.d / 2)}" class="lbl" fill="#777">GARAGE</text>`);

  // Gate opening (car leaf) marker
  out.push(`    <line x1="${px(gt.x1)}" y1="${px(gt.y1)}" x2="${px(gt.x2)}" y2="${px(gt.y2)}" stroke="#c0392b" stroke-width="3" stroke-dasharray="2,2"/>`);
  out.push(`    <text x="${px(gt.x1) + 10}" y="${px((gt.y1 + gt.y2) / 2)}" class="dim" text-anchor="start">gate 3.5 m</text>`);

  // Parked car under the carport (nose north), plus the turning-circle envelope
  const carRect = (cx, cz, ang, fill) => {
    const w = px(CAR.wid), l = px(CAR.len);
    return `<g transform="translate(${px(cx)},${px(cz)}) rotate(${ang})"><rect x="${-w / 2}" y="${-l / 2}" width="${w}" height="${l}" rx="4" fill="${fill}" fill-opacity="0.85" stroke="#1a1a1a" stroke-width="1.2"/><rect x="${-w / 2}" y="${-l / 2}" width="${w}" height="${px(1.1)}" rx="3" fill="#2a3542"/></g>`;
  };
  // Turning circle centred in the apron/driveway in front of the bays
  const tcx = 29.5, tcz = 28.2, R = CAR.turnDia / 2;
  out.push(`    <circle cx="${px(tcx)}" cy="${px(tcz)}" r="${px(R)}" fill="#c0392b" fill-opacity="0.06" stroke="#c0392b" stroke-width="1" stroke-dasharray="5,4"/>`);
  out.push(`    <text x="${px(tcx)}" y="${px(tcz)}" class="dim" fill="#c0392b">turning Ø ${CAR.turnDia} m</text>`);
  // Suggested swept path gate → carport (approach curve + park)
  out.push(`    <path d="M ${px(gt.x1 - 0.3)},${px(30)} Q ${px(34)},${px(29)} ${px(29)},${px(27.6)} T ${px(24.46)},${px(23.2)}" fill="none" stroke="#c0392b" stroke-width="2" stroke-dasharray="3,3" marker-end="url(#arrow)"/>`);
  out.push(`    ${carRect(24.46, 22.6, 0, "#3a6ea5")}`);          // parked under carport
  out.push(`    ${carRect(41.5, 30.0, 100, "#9aa7b3")}`);        // arriving at the gate

  // Key clear-run dimension (N–S through carport + apron)
  out.push(`    <line x1="${px(19.6)}" y1="${px(19.4)}" x2="${px(19.6)}" y2="${px(30.1)}" stroke="#1f6f43" stroke-width="0.8" marker-end="url(#arrow)"/>`);
  out.push(`    <text x="${px(18.4)}" y="${px(24.8)}" class="dim" transform="rotate(-90 ${px(18.4)} ${px(24.8)})">clear run 10.7 m</text>`);

  out.push(`  </g>`);

  // Compass
  out.push(`  <g transform="translate(840, 92)"><circle r="22" fill="white" stroke="#555" stroke-width="1.3"/><path d="M 0 -17 L 5 3 L 0 -5 L -5 3 Z" fill="#2a2a2a"/><path d="M 0 5 L 5 -3 L 0 17 L -5 -3 Z" fill="#999"/><text y="-26" font-size="12" font-weight="700" text-anchor="middle">N</text></g>`);

  // Verdict panel
  const P = 872, notes = [
    ["Gate (car leaf)", "3.5 m ≥ 2.75 m needed. OK."],
    ["Driveway width", "~4.5 m — ample for a straight run."],
    ["Carport bay", "6.35 × 7.05 m double; nose-in +2.4 m."],
    ["Apron in front", "3.3–4.0 m → 10.7 m clear N–S run."],
    ["90° swing in", "4.5 m lane → 6.35 m bay: fine for a car"],
    ["", "(a long van: one correction)."],
    ["Turn-around", "L of drive + 45 m² bay meets Ø 11.2 m:"],
    ["", "in forward, back-and-fill, out forward."],
    ["Reverse out", "straight back to lane, fwd to gate."],
  ];
  out.push(`  <g transform="translate(${P}, 150)">`);
  out.push(`    <text x="0" y="0" class="ph">ASSESSMENT</text>`);
  out.push(`    <text x="0" y="20" class="ok">✓ Comfortable for a passenger car</text>`);
  let y = 40;
  for (const [k, v] of notes) {
    if (k) out.push(`    <text x="0" y="${y}" class="pt" font-weight="700">${esc(k)}</text>`);
    out.push(`    <text x="0" y="${y + (k ? 11 : 0)}" class="pt" fill="#444">${esc(v)}</text>`);
    y += k ? 27 : 12;
  }
  out.push(`    <text x="0" y="${y + 6}" class="pt" fill="#888">Envelope: Škoda Octavia class. A larger</text>`);
  out.push(`    <text x="0" y="${y + 18}" class="pt" fill="#888">SUV/van (Ø ~12 m) fits with less slack.</text>`);
  out.push(`  </g>`);

  out.push(`</svg>`);
  return out.join("\n");
}

module.exports = { renderDrivewayCheckSVG };
