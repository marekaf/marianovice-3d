// Renders zahrada-driveway-check.svg — a top-down parking & maneuvering check: do the specific
// vehicles fit their assigned bays, and can a car get from the gate to the carport comfortably?
// Regenerate with: node generate-driveway-check.js
const ROWS = "abcdefghijklmnopqrstuvwxyz";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function renderDrivewayCheckSVG(garden) {
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
  const pk = EL.parking.parts.find((p) => p.kind === "rect");
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
    .bay{font-size:10px;font-weight:700}
    .vlbl{font-size:8px;font-weight:700;fill:#fff}
    .dim{font-size:9px;fill:#c0392b;text-anchor:middle;font-weight:600}
    .ph{font-size:11px;font-weight:700}
    .pt{font-size:8.5px}
    .ok{font-size:10px;font-weight:700;fill:#1f7a3d}
  </style>`);
  out.push(`  <rect width="1100" height="880" fill="white"/>`);
  out.push(`  <text x="430" y="26" class="title">Parking &amp; maneuvering — vehicle fit</text>`);
  out.push(`  <text x="430" y="44" class="sub">M4 + Ténéré in the garage · Scala + A6 allroad under the carport · E46 next to the garage</text>`);

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
  out.push(`    <rect x="${px(cp.x)}" y="${px(cp.y)}" width="${px(cp.w)}" height="${px(cp.d)}" fill="#e7f3ea" stroke="#3f8f52" stroke-width="1.6"/>`);
  out.push(`    <rect x="${px(ga.x)}" y="${px(ga.y)}" width="${px(ga.w)}" height="${px(ga.d)}" fill="#efe9dd" stroke="#9a9074" stroke-width="1.6"/>`);
  out.push(`    <rect x="${px(pk.x)}" y="${px(pk.y)}" width="${px(pk.w)}" height="${px(pk.d)}" fill="#eef2f6" stroke="#6b8199" stroke-width="1.4" stroke-dasharray="4,3"/>`);
  // Garage door opening (5 m) marked on the S wall
  out.push(`    <line x1="${px(gaDoor.x)}" y1="${px(ga.y + ga.d)}" x2="${px(gaDoor.x + gaDoor.w)}" y2="${px(ga.y + ga.d)}" stroke="#3a2a18" stroke-width="3"/>`);
  out.push(`    <text x="${px(cp.x + cp.w / 2)}" y="${px(cp.y + cp.d) - 4}" class="bay" fill="#2f6f43" text-anchor="middle">CARPORT</text>`);
  out.push(`    <text x="${px(ga.x + ga.w / 2)}" y="${px(ga.y + ga.d) - 4}" class="bay" fill="#7a6f52" text-anchor="middle">GARAGE</text>`);
  out.push(`    <text x="${px(pk.x + pk.w / 2)}" y="${px(pk.y + pk.d) - 4}" class="bay" fill="#556" text-anchor="middle" transform="rotate(90 ${px(pk.x + pk.w / 2)} ${px(pk.y + pk.d) - 4})">PARKING</text>`);

  // Garage workbench across the north wall (full width) — cars park south of it
  const gaM = EL.garage.meta;
  out.push(`    <rect x="${px(ga.x + gaM.wallT + 0.1)}" y="${px(ga.y + gaM.wallT)}" width="${px(ga.w - 2 * gaM.wallT - 0.2)}" height="${px(gaM.workbench.d)}" fill="#8a6a44" stroke="#5a4530" stroke-width="1"/>`);
  out.push(`    <text x="${px(ga.x + ga.w / 2)}" y="${px(ga.y + gaM.wallT + 0.5)}" class="vlbl" text-anchor="middle" fill="#fff">workbench</text>`);
  // Carport walkways to the two pedestrian doors (keep clear of parked cars)
  out.push(`    <rect x="${px(cp.x)}" y="${px(cp.y)}" width="${px(0.8)}" height="${px(cp.d)}" fill="#fbe9c7" fill-opacity="0.7"/>`);
  out.push(`    <rect x="${px(cp.x + cp.w - 0.85)}" y="${px(cp.y)}" width="${px(0.85)}" height="${px(cp.d)}" fill="#fbe9c7" fill-opacity="0.7"/>`);
  // Pedestrian doors + swing arcs (house entry on the W wall, garage personnel door on the garage W wall)
  out.push(`    <line x1="${px(cp.x)}" y1="${px(23.49)}" x2="${px(cp.x)}" y2="${px(24.91)}" stroke="#1f7a3d" stroke-width="3"/>`);
  // On the solid S-part wall (z > 22.53), opens INWARD (hinge on the S side) — no carport space used
  out.push(`    <path d="M ${px(cp.x)},${px(23.49)} A ${px(1.42)} ${px(1.42)} 0 0 0 ${px(cp.x - 1.42)},${px(24.91)}" fill="none" stroke="#1f7a3d" stroke-width="0.8" stroke-dasharray="3,2"/>`);
  out.push(`    <text x="${px(cp.x) + 3}" y="${px(25.8)}" class="dim" fill="#1f7a3d" text-anchor="start">house door 1.4 m (opens in)</text>`);
  out.push(`    <line x1="${px(ga.x)}" y1="${px(20.2)}" x2="${px(ga.x)}" y2="${px(21.1)}" stroke="#1f7a3d" stroke-width="3"/>`);
  out.push(`    <circle cx="${px(ga.x)}" cy="${px(20.65)}" r="2.5" fill="#1f7a3d"/>`); // garage personnel door (labelled in the panel)
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

  // Gate + access swept path + turning circle (getting to the carport)
  out.push(`    <line x1="${px(gt.x1)}" y1="${px(gt.y1)}" x2="${px(gt.x2)}" y2="${px(gt.y2)}" stroke="#c0392b" stroke-width="3" stroke-dasharray="2,2"/>`);
  out.push(`    <text x="${px(gt.x1) + 8}" y="${px((gt.y1 + gt.y2) / 2)}" class="dim" text-anchor="start">gate 4.0 m</text>`);
  out.push(`    <circle cx="${px(29.5)}" cy="${px(28.4)}" r="${px(5.6)}" fill="#c0392b" fill-opacity="0.05" stroke="#c0392b" stroke-width="1" stroke-dasharray="5,4"/>`);
  out.push(`    <text x="${px(29.5)}" y="${px(28.4)}" class="dim">turning Ø 11.2 m</text>`);
  out.push(`    <path d="M ${px(gt.x1 - 0.3)},${px(30)} Q ${px(34)},${px(29)} ${px(28)},${px(27.8)} T ${px(24.4)},${px(24)}" fill="none" stroke="#c0392b" stroke-width="1.6" stroke-dasharray="3,3" marker-end="url(#arrow)"/>`);

  out.push(`  </g>`);

  // Compass
  out.push(`  <g transform="translate(840, 92)"><circle r="22" fill="white" stroke="#555" stroke-width="1.3"/><path d="M 0 -17 L 5 3 L 0 -5 L -5 3 Z" fill="#2a2a2a"/><path d="M 0 5 L 5 -3 L 0 17 L -5 -3 Z" fill="#999"/><text y="-26" font-size="12" font-weight="700" text-anchor="middle">N</text></g>`);

  // Fit table
  out.push(`  <g transform="translate(872, 150)">`);
  out.push(`    <text x="0" y="0" class="ph">VEHICLE FIT (nominal specs)</text>`);
  out.push(`    <text x="0" y="16" class="pt" font-weight="700" fill="#555">vehicle</text><text x="142" y="16" class="pt" font-weight="700" fill="#555" text-anchor="end">L × W m</text><text x="170" y="16" class="pt" font-weight="700" fill="#555" text-anchor="end">Ø</text>`);
  out.push(`    <line x1="0" y1="20" x2="170" y2="20" stroke="#bbb" stroke-width="0.8"/>`);
  let y = 33;
  const grp = { carport: "CARPORT 6.35 × 7.05 — two side-by-side", garage: "GARAGE 7.18 × 7.05 (door 5.0 m)", parking: "PARKING 3.2 × 7.05 — single bay" };
  const verdict = { carport: "✓ both fit; ~0.65 m gaps (fold mirrors)", garage: "✓ car + bike, 2 m gap; room to spare", parking: "✓ 0.72 m each side, 2.8 m spare" };
  for (const bay of ["carport", "garage", "parking"]) {
    out.push(`    <text x="0" y="${y}" class="pt" font-weight="700" fill="#333">${esc(grp[bay])}</text>`);
    y += 13;
    for (const v of VEH.filter((v) => v.bay === bay)) {
      const sn = v.name.replace("Yamaha ", "").replace("Škoda ", "").replace("BMW ", "").replace("Audi ", "");
      out.push(`    <rect x="0" y="${y - 7}" width="8" height="8" fill="${v.col}"/>`);
      out.push(`    <text x="13" y="${y}" class="pt">${esc(sn)}</text><text x="142" y="${y}" class="pt" text-anchor="end">${v.l.toFixed(2)} × ${v.w.toFixed(2)}</text><text x="170" y="${y}" class="pt" text-anchor="end">${v.turn.toFixed(1)}</text>`);
      y += 12;
    }
    out.push(`    <text x="0" y="${y}" class="ok" font-size="8.5">${esc(verdict[bay])}</text>`);
    y += 20;
  }
  out.push(`    <text x="0" y="${y}" class="pt" fill="#444" font-weight="700">Door &amp; exit clearance (carport)</text>`);
  y += 12;
  for (const line of [
    "W walkway 0.8 m → house door (opens in): OK.",
    "E walkway 0.85 m → garage door: OK.",
    "Between the cars ~1.0 m → inner doors ~0.5 m",
    "each: tight — get out on the outer side.",
    "Keep both side strips clear (no parking on them).",
  ]) { out.push(`    <text x="0" y="${y}" class="pt" fill="#555">${esc(line)}</text>`); y += 12; }
  y += 6;
  out.push(`    <text x="0" y="${y}" class="pt" fill="#444" font-weight="700">Access from the gate</text>`);
  y += 12;
  for (const line of [
    "Gate 4.0 m clear (+ separate 0.9 m wicket).",
    "Turning Ø 11.2 m met by driveway + apron L.",
    "Drive in forward, back-and-fill, leave forward.",
    "A6 allroad (Ø 12.1 m) is the tightest: still OK,",
    "reverse the last bit into the carport if needed.",
  ]) { out.push(`    <text x="0" y="${y}" class="pt" fill="#555">${esc(line)}</text>`); y += 12; }
  y += 6;
  out.push(`    <text x="0" y="${y}" class="pt" fill="#888">Widths exclude mirrors (~+0.25 m). Fold mirrors</text>`);
  out.push(`    <text x="0" y="${y + 12}" class="pt" fill="#888">for the side-by-side carport pair.</text>`);
  out.push(`  </g>`);

  out.push(`</svg>`);
  return out.join("\n");
}

module.exports = { renderDrivewayCheckSVG };
