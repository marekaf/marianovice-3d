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
  </style>`);
    out.push(`  <rect x="0" y="0" width="1100" height="880" fill="white"/>`);
    out.push(`  <text x="550" y="28" class="title">${esc(garden.title)}</text>`);
    out.push(`  <text x="550" y="46" class="subtitle">Pentagon plot · grid ${garden.gridCellM} × ${garden.gridCellM} m (columns 1–${cols}, rows a–${ROWS[rows - 1]})</text>`);
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
    out.push(`  <g transform="translate(80, 815)">
    <rect x="0" y="0" width="${5 * S}" height="10" fill="#2a2a2a"/>
    <rect x="${5 * S}" y="0" width="${5 * S}" height="10" fill="white" stroke="#2a2a2a" stroke-width="1"/>
    <text x="0" y="28" class="lbl-sm" text-anchor="start">0</text>
    <text x="${5 * S}" y="28" class="lbl-sm">5 m</text>
    <text x="${10 * S}" y="28" class="lbl-sm">10 m</text>
  </g>`);
    out.push(`  <text x="80" y="858" class="lbl-sm" text-anchor="start" fill="#888">Cells are addressed as "{column}{row}", e.g. "12g" = column 12, row g. Each cell is ${garden.gridCellM} × ${garden.gridCellM} m.</text>`);
    out.push(`</svg>`);
    return out.join("\n") + "\n";
  }

  function r2(v) {
    return Math.round(v * 100) / 100;
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
