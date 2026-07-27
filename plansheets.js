// Per-zone planting sheets + bloom calendar, computed from layout.js + planting.js.
// Convention: perennial count = area × 6.5/m², split kosterní 8 % / skupinové 50 % / půdopokryvné 30 % / vtroušené 12 %
// (roles missing from a mix fold into skupinové), then per-species share. Bulbs = area × 25/m² (zone overrides win).
// Plant dots are placed with a seeded deterministic PRNG (mulberry32 over the zone id) so regeneration is git-stable.
// Regenerate docs/plansheets/*.svg + docs/bloom-calendar.svg with: node generate-plansheets.js
(function () {
  const ROWS = "abcdefghijklmnopqrstuvwxyz";
  const ROLES = ["kosterni", "skupinove", "pudopokryvne", "vtrousene"];
  const ROLE_LABEL = { kosterni: "kosterní", skupinove: "skupinové", pudopokryvne: "půdopokryvné", vtrousene: "vtroušené", cibulovina: "cibulovina", ker: "keř", strom: "strom", popinavka: "popínavka" };
  // Categorical role colors (validated all-pairs, dataviz palette slots 1/2/3/7); size is the secondary encoding.
  const ROLE_COLOR = { kosterni: "#2a78d6", skupinove: "#eb6834", pudopokryvne: "#1baf7a", vtrousene: "#4a3aa7" };
  const ROLE_R = { kosterni: 0.22, skupinove: 0.14, pudopokryvne: 0.09, vtrousene: 0.11 };
  const WOODY_COLOR = "#008300";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function r2(v) { return Math.round(v * 100) / 100; }
  function r1(v) { return Math.round(v * 10) / 10; }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function polyArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;
  }
  function polyPerimeter(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      s += Math.hypot(x2 - x1, y2 - y1);
    }
    return s;
  }
  function pointInPoly(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function distToPolyEdge(pts, x, y) {
    let d = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      d = Math.min(d, distToSeg(x, y, x1, y1, x2, y2));
    }
    return d;
  }
  function ellipsePerimeter(rx, ry) {
    const h = Math.pow((rx - ry) / (rx + ry), 2);
    return Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  }
  // Sutherland–Hodgman, convex clip polygon.
  function clipPoly(subject, clip) {
    let out = subject.slice();
    for (let i = 0; i < clip.length; i++) {
      const inp = out;
      out = [];
      const [ax, ay] = clip[i], [bx, by] = clip[(i + 1) % clip.length];
      const side = ([px, py]) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
      for (let j = 0; j < inp.length; j++) {
        const cur = inp[j], prev = inp[(j + inp.length - 1) % inp.length];
        const cs = side(cur), ps = side(prev);
        if (cs >= 0) {
          if (ps < 0) out.push(intersect(prev, cur, [ax, ay], [bx, by]));
          out.push(cur);
        } else if (ps >= 0) {
          out.push(intersect(prev, cur, [ax, ay], [bx, by]));
        }
      }
      if (!out.length) break;
    }
    return out;
  }
  function intersect([x1, y1], [x2, y2], [x3, y3], [x4, y4]) {
    const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  }

  // Normalized shapes: rect→poly, polygon→poly (clipped to plot when clipToPlot), ellipse(+exclude)→ring.
  function zoneGeometry(garden, zoneId) {
    const el = garden.elements.find((e) => e.id === zoneId);
    if (!el) throw new Error("unknown zone element: " + zoneId);
    const shapes = [];
    for (const p of el.parts) {
      if (p.kind === "rect") {
        let pts = [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.d], [p.x, p.y + p.d]];
        if (p.clipToPlot) pts = clipPoly(pts, garden.plot.vertices);
        shapes.push({ kind: "poly", pts });
      } else if (p.kind === "polygon") {
        let pts = p.points;
        if (p.clipToPlot) pts = clipPoly(pts, garden.plot.vertices);
        shapes.push({ kind: "poly", pts });
      } else if (p.kind === "ellipse") {
        const shape = { kind: "ring", outer: { cx: p.cx, cy: p.cy, rx: p.rx, ry: p.ry }, hole: null };
        const exId = el.meta && el.meta.exclude;
        if (exId) {
          const ex = garden.elements.find((e) => e.id === exId);
          const exEll = ex && ex.parts.find((q) => q.kind === "ellipse");
          if (exEll) shape.hole = { cx: exEll.cx, cy: exEll.cy, rx: exEll.rx, ry: exEll.ry };
        }
        shapes.push(shape);
      } else if (p.kind === "circle") {
        shapes.push({ kind: "circle", cx: p.cx, cy: p.cy, r: p.r });
      }
    }
    return { el, shapes };
  }

  function shapeArea(s) {
    if (s.kind === "poly") return polyArea(s.pts);
    if (s.kind === "circle") return Math.PI * s.r * s.r;
    if (s.kind === "ring") {
      let a = Math.PI * s.outer.rx * s.outer.ry;
      if (s.hole) a -= Math.PI * s.hole.rx * s.hole.ry;
      return a;
    }
    return 0;
  }
  function shapePerimeter(s) {
    if (s.kind === "poly") return polyPerimeter(s.pts);
    if (s.kind === "circle") return 2 * Math.PI * s.r;
    if (s.kind === "ring") return ellipsePerimeter(s.outer.rx, s.outer.ry);
    return 0;
  }
  function shapeBBox(s) {
    if (s.kind === "poly") {
      const xs = s.pts.map((p) => p[0]), ys = s.pts.map((p) => p[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    if (s.kind === "circle") return [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r];
    return [s.outer.cx - s.outer.rx, s.outer.cy - s.outer.ry, s.outer.cx + s.outer.rx, s.outer.cy + s.outer.ry];
  }
  function shapeContains(s, x, y) {
    if (s.kind === "poly") return pointInPoly(s.pts, x, y);
    if (s.kind === "circle") return Math.hypot(x - s.cx, y - s.cy) <= s.r;
    const tOut = Math.hypot((x - s.outer.cx) / s.outer.rx, (y - s.outer.cy) / s.outer.ry);
    if (tOut > 1) return false;
    if (s.hole) {
      const tIn = Math.hypot((x - s.hole.cx) / s.hole.rx, (y - s.hole.cy) / s.hole.ry);
      if (tIn < 1) return false;
    }
    return true;
  }
  function shapeEdgeDist(s, x, y) {
    if (s.kind === "poly") return distToPolyEdge(s.pts, x, y);
    if (s.kind === "circle") return s.r - Math.hypot(x - s.cx, y - s.cy);
    const tOut = Math.hypot((x - s.outer.cx) / s.outer.rx, (y - s.outer.cy) / s.outer.ry);
    let d = (1 - tOut) * Math.min(s.outer.rx, s.outer.ry);
    if (s.hole) {
      const tIn = Math.hypot((x - s.hole.cx) / s.hole.rx, (y - s.hole.cy) / s.hole.ry);
      d = Math.min(d, (tIn - 1) * Math.min(s.hole.rx, s.hole.ry));
    }
    return d;
  }

  function bboxUnion(shapes) {
    let bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of shapes) {
      const b = shapeBBox(s);
      bb = [Math.min(bb[0], b[0]), Math.min(bb[1], b[1]), Math.max(bb[2], b[2]), Math.max(bb[3], b[3])];
    }
    return bb;
  }

  // ---- plan computation ----------------------------------------------------

  function effectiveSpecies(planting, zoneDef) {
    const ov = zoneDef.overrides || {};
    let list = zoneDef.mix ? planting.mixes[zoneDef.mix].species.slice() : [];
    if (ov.include) list = list.filter((sp) => ov.include.includes(sp.lat));
    if (ov.exclude) list = list.filter((sp) => !ov.exclude.includes(sp.lat));
    if (ov.add) list = list.concat(ov.add);
    if (ov.bulbs) list = list.filter((sp) => sp.role !== "cibulovina").concat(ov.bulbs);
    return list;
  }

  function computeZonePlan(garden, planting, zoneId) {
    const zoneDef = planting.zones[zoneId];
    if (!zoneDef) throw new Error("no planting zone def for " + zoneId);
    const { el, shapes } = zoneGeometry(garden, zoneId);
    const ov = zoneDef.overrides || {};
    const area = ov.containers ? 0 : shapes.reduce((a, s) => a + shapeArea(s), 0);
    const mix = zoneDef.mix ? planting.mixes[zoneDef.mix] : null;
    const plan = { zoneId, el, zoneDef, mix, shapes, area, species: [], woody: [], containers: ov.containers || null, seedMix: ov.seedMix || null, plugs: ov.plugs || [] };

    if (ov.woody) {
      for (const w of ov.woody) {
        const sp = planting.mixes.dreviny.species.find((d) => d.lat === w.lat);
        if (!sp) throw new Error("unknown woody: " + w.lat);
        plan.woody.push({ ...sp, count: w.count });
      }
    }
    if (ov.containers) {
      for (const c of ov.containers) for (const sp of c.contents) plan.species.push({ ...sp, role: sp.role || "nádoba", container: c.label });
      return plan;
    }

    const list = effectiveSpecies(planting, zoneDef);
    const perennialArea = ov.perennialAreaM2 != null ? ov.perennialAreaM2 : area;
    const totalPerennials = Math.round(perennialArea * planting.densities.perennialsPerM2);
    // renormalize shares per role; fold fractions of absent roles into skupinové
    const byRole = {};
    for (const role of ROLES) byRole[role] = list.filter((sp) => sp.role === role);
    const split = { ...planting.roleSplit };
    let fold = 0;
    for (const role of ROLES) if (role !== "skupinove" && byRole[role].length === 0) { fold += split[role]; split[role] = 0; }
    split.skupinove += fold;
    for (const role of ROLES) {
      const specs = byRole[role];
      if (!specs.length) continue;
      const roleCount = Math.round(totalPerennials * split[role]);
      const shareSum = specs.reduce((a, sp) => a + (sp.share || 0), 0) || specs.length;
      for (const sp of specs) {
        const share = (sp.share || 1) / shareSum;
        plan.species.push({ ...sp, count: Math.max(1, Math.round(roleCount * share)), share });
      }
    }
    const bulbsPerM2 = ov.bulbsPerM2 != null ? ov.bulbsPerM2 : planting.densities.bulbsPerM2;
    const bulbSpecs = list.filter((sp) => sp.role === "cibulovina");
    if (bulbsPerM2 > 0 && bulbSpecs.length) {
      const totalBulbs = Math.round(perennialArea * bulbsPerM2);
      const shareSum = bulbSpecs.reduce((a, sp) => a + (sp.share || 0), 0) || bulbSpecs.length;
      for (const sp of bulbSpecs) {
        plan.species.push({ ...sp, count: Math.round((totalBulbs * (sp.share || 1)) / shareSum) });
      }
    }
    for (const p of plan.plugs) plan.species.push({ ...p, role: "pudopokryvne", plug: true });
    plan.totalPerennials = plan.species.filter((sp) => ROLES.includes(sp.role) && !sp.plug).reduce((a, sp) => a + sp.count, 0);
    plan.totalBulbs = plan.species.filter((sp) => sp.role === "cibulovina").reduce((a, sp) => a + sp.count, 0);
    return plan;
  }

  // ---- placement -----------------------------------------------------------

  function pickShape(shapes, rnd, only) {
    const idxs = only != null ? [only] : shapes.map((_, i) => i);
    const areas = idxs.map((i) => shapeArea(shapes[i]));
    const total = areas.reduce((a, b) => a + b, 0);
    let t = rnd() * total;
    for (let k = 0; k < idxs.length; k++) { t -= areas[k]; if (t <= 0) return shapes[idxs[k]]; }
    return shapes[idxs[idxs.length - 1]];
  }
  function samplePoint(shape, rnd) {
    const [x0, y0, x1, y1] = shapeBBox(shape);
    for (let i = 0; i < 400; i++) {
      const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
      if (shapeContains(shape, x, y)) return [x, y];
    }
    return [(x0 + x1) / 2, (y0 + y1) / 2];
  }

  function placeWoody(plan, rnd) {
    const ov = plan.zoneDef.overrides || {};
    const shapes = ov.woodyShape != null ? [plan.shapes[ov.woodyShape]] : plan.shapes;
    const bb = bboxUnion(shapes);
    const alongX = bb[2] - bb[0] >= bb[3] - bb[1];
    const items = [];
    for (const w of plan.woody) for (let i = 0; i < w.count; i++) items.push(w);
    const placed = [];
    items.forEach((w, i) => {
      const t = (i + 0.5) / items.length;
      const target = alongX ? bb[0] + t * (bb[2] - bb[0]) : bb[1] + t * (bb[3] - bb[1]);
      let best = null, bestScore = Infinity;
      for (let k = 0; k < 60; k++) {
        const shape = pickShape(shapes, rnd);
        const [x, y] = samplePoint(shape, rnd);
        const along = alongX ? x : y;
        let score = Math.abs(along - target);
        for (const q of placed) if (Math.hypot(x - q.x, y - q.y) < 1.2) score += 10;
        if (score < bestScore) { bestScore = score; best = { x, y, sp: w }; }
      }
      placed.push(best);
    });
    return placed;
  }

  function placeDots(plan, rnd, woodyPts) {
    const ov = plan.zoneDef.overrides || {};
    let shapes = plan.shapes;
    if (ov.woodyShape != null && plan.shapes.length > 1) shapes = plan.shapes.filter((_, i) => i !== ov.woodyShape);
    const dots = [];
    const all = [];
    const okAt = (x, y, minD) => {
      for (const q of all) if (Math.hypot(x - q[0], y - q[1]) < minD) return false;
      for (const w of woodyPts) if (Math.hypot(x - w.x, y - w.y) < 0.7) return false;
      return true;
    };
    const put = (x, y, sp) => { all.push([x, y]); dots.push({ x, y, role: sp.role, lat: sp.lat }); };
    const tryPlace = (sp, pref) => {
      let minD = 0.34;
      for (let attempt = 0; attempt < 220; attempt++) {
        const cands = [];
        for (let c = 0; c < (pref ? 7 : 1); c++) {
          const shape = pickShape(shapes, rnd);
          const [x, y] = samplePoint(shape, rnd);
          cands.push([x, y, shapeEdgeDist(shape, x, y)]);
        }
        cands.sort((a, b) => (pref === "inner" ? b[2] - a[2] : a[2] - b[2]));
        const [x, y] = cands[0];
        if (okAt(x, y, minD)) { put(x, y, sp); return; }
        if (attempt % 40 === 39) minD *= 0.8;
      }
      const [x, y] = samplePoint(pickShape(shapes, rnd), rnd);
      put(x, y, sp);
    };
    const perennials = plan.species.filter((sp) => ROLES.includes(sp.role) && !sp.plug);
    for (const sp of perennials.filter((s) => s.role === "kosterni")) for (let i = 0; i < sp.count; i++) tryPlace(sp, "inner");
    // skupinové in drifts
    for (const sp of perennials.filter((s) => s.role === "skupinove")) {
      const nDrifts = Math.max(1, Math.round(sp.count / 7));
      const centers = [];
      for (let d = 0; d < nDrifts; d++) {
        const shape = pickShape(shapes, rnd);
        centers.push({ shape, pt: samplePoint(shape, rnd) });
      }
      for (let i = 0; i < sp.count; i++) {
        const c = centers[i % nDrifts];
        let minD = 0.3, done = false;
        for (let attempt = 0; attempt < 160 && !done; attempt++) {
          const ang = rnd() * Math.PI * 2, rad = Math.abs(gauss(rnd)) * 0.6;
          const x = c.pt[0] + Math.cos(ang) * rad, y = c.pt[1] + Math.sin(ang) * rad;
          if (shapeContains(c.shape, x, y) && okAt(x, y, minD)) { put(x, y, sp); done = true; }
          if (attempt % 40 === 39) minD *= 0.8;
        }
        if (!done) tryPlace(sp, null);
      }
    }
    for (const sp of perennials.filter((s) => s.role === "pudopokryvne")) for (let i = 0; i < sp.count; i++) tryPlace(sp, "edge");
    for (const sp of perennials.filter((s) => s.role === "vtrousene")) for (let i = 0; i < sp.count; i++) tryPlace(sp, null);
    return dots;
  }
  function gauss(rnd) {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ---- sheet rendering -----------------------------------------------------

  function cellAddr(garden, shapes) {
    const bb = bboxUnion(shapes);
    const col = Math.floor(bb[0] / garden.gridCellM) + 1;
    const row = ROWS[Math.max(0, Math.floor(bb[1] / garden.gridCellM))] || "?";
    return `${col}${row}`;
  }

  function shapePath(s, px) {
    if (s.kind === "poly") return `<polygon points="${s.pts.map(([x, y]) => `${px.x(x)},${px.y(y)}`).join(" ")}"`;
    if (s.kind === "circle") return `<circle cx="${px.x(s.cx)}" cy="${px.y(s.cy)}" r="${px.s(s.r)}"`;
    return null; // ring handled separately
  }

  function renderPlanSheet(garden, planting, zoneId) {
    const plan = computeZonePlan(garden, planting, zoneId);
    const rnd = mulberry32(hashStr(zoneId));
    const isContainers = !!plan.containers;
    const isMeadow = !!plan.seedMix;
    const bb = bboxUnion(plan.shapes);
    const pad = 0.6;
    const bw = bb[2] - bb[0] + 2 * pad, bh = bb[3] - bb[1] + 2 * pad;
    const planW = 620, planH = 600;
    const scale = Math.min(planW / bw, planH / bh, 60);
    const ox = 40 + (planW - bw * scale) / 2, oy = 120 + (planH - bh * scale) / 2;
    const px = {
      x: (m) => r2(ox + (m - bb[0] + pad) * scale),
      y: (m) => r2(oy + (m - bb[1] + pad) * scale),
      s: (m) => r2(m * scale)
    };
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 780" font-family="-apple-system, BlinkMacSystemFont, sans-serif">`);
    out.push(`  <style>
    text { font-family: -apple-system, sans-serif; fill: #2a2a2a; }
    .title { font-size: 18px; font-weight: 700; text-anchor: middle; }
    .subtitle { font-size: 11px; fill: #666; text-anchor: middle; }
    .lbl { font-size: 12px; text-anchor: middle; }
    .lbl-sm { font-size: 10px; text-anchor: middle; }
    .dim { font-size: 9px; fill: #b22; text-anchor: middle; font-style: italic; }
    .th { font-size: 9px; fill: #555; font-weight: 600; }
    .td { font-size: 10px; }
    .td-lat { font-size: 9px; font-style: italic; fill: #666; }
  </style>`);
    out.push(`  <rect x="0" y="0" width="1100" height="780" fill="white"/>`);
    const mixLine = plan.mix ? `${plan.mix.name} — ${plan.mix.stanoviste}` : isContainers ? "výsadba v nádobách" : plan.seedMix ? plan.seedMix.name : "";
    out.push(`  <text x="360" y="34" class="title">${esc(plan.el.name)}</text>`);
    out.push(`  <text x="360" y="54" class="subtitle">${esc(mixLine)} · buňka ${esc(cellAddr(garden, plan.shapes))} · ${isContainers ? "3 nádoby" : r2(plan.area) + " m²"}</text>`);
    out.push(`  <text x="360" y="70" class="subtitle">${esc(plan.zoneDef.note)}</text>`);

    // clip for the 0.5 m grid
    out.push(`  <defs><clipPath id="bed">`);
    for (const s of plan.shapes) {
      if (s.kind === "ring") out.push(`    <ellipse cx="${px.x(s.outer.cx)}" cy="${px.y(s.outer.cy)}" rx="${px.s(s.outer.rx)}" ry="${px.s(s.outer.ry)}"/>`);
      else out.push(`    ${shapePath(s, px)}/>`);
    }
    out.push(`  </clipPath></defs>`);

    // bed fills
    for (const s of plan.shapes) {
      if (s.kind === "ring") {
        const o = s.outer;
        out.push(`  <ellipse cx="${px.x(o.cx)}" cy="${px.y(o.cy)}" rx="${px.s(o.rx)}" ry="${px.s(o.ry)}" fill="#eef1e2" stroke="#6a7a3a" stroke-width="1.5"/>`);
      } else {
        out.push(`  ${shapePath(s, px)} fill="#eef1e2" stroke="#6a7a3a" stroke-width="1.5"/>`);
      }
    }
    // 0.5 m grid clipped to the bed
    out.push(`  <g clip-path="url(#bed)">`);
    const g0x = Math.floor(bb[0] / 0.5) * 0.5, g0y = Math.floor(bb[1] / 0.5) * 0.5;
    for (let gx = g0x; gx <= bb[2] + 0.5; gx += 0.5) {
      const strong = Math.abs(gx / 2 - Math.round(gx / 2)) < 1e-9;
      out.push(`    <line x1="${px.x(gx)}" y1="${px.y(bb[1] - pad)}" x2="${px.x(gx)}" y2="${px.y(bb[3] + pad)}" stroke="${strong ? "#b8b8ae" : "#dcdcd2"}" stroke-width="${strong ? 1 : 0.6}"/>`);
    }
    for (let gy = g0y; gy <= bb[3] + 0.5; gy += 0.5) {
      const strong = Math.abs(gy / 2 - Math.round(gy / 2)) < 1e-9;
      out.push(`    <line x1="${px.x(bb[0] - pad)}" y1="${px.y(gy)}" x2="${px.x(bb[2] + pad)}" y2="${px.y(gy)}" stroke="${strong ? "#b8b8ae" : "#dcdcd2"}" stroke-width="${strong ? 1 : 0.6}"/>`);
    }
    out.push(`  </g>`);
    // pond hole outline for the ring
    for (const s of plan.shapes) {
      if (s.kind === "ring" && s.hole) {
        out.push(`  <ellipse cx="${px.x(s.hole.cx)}" cy="${px.y(s.hole.cy)}" rx="${px.s(s.hole.rx)}" ry="${px.s(s.hole.ry)}" fill="#dcebf5" stroke="#3a7ab8" stroke-width="1.2"/>`);
        out.push(`  <text x="${px.x(s.hole.cx)}" y="${px.y(s.hole.cy)}" class="lbl-sm" fill="#1f3a5f">jezírko</text>`);
      }
    }

    let woodyPts = [];
    if (isContainers) {
      plan.shapes.forEach((s, i) => {
        out.push(`  <text x="${px.x(s.cx)}" y="${px.y(s.cy) + 4}" class="lbl" font-weight="700">${i + 1}</text>`);
      });
      const court = garden.elements.find((e) => e.id === "westTerrace");
      const courtRect = court && court.parts.filter((p) => p.kind === "rect")[1];
      if (courtRect) out.push(`  <rect x="${px.x(courtRect.x)}" y="${px.y(courtRect.y)}" width="${px.s(courtRect.w)}" height="${px.s(courtRect.d)}" fill="none" stroke="#a87d4a" stroke-width="1" stroke-dasharray="5,3"/><text x="${px.x(courtRect.x + courtRect.w / 2)}" y="${px.y(courtRect.y + courtRect.d) + 14}" class="lbl-sm" fill="#5a4828">atrium (dlažba beze změn)</text>`);
    } else if (isMeadow) {
      const orchard = garden.elements.find((e) => e.id === "orchard");
      if (orchard) for (const c of orchard.parts.filter((p) => p.kind === "circle")) {
        out.push(`  <circle cx="${px.x(c.cx)}" cy="${px.y(c.cy)}" r="${px.s(0.5)}" fill="none" stroke="${WOODY_COLOR}" stroke-width="1.5"/><circle cx="${px.x(c.cx)}" cy="${px.y(c.cy)}" r="2" fill="${WOODY_COLOR}"/>`);
      }
      out.push(`  <text x="${px.x((bb[0] + bb[2]) / 2)}" y="${px.y((bb[1] + bb[3]) / 2)}" class="lbl">výsev luční směsi ${r1(plan.seedMix.rateKgPerM2 * 1000)} g/m² (${r2(plan.area * plan.seedMix.rateKgPerM2)} kg)</text>`);
    } else {
      woodyPts = placeWoody(plan, rnd);
      const dots = placeDots(plan, rnd, woodyPts);
      for (const d of dots.filter((q) => q.role === "skupinove")) out.push(`  <circle cx="${px.x(d.x)}" cy="${px.y(d.y)}" r="${Math.max(2.4, px.s(ROLE_R[d.role]))}" fill="${ROLE_COLOR[d.role]}" stroke="white" stroke-width="1"/>`);
      for (const d of dots.filter((q) => q.role === "pudopokryvne")) out.push(`  <circle cx="${px.x(d.x)}" cy="${px.y(d.y)}" r="${Math.max(1.8, px.s(ROLE_R[d.role]))}" fill="${ROLE_COLOR[d.role]}" stroke="white" stroke-width="1"/>`);
      for (const d of dots.filter((q) => q.role === "vtrousene")) out.push(`  <circle cx="${px.x(d.x)}" cy="${px.y(d.y)}" r="${Math.max(2, px.s(ROLE_R[d.role]))}" fill="${ROLE_COLOR[d.role]}" stroke="white" stroke-width="1"/>`);
      for (const d of dots.filter((q) => q.role === "kosterni")) out.push(`  <circle cx="${px.x(d.x)}" cy="${px.y(d.y)}" r="${Math.max(3.2, px.s(ROLE_R[d.role]))}" fill="${ROLE_COLOR[d.role]}" stroke="white" stroke-width="1.2"/>`);
      for (const w of woodyPts) {
        out.push(`  <circle cx="${px.x(w.x)}" cy="${px.y(w.y)}" r="${px.s(0.5)}" fill="white" fill-opacity="0.55" stroke="${WOODY_COLOR}" stroke-width="2"/><circle cx="${px.x(w.x)}" cy="${px.y(w.y)}" r="2.5" fill="${WOODY_COLOR}"/>`);
      }
    }
    // scale bar
    const sbY = oy + bh * scale + 18;
    out.push(`  <g transform="translate(${r2(ox)}, ${r2(Math.min(sbY, 748))})" font-size="10"><rect x="0" y="0" width="${px.s(0.5)}" height="6" fill="#2a2a2a"/><rect x="${px.s(0.5)}" y="0" width="${px.s(0.5)}" height="6" fill="white" stroke="#2a2a2a" stroke-width="0.8"/><text x="0" y="18" style="text-anchor:start">0</text><text x="${px.s(1)}" y="18" style="text-anchor:middle">1 m</text><text x="${px.s(1) + 30}" y="18" style="text-anchor:start;fill:#888">rastr 0.5 m (silněji 2 m dle layout.js)</text></g>`);

    // legend
    let ly = 110;
    const legendRoles = isContainers || isMeadow ? [] : ROLES.filter((r) => plan.species.some((sp) => sp.role === r && !sp.plug));
    const hasLegend = legendRoles.length || plan.woody.length || isMeadow || plan.species.some((sp) => sp.role === "cibulovina");
    if (hasLegend) out.push(`  <text x="700" y="${ly}" class="th" font-size="11">LEGENDA ROLÍ</text>`);
    ly += 8;
    for (const role of legendRoles) {
      ly += 20;
      const rr = { kosterni: 6.5, skupinove: 4.5, pudopokryvne: 3, vtrousene: 3.5 }[role];
      const n = plan.species.filter((sp) => sp.role === role && !sp.plug).reduce((a, sp) => a + sp.count, 0);
      out.push(`  <circle cx="710" cy="${ly - 4}" r="${rr}" fill="${ROLE_COLOR[role]}" stroke="white" stroke-width="1"/><text x="726" y="${ly}" class="td">${ROLE_LABEL[role]} — ${n} ks${role === "kosterni" ? " (velké tečky, řídce, střed/pozadí)" : role === "skupinove" ? " (drifty)" : role === "pudopokryvne" ? " (okraje)" : " (rozptýleně)"}</text>`);
    }
    if (plan.woody.length || isMeadow) {
      ly += 20;
      out.push(`  <circle cx="710" cy="${ly - 4}" r="7" fill="none" stroke="${WOODY_COLOR}" stroke-width="2"/><circle cx="710" cy="${ly - 4}" r="2" fill="${WOODY_COLOR}"/><text x="726" y="${ly}" class="td">${isMeadow ? "stávající ovocné stromy (kontext)" : "dřeviny / popínavky — " + plan.woody.reduce((a, w) => a + w.count, 0) + " ks"}</text>`);
    }
    if (plan.species.some((sp) => sp.role === "cibulovina")) {
      ly += 20;
      out.push(`  <text x="703" y="${ly}" class="td">◦ cibuloviny — jen v tabulce (${plan.species.filter((sp) => sp.role === "cibulovina").reduce((a, sp) => a + sp.count, 0)} ks, sázet mezi trvalky)</text>`);
    }

    // quantity table
    let ty = ly + 34;
    out.push(`  <text x="700" y="${ty}" class="th" font-size="11">VÝKAZ ROSTLIN</text>`);
    ty += 16;
    out.push(`  <text x="700" y="${ty}" class="th">druh</text><text x="916" y="${ty}" class="th">role</text><text x="1016" y="${ty}" class="th" text-anchor="end">ks</text><text x="1054" y="${ty}" class="th" text-anchor="end">ks/m²</text><text x="1090" y="${ty}" class="th" text-anchor="end">bal.</text>`);
    out.push(`  <line x1="700" y1="${ty + 4}" x2="1090" y2="${ty + 4}" stroke="#bbb" stroke-width="0.8"/>`);
    const denomArea = (plan.zoneDef.overrides || {}).perennialAreaM2 != null ? plan.zoneDef.overrides.perennialAreaM2 : plan.area;
    const tableRows = [];
    if (plan.seedMix) tableRows.push({ cz: plan.seedMix.name, lat: `výsev ${r1(plan.seedMix.rateKgPerM2 * 1000)} g/m²`, role: "výsev", count: `${r2(plan.area * plan.seedMix.rateKgPerM2)} kg`, perM2: "", pot: "osivo" });
    for (const sp of plan.species) tableRows.push({ cz: sp.cz, lat: sp.lat + (sp.container ? ` · ${sp.container}` : ""), role: ROLE_LABEL[sp.role] || sp.role, count: sp.count, perM2: ROLES.includes(sp.role) || sp.role === "cibulovina" ? r1(sp.count / denomArea) : "", pot: sp.potSize });
    for (const w of plan.woody) tableRows.push({ cz: w.cz, lat: w.lat, role: ROLE_LABEL[w.role], count: w.count, perM2: "", pot: w.potSize });
    for (const row of tableRows) {
      ty += 24;
      out.push(`  <text x="700" y="${ty}" class="td">${esc(row.cz)}</text><text x="700" y="${ty + 10}" class="td-lat">${esc(row.lat)}</text>`);
      out.push(`  <text x="916" y="${ty}" class="td" style="font-size:9px">${esc(row.role)}</text><text x="1016" y="${ty}" class="td" text-anchor="end">${esc(row.count)}</text><text x="1054" y="${ty}" class="td" text-anchor="end">${esc(row.perM2)}</text><text x="1090" y="${ty}" class="td" text-anchor="end">${esc(row.pot)}</text>`);
    }
    out.push(`  <text x="40" y="770" font-size="10" style="text-anchor:start;fill:#888">Hustota ${planting.densities.perennialsPerM2} trvalek/m², ${planting.densities.bulbsPerM2} cibulí/m² (Flera); role split ${Math.round(planting.roleSplit.kosterni * 100)}/${Math.round(planting.roleSplit.skupinove * 100)}/${Math.round(planting.roleSplit.pudopokryvne * 100)}/${Math.round(planting.roleSplit.vtrousene * 100)} % je konvence projektu. Rozmístění teček je algoritmické (seed ${hashStr(zoneId)}), ne osazovací plán 1:1. node generate-plansheets.js</text>`);
    out.push(`</svg>`);
    return out.join("\n") + "\n";
  }

  // ---- bloom calendar ------------------------------------------------------

  const SEQ = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
  const MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  function renderBloomCalendar(garden, planting) {
    const zoneIds = Object.keys(planting.zones);
    const rows = [];
    const allSpecies = [];
    for (const zoneId of zoneIds) {
      const plan = computeZonePlan(garden, planting, zoneId);
      const specs = plan.species.concat(plan.woody);
      if (plan.seedMix) specs.push({ cz: plan.seedMix.name, bloom: plan.seedMix.bloom, count: 1 });
      allSpecies.push(...specs);
      const counts = new Array(12).fill(0);
      for (const sp of specs) for (const m of sp.bloom || []) counts[m - 1]++;
      rows.push({ label: `${plan.el.short || plan.el.name} (${zoneId})`, counts });
    }
    const vmax = Math.max(...rows.map((r) => Math.max(...r.counts)));
    // winter-structure row: species flagged winter stand XI–III (cut down in March per care plan)
    // different metric than bloom → fixed green fill outside the sequential ramp
    const winterCounts = new Array(12).fill(0);
    const winterSpecies = allSpecies.filter((sp) => sp.winter);
    for (const m of [11, 12, 1, 2, 3]) winterCounts[m - 1] = winterSpecies.length;
    rows.push({ label: "zimní struktura (siluety + stálezelené)", counts: winterCounts, winter: true });
    const cw = 52, ch = 32, gap = 2, lx = 300, ty = 96;
    const W = lx + 12 * (cw + gap) + 40, H = ty + rows.length * (ch + gap) + 90;
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="-apple-system, BlinkMacSystemFont, sans-serif">`);
    out.push(`  <style>text { font-family: -apple-system, sans-serif; fill: #2a2a2a; } .title { font-size: 18px; font-weight: 700; } .subtitle { font-size: 11px; fill: #666; } .rl { font-size: 11px; } .mh { font-size: 11px; font-weight: 600; fill: #555; text-anchor: middle; } .cv { font-size: 10px; text-anchor: middle; }</style>`);
    out.push(`  <rect width="${W}" height="${H}" fill="white"/>`);
    out.push(`  <text x="${lx}" y="34" class="title">Kalendář kvetení po zónách</text>`);
    out.push(`  <text x="${lx}" y="54" class="subtitle">buňka = počet druhů v zóně kvetoucích v daném měsíci (cibuloviny, trvalky i dřeviny); měsíce kvetení jsou orientační</text>`);
    for (let m = 0; m < 12; m++) out.push(`  <text x="${lx + m * (cw + gap) + cw / 2}" y="${ty - 10}" class="mh">${MONTHS[m]}</text>`);
    rows.forEach((row, ri) => {
      const y = ty + ri * (ch + gap);
      out.push(`  <text x="${lx - 10}" y="${y + ch / 2 + 4}" class="rl" text-anchor="end">${esc(row.label)}</text>`);
      row.counts.forEach((v, m) => {
        const x = lx + m * (cw + gap);
        if (v === 0) {
          out.push(`  <rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="3" fill="#f0efec"/>`);
        } else if (row.winter) {
          out.push(`  <rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="3" fill="#4a6e3a"/><text x="${x + cw / 2}" y="${y + ch / 2 + 4}" class="cv" style="fill:#ffffff">${v}</text>`);
        } else {
          const idx = Math.min(SEQ.length - 1, Math.floor(((v - 1) / vmax) * SEQ.length));
          const fill = SEQ[idx];
          const ink = idx >= 3 ? "#ffffff" : "#0b0b0b";
          out.push(`  <rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="3" fill="${fill}"/><text x="${x + cw / 2}" y="${y + ch / 2 + 4}" class="cv" style="fill:${ink}">${v}</text>`);
        }
      });
    });
    const legY = ty + rows.length * (ch + gap) + 26;
    out.push(`  <text x="${lx}" y="${legY}" class="subtitle">počet kvetoucích druhů:  1</text>`);
    SEQ.forEach((c, i) => out.push(`  <rect x="${lx + 150 + i * 26}" y="${legY - 11}" width="24" height="14" rx="2" fill="${c}"/>`));
    out.push(`  <text x="${lx + 150 + SEQ.length * 26 + 6}" y="${legY}" class="subtitle">${vmax}</text>`);
    out.push(`  <rect x="${lx + 380}" y="${legY - 11}" width="24" height="14" rx="2" fill="#4a6e3a"/><text x="${lx + 410}" y="${legY}" class="subtitle">zimní struktura (jiná metrika než kvetení)</text>`);
    out.push(`  <text x="${lx}" y="${legY + 24}" class="subtitle">zimní struktura = počet druhů se zimní siluetou (traviny, semeníky) + stálezelených; stojí XI–III, kompletní sestřih v březnu.</text>`);
    out.push(`  <text x="${lx}" y="${legY + 40}" class="subtitle">Generováno: node generate-plansheets.js</text>`);
    out.push(`</svg>`);
    return out.join("\n") + "\n";
  }

  const api = { computeZonePlan, zoneGeometry, renderPlanSheet, renderBloomCalendar, shapeArea, shapePerimeter, mulberry32, hashStr };
  if (typeof module !== "undefined") module.exports = api;
  if (typeof window !== "undefined") Object.assign(window, api);
})();
