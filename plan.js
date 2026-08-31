// Renders the 2D SVG plan from layout.js data. Used by editor.html and generate-svg.js.
(function () {
  const ROWS = "abcdefghijklmnopqrstuvwxyz";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function attrs(obj) {
    return Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => ` ${k}="${esc(v)}"`)
      .join("");
  }

  function renderPlanSVG(garden) {
    const S = garden.m2px;
    const px = (m) => Math.round(m * S * 100) / 100;
    const cell = garden.gridCellM * S;
    const major = cell * 5;
    const maxX = Math.max(...garden.plot.vertices.map((v) => v[0]));
    const maxY = Math.max(...garden.plot.vertices.map((v) => v[1]));
    const cols = Math.floor((maxX - garden.gridCellM / 2) / garden.gridCellM) + 1;
    const rows = Math.floor((maxY - garden.gridCellM / 2) / garden.gridCellM) + 1;
    const plotPts = garden.plot.vertices.map(([x, y]) => `${px(x)},${px(y)}`).join(" ");
    const out = [];

    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 880" font-family="-apple-system, BlinkMacSystemFont, sans-serif">`);
    out.push(`  <defs>
    <pattern id="cellgrid" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse">
      <path d="M ${cell} 0 L 0 0 0 ${cell}" fill="none" stroke="#d8d8d8" stroke-width="0.6"/>
    </pattern>
    <pattern id="majorgrid" x="0" y="0" width="${major}" height="${major}" patternUnits="userSpaceOnUse">
      <rect width="${major}" height="${major}" fill="url(#cellgrid)"/>
      <path d="M ${major} 0 L 0 0 0 ${major}" fill="none" stroke="#a0a0a0" stroke-width="1"/>
    </pattern>
    <clipPath id="plotShape">
      <polygon points="${plotPts}"/>
    </clipPath>
  </defs>`);
    out.push(`  <style>
    text { font-family: -apple-system, sans-serif; fill: #2a2a2a; }
    .title { font-size: 18px; font-weight: 700; text-anchor: middle; }
    .subtitle { font-size: 11px; fill: #666; text-anchor: middle; }
    .lbl { font-size: 12px; text-anchor: middle; }
    .lbl-w { font-size: 12px; text-anchor: middle; fill: white; }
    .lbl-sm { font-size: 10px; text-anchor: middle; }
    .lbl-sm-w { font-size: 10px; text-anchor: middle; fill: white; }
    .compass { font-size: 14px; font-weight: 700; text-anchor: middle; }
    .strana { font-size: 10px; fill: #557; font-weight: 600; text-anchor: middle; }
    .dim { font-size: 9px; fill: #b22; text-anchor: middle; font-style: italic; }
    .axis { font-size: 9px; fill: #555; text-anchor: middle; font-weight: 600; }
    .tb-proj { font-size: 12px; font-weight: 700; letter-spacing: 0.4px; }
    .tb-sub { font-size: 8px; fill: #555; }
    .tb-lbl { font-size: 6.5px; fill: #888; font-weight: 600; letter-spacing: 1.2px; }
    .tb-val { font-size: 9px; }
    .tb-rev { font-size: 11px; font-weight: 700; }
    .leg { font-size: 8.5px; }
    .note { font-size: 8.5px; fill: #888; }
  </style>`);
    out.push(`  <rect x="0" y="0" width="1100" height="880" fill="white"/>`);
    out.push(`  <text x="550" y="28" class="title">${esc(garden.title)}</text>`);
    out.push(`  <text x="550" y="46" class="subtitle">Plot ${r2(polyArea(garden.plot.vertices))} m² · grid ${garden.gridCellM} × ${garden.gridCellM} m (columns 1–${cols}, rows a–${ROWS[rows - 1]})</text>`);
    out.push(`  <g transform="translate(80, 110)">`);
    out.push(`    <g clip-path="url(#plotShape)"><rect x="-50" y="-10" width="900" height="700" fill="url(#majorgrid)"/></g>`);
    out.push(`    <polygon points="${plotPts}" fill="none" stroke="#2a2a2a" stroke-width="2.5"/>`);

    const colLabels = [];
    for (let i = 1; i <= cols; i++) colLabels.push(`<text x="${(i - 0.5) * cell}" y="-6">${i}</text>`);
    out.push(`    <g class="axis-labels" font-size="9" fill="#555" text-anchor="middle" font-weight="600">${colLabels.join("")}</g>`);
    const rowLabels = [];
    for (let j = 0; j < rows; j++) rowLabels.push(`<text x="-10" y="${j * cell + 22}">${ROWS[j]}</text>`);
    out.push(`    <g class="axis-labels" font-size="9" fill="#555" text-anchor="middle" font-weight="600">${rowLabels.join("")}</g>`);

    for (const sl of garden.plot.sideLabels) {
      const t = sl.rotate ? ` transform="rotate(${sl.rotate}, ${px(sl.at[0])}, ${px(sl.at[1])})"` : "";
      out.push(`    <text x="${px(sl.at[0])}" y="${px(sl.at[1])}" class="strana"${t}>${esc(sl.text)}</text>`);
    }

    out.push(`    <g stroke="#b22" stroke-width="0.6" fill="#b22">`);
    for (const sb of garden.setbacks) {
      const [x1, y1] = [px(sb.from[0]), px(sb.from[1])];
      const [x2, y2] = [px(sb.to[0]), px(sb.to[1])];
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const tick = 3;
      const nx = (-(y2 - y1) / len) * tick;
      const ny = ((x2 - x1) / len) * tick;
      out.push(`      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-dasharray="3,2"/>`);
      for (const [ex, ey] of [[x1, y1], [x2, y2]]) {
        out.push(`      <line x1="${r2(ex + nx)}" y1="${r2(ey + ny)}" x2="${r2(ex - nx)}" y2="${r2(ey - ny)}" stroke-width="1"/>`);
      }
      out.push(`      <text x="${px(sb.at[0])}" y="${px(sb.at[1])}" font-size="9" font-style="italic" stroke="none" text-anchor="${sb.anchor || "start"}">${esc(sb.label)}</text>`);
    }
    out.push(`    </g>`);

    for (const el of garden.elements) {
      out.push(`    <g class="el" data-id="${esc(el.id)}"><title>${esc(el.name)}</title>`);
      for (const p of el.parts) {
        out.push(`      ${renderPart(p, px)}`);
      }
      out.push(`    </g>`);
    }
    out.push(`  </g>`);

    out.push(`  <g transform="translate(1020, 110)">
    <circle cx="0" cy="0" r="30" fill="white" stroke="#555" stroke-width="1.5"/>
    <path d="M 0 -24 L 6 4 L 0 -7 L -6 4 Z" fill="#2a2a2a"/>
    <path d="M 0 7 L 6 -4 L 0 24 L -6 -4 Z" fill="#999"/>
    <text x="0" y="-36" class="compass">N</text>
    <text x="0" y="44" class="compass">S</text>
    <text x="-40" y="5" class="compass">W</text>
    <text x="40" y="5" class="compass">E</text>
  </g>`);
    const rows2 = garden.elements.map((el) => scheduleRow(el, garden.gridCellM, garden));
    out.push(`  <g transform="translate(902, 190)" font-size="8.5" fill="#2a2a2a">`);
    out.push(`    <text x="0" y="0" font-weight="700" font-size="10">ELEMENT SCHEDULE</text>`);
    out.push(`    <text x="0" y="15" fill="#555" font-weight="600">element</text><text x="88" y="15" fill="#555" font-weight="600">size (m)</text><text x="170" y="15" fill="#555" font-weight="600" text-anchor="end">m²</text><text x="193" y="15" fill="#555" font-weight="600" text-anchor="end">cell</text>`);
    out.push(`    <line x1="0" y1="19" x2="193" y2="19" stroke="#bbb" stroke-width="0.8"/>`);
    rows2.forEach((r, i) => {
      const y = 30 + i * 12;
      out.push(`    <text x="0" y="${y}">${esc(r.name)}</text><text x="88" y="${y}">${esc(r.size)}</text><text x="170" y="${y}" text-anchor="end">${r.area === null ? "—" : r2(r.area)}</text><text x="193" y="${y}" text-anchor="end">${esc(r.cell)}</text>`);
    });
    out.push(`  </g>`);
    out.push(renderLegend());
    out.push(`  <g transform="translate(80, 842)">
    <rect x="0" y="0" width="${5 * S}" height="10" fill="#2a2a2a"/>
    <rect x="${5 * S}" y="0" width="${5 * S}" height="10" fill="white" stroke="#2a2a2a" stroke-width="1"/>
    <text x="0" y="24" class="lbl-sm" text-anchor="start">0</text>
    <text x="${5 * S}" y="24" class="lbl-sm">5 m</text>
    <text x="${10 * S}" y="24" class="lbl-sm">10 m</text>
  </g>`);
    out.push(`  <text x="300" y="850" class="note">Cells are addressed as "{column}{row}", e.g. "12g" = column 12, row g. Each cell is ${garden.gridCellM} × ${garden.gridCellM} m. Generated from layout.js (node generate-svg.js).</text>`);
    out.push(renderTitleBlock(garden));
    out.push(`</svg>`);
    return out.join("\n") + "\n";
  }

  function r2(v) {
    return Math.round(v * 100) / 100;
  }

  function polyArea(points) {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;
  }

  function shortName(name) {
    const s = name
      .replace(/\s*\(.*$/, "")
      .replace(/\s+[~ø]?[\d.]+\s*m?\s*×.*$/, "")
      .replace(/\s+ø\s*[\d.]+.*$/, "")
      .replace(/\s+~[\d.]+.*$/, "");
    return (s.length >= 3 ? s : name).slice(0, 20);
  }

  function partBox(p) {
    if (p.kind === "rect") return [p.x, p.y, p.x + p.w, p.y + p.d];
    if (p.kind === "circle") return [p.cx - p.r, p.cy - p.r, p.cx + p.r, p.cy + p.r];
    if (p.kind === "ellipse") return [p.cx - p.rx, p.cy - p.ry, p.cx + p.rx, p.cy + p.ry];
    if (p.kind === "polygon") {
      const xs = p.points.map((q) => q[0]), ys = p.points.map((q) => q[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    return null;
  }

  function boxesOverlap(a, b) {
    return Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 1e-6 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1e-6;
  }

  function shapeArea(p) {
    if (p.kind === "rect") return p.w * p.d;
    if (p.kind === "polygon") return polyArea(p.points);
    if (p.kind === "ellipse") return Math.PI * p.rx * p.ry;
    if (p.kind === "circle") return Math.PI * p.r * p.r;
    return 0;
  }

  // Same-kind parts that do not overlap are separate pieces of one element and their areas add up:
  // an L-shaped terrace, two beds either side of the pergola, three climber strips. Parts that DO
  // overlap are drawing detail over the same footprint — a garage door leaf proud of the wall, the
  // pergola roof over its slab — so only the first part counts, or the quantity is inflated.
  function footprintParts(shapes) {
    const same = shapes.filter((p) => p.kind === shapes[0].kind);
    const boxes = same.map(partBox);
    for (let i = 0; i < same.length; i++)
      for (let j = i + 1; j < same.length; j++)
        if (boxesOverlap(boxes[i], boxes[j])) return [shapes[0]];
    return same;
  }

  function scheduleRow(el, cellM, garden) {
    const shapes = el.parts.filter((p) => p.kind !== "text");
    const circles = shapes.filter((p) => p.kind === "circle");
    const first = shapes[0];
    const foot = footprintParts(shapes);
    // "2.00 × 4.00 ×2" for identical pieces, "1.00 × 19.25 +1" when they differ.
    const multi = () => {
      if (foot.length < 2) return "";
      const a0 = shapeArea(foot[0]);
      const alike = foot.every((p) => Math.abs(shapeArea(p) - a0) < 1e-6);
      return alike ? ` ×${foot.length}` : ` +${foot.length - 1}`;
    };
    let size = "";
    let area = null;
    let bx = Infinity, by = Infinity;
    for (const p of shapes) {
      if (p.kind === "rect") { bx = Math.min(bx, p.x); by = Math.min(by, p.y); }
      else if (p.kind === "polygon") for (const [x, y] of p.points) { bx = Math.min(bx, x); by = Math.min(by, y); }
      else if (p.kind === "ellipse") { bx = Math.min(bx, p.cx - p.rx); by = Math.min(by, p.cy - p.ry); }
      else if (p.kind === "circle") { bx = Math.min(bx, p.cx - p.r); by = Math.min(by, p.cy - p.r); }
      else if (p.kind === "line") { bx = Math.min(bx, p.x1, p.x2); by = Math.min(by, p.y1, p.y2); }
    }
    if (first.kind === "rect") { size = `${r2(first.w)} × ${r2(first.d)}${multi()}`; area = foot.reduce((t, p) => t + shapeArea(p), 0); }
    else if (first.kind === "polygon") {
      const xs = first.points.map((p) => p[0]), ys = first.points.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...ys) - Math.min(...ys);
      size = `${r2(w)} × ${r2(d)}${multi()}`;
      area = foot.reduce((t, p) => t + shapeArea(p), 0);
    }
    else if (first.kind === "ellipse") {
      size = `${r2(2 * first.rx)} × ${r2(2 * first.ry)}`;
      area = Math.PI * first.rx * first.ry;
      const exId = el.meta && el.meta.exclude;
      const ex = exId && garden.elements.find((e) => e.id === exId);
      const exEll = ex && ex.parts.find((p) => p.kind === "ellipse");
      if (exEll) area -= Math.PI * exEll.rx * exEll.ry;
    }
    else if (first.kind === "circle") {
      // Concentric circles (e.g. spot symbol inner dots) count as one fixture
      if (circles.length > 2) size = `${new Set(circles.map((c) => `${c.cx},${c.cy}`)).size} pcs`;
      else { size = `ø ${r2(2 * first.r)}`; area = Math.PI * first.r * first.r; }
    }
    else if (first.kind === "line") size = `${r2(Math.hypot(first.x2 - first.x1, first.y2 - first.y1))} long`;
    const col = Math.floor(bx / cellM) + 1;
    const row = ROWS[Math.max(0, Math.floor(by / cellM))] || "?";
    return { name: el.short || shortName(el.name), size, area, cell: `${col}${row}` };
  }

  const LEGEND_ITEMS = [
    { label: "house", fill: "#d4b896", stroke: "#7a5e3e" },
    { label: "garage", fill: "#888888", stroke: "#3a3a3a" },
    { label: "deck / terrace", fill: "#a87d4a", stroke: "#5a3e25" },
    { label: "driveway / paving", fill: "#cccccc", stroke: "#9a9a9a" },
    { label: "water (pond, tank)", fill: "#3a7ab8", stroke: "#1f3a5f" },
    { label: "raised bed", fill: "#7a5a3a", stroke: "#5a3e25" },
    { label: "perennial bed", fill: "#8fa05a", stroke: "#6a7a3a", dash: true },
    { label: "shrub planting", fill: "#6a8e5a", stroke: "#4a6e3a", dash: true },
    { label: "meadow", fill: "#b5c98a", stroke: "#8aa85a", dash: true },
    { label: "rain garden", fill: "#7aa88a", stroke: "#4a7a6a", dash: true },
    { label: "tree", tree: true },
    { label: "light fixture", light: true },
  ];

  function renderLegend() {
    const out = [
      `  <g>`,
      `    <rect x="80" y="756" width="620" height="70" fill="white" stroke="#2a2a2a" stroke-width="1"/>`,
      `    <text x="92" y="771" class="tb-lbl">LEGEND</text>`,
    ];
    LEGEND_ITEMS.forEach((it, i) => {
      const x = 92 + (i % 6) * 101;
      const y = 792 + Math.floor(i / 6) * 20;
      if (it.tree) out.push(`    <circle cx="${x + 6}" cy="${y - 4}" r="5" fill="#4d7a4d"/>`);
      else if (it.light) out.push(`    <circle cx="${x + 6}" cy="${y - 4}" r="5" fill="#ffd54a" stroke="#8a6a1a" stroke-width="1"/><circle cx="${x + 6}" cy="${y - 4}" r="1.7" fill="#8a6a1a"/>`);
      else out.push(`    <rect x="${x}" y="${y - 9}" width="12" height="10" fill="${it.fill}" fill-opacity="${it.dash ? 0.45 : 0.85}" stroke="${it.stroke}" stroke-width="1"${it.dash ? ` stroke-dasharray="3,2"` : ""}/>`);
      out.push(`    <text x="${x + 17}" y="${y}" class="leg">${esc(it.label)}</text>`);
    });
    out.push(`  </g>`);
    return out.join("\n");
  }

  function renderTitleBlock(garden) {
    const dm = garden.docMeta || {};
    return [
      `  <g>`,
      `    <rect x="780" y="792" width="312" height="80" fill="white" stroke="#2a2a2a" stroke-width="1.5"/>`,
      `    <line x1="780" y1="822" x2="1092" y2="822" stroke="#2a2a2a" stroke-width="0.6"/>`,
      `    <line x1="780" y1="848" x2="1092" y2="848" stroke="#2a2a2a" stroke-width="0.6"/>`,
      `    <line x1="998" y1="792" x2="998" y2="872" stroke="#2a2a2a" stroke-width="0.6"/>`,
      `    <text x="790" y="807" class="tb-proj">${esc(dm.project || "")}</text>`,
      `    <text x="790" y="818" class="tb-sub">${esc(dm.place || "")}</text>`,
      `    <text x="1006" y="802" class="tb-lbl">REVISION</text>`,
      `    <text x="1006" y="816" class="tb-rev">${esc(dm.revision || "")}</text>`,
      `    <text x="790" y="832" class="tb-lbl">DRAWING</text>`,
      `    <text x="790" y="843" class="tb-val">${esc(dm.drawing || "")}</text>`,
      `    <text x="1006" y="832" class="tb-lbl">GRID</text>`,
      `    <text x="1006" y="843" class="tb-val">${garden.gridCellM} × ${garden.gridCellM} m</text>`,
      `    <text x="790" y="857" class="tb-lbl">DRAWN</text>`,
      `    <text x="790" y="868" class="tb-val">${esc(dm.author || "")}</text>`,
      `    <text x="1006" y="857" class="tb-lbl">NORTH</text>`,
      `    <text x="1006" y="868" class="tb-val">↑ sheet top</text>`,
      `  </g>`,
    ].join("\n");
  }

  function renderPart(p, px) {
    const style = attrs({
      fill: p.kind === "text" ? undefined : p.fill || "none",
      opacity: p.opacity,
      stroke: p.stroke,
      "stroke-width": p.sw,
      "stroke-dasharray": p.dash,
      "stroke-linecap": p.cap,
    });
    let s;
    switch (p.kind) {
      case "rect":
        s = `<rect x="${px(p.x)}" y="${px(p.y)}" width="${px(p.w)}" height="${px(p.d)}"${style}/>`;
        break;
      case "polygon":
        s = `<polygon points="${p.points.map(([x, y]) => `${px(x)},${px(y)}`).join(" ")}"${style}/>`;
        break;
      case "ellipse":
        s = `<ellipse cx="${px(p.cx)}" cy="${px(p.cy)}" rx="${px(p.rx)}" ry="${px(p.ry)}"${style}/>`;
        break;
      case "circle":
        s = `<circle cx="${px(p.cx)}" cy="${px(p.cy)}" r="${px(p.r)}"${style}/>`;
        break;
      case "line":
        s = `<line x1="${px(p.x1)}" y1="${px(p.y1)}" x2="${px(p.x2)}" y2="${px(p.y2)}"${style}/>`;
        break;
      case "text": {
        const t = attrs({
          x: px(p.x),
          y: px(p.y),
          class: p.cls,
          fill: p.fill,
          "font-size": p.size,
          "font-weight": p.weight,
          "text-anchor": p.anchor,
          transform: p.rotate ? `rotate(${p.rotate}, ${px(p.x)}, ${px(p.y)})` : undefined,
        });
        s = `<text${t}>${esc(p.text)}</text>`;
        break;
      }
      default:
        s = `<!-- unknown part kind: ${esc(p.kind)} -->`;
    }
    return p.clipToPlot ? `<g clip-path="url(#plotShape)">${s}</g>` : s;
  }

  // Serializes a layout object back into layout.js file content (compact number arrays).
  function serializeLayout(garden) {
    const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
    const flat = (a) => a.every((v) => typeof v === "number" || typeof v === "string" || typeof v === "boolean" || (Array.isArray(v) && v.every((n) => typeof n === "number")));
    function fmt(v, ind) {
      if (Array.isArray(v)) {
        if (v.length === 0) return "[]";
        if (flat(v)) return JSON.stringify(v).replace(/,/g, ", ");
        const items = v.map((it) => ind + "  " + fmt(it, ind + "  "));
        return "[\n" + items.join(",\n") + "\n" + ind + "]";
      }
      if (v && typeof v === "object") {
        const entries = Object.entries(v).filter(([, val]) => val !== undefined);
        if (entries.length === 0) return "{}";
        const oneLine = "{ " + entries.map(([k, val]) => `${IDENT.test(k) ? k : JSON.stringify(k)}: ${fmt(val, ind)}`).join(", ") + " }";
        if (!oneLine.includes("\n") && oneLine.length + ind.length <= 300) return oneLine;
        const items = entries.map(([k, val]) => `${ind}  ${IDENT.test(k) ? k : JSON.stringify(k)}: ${fmt(val, ind + "  ")}`);
        return "{\n" + items.join(",\n") + "\n" + ind + "}";
      }
      return JSON.stringify(v);
    }
    return [
      "// Garden layout — single source of truth for the 2D plan, the 2D editor and the 3D viewer.",
      "// All coordinates in meters. Origin: plot NW corner. x → east, y → south (= z in the 3D viewer).",
      "// 2D pages render at m2px pixels per meter. Regenerate zahrada-plan.svg with: node generate-svg.js",
      "const GARDEN = " + fmt(garden, "") + ";",
      "",
      'if (typeof module !== "undefined") module.exports = { GARDEN };',
      "",
    ].join("\n");
  }

  const api = { renderPlanSVG, serializeLayout };
  if (typeof module !== "undefined") module.exports = api;
  if (typeof window !== "undefined") Object.assign(window, api);
})();
