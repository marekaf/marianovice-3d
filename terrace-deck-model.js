// Twinson Terrace 9555 decks from the DEK laying plan: 140 × 28 mm boards along the long side of each
// deck, 50 mm aluminium joists at 500 mm, 80 mm build-up on concrete pavers. Board joints, row
// ripping and paver spacing are a layout preview, not the supplier's cut list.
const TerraceDeckModel = (() => {
  const BOARD = { width: .14, pitch: .146, thickness: .028, length: 4, buttGap: .004 };
  const JOIST = { width: .045, height: .05, spacing: .5, endInset: .025, minEndBay: .2 };
  const BUILD_UP = .08, FACADE_GAP = .012, PAD = .2, MAX_PAD_SPACING = .6;

  function deckRects(garden) {
    return ['eastTerrace', 'westDeck'].flatMap(id => (garden.elements.find(e => e.id === id)?.parts ?? [])
      .filter(p => p.kind === 'rect').map((p, i) => ({ id: `${id}_${i}`, x: p.x, y: p.y, w: p.w, d: p.d })));
  }

  function insidePolygon(points, x, z) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, zi] = points[i], [xj, zj] = points[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }

  // Sides of the deck that run along the house wall keep the ventilation gap to the facade.
  function facadeSides(rect, house) {
    const probe = .01, cx = rect.x + rect.w / 2, cz = rect.y + rect.d / 2;
    const touches = (x, z) => !!house && insidePolygon(house, x, z);
    return {
      x0: touches(rect.x - probe, cz), x1: touches(rect.x + rect.w + probe, cz),
      z0: touches(cx, rect.y - probe), z1: touches(cx, rect.y + rect.d + probe),
    };
  }

  function joistStations(length) {
    const inner = length - 2 * JOIST.endInset;
    const bays = Math.max(0, Math.floor((inner - 2 * JOIST.minEndBay) / JOIST.spacing));
    const first = JOIST.endInset + (inner - bays * JOIST.spacing) / 2;
    const stations = [JOIST.endInset, ...Array.from({ length: bays + 1 }, (_, i) => first + i * JOIST.spacing), length - JOIST.endInset];
    return stations.filter((s, i) => i === 0 || s - stations[i - 1] > .05);
  }

  // Joints land on joists; alternate rows take the previous joist so neighbouring joints stagger.
  function jointStations(start, end, joists, row) {
    const joints = [];
    let from = start;
    while (end - from > BOARD.length) {
      const reach = joists.filter(j => j > from + .5 && j <= from + BOARD.length);
      if (!reach.length) throw new Error('Joist spacing leaves a board run without a joint support');
      from = reach[Math.max(0, reach.length - 1 - row % 2)];
      joints.push(from);
    }
    return joints;
  }

  function build(garden, floorHeight, groundHeight, drain = null) {
    const house = garden.elements.find(e => e.id === 'house')?.parts.find(p => p.kind === 'polygon')?.points;
    const materials = {
      joist: { color: '#8d9296', roughness: .45, metalness: .6 },
      pad: { color: '#97958d', roughness: .95 },
    };
    // Twinson 522 reads #c4a68e on the maker's chart. The viewer's sky light and tone mapping wash out warm
    // tones, so the albedo is set warmer until the sunlit deck measures that colour on screen.
    ['#ebb181', '#efb585', '#e6ac7c', '#f0b889'].forEach((color, i) => {
      materials[`board_x_${i}`] = { color, roughness: .72, grain: 'x' };
      materials[`board_y_${i}`] = { color, roughness: .72, grain: 'y' };
    });
    const parts = [], decks = [];
    for (const rect of deckRects(garden)) {
      const alongZ = rect.d >= rect.w, sides = facadeSides(rect, house);
      // u runs along the boards, v across them; both are measured from the rect's min corner.
      const length = alongZ ? rect.d : rect.w, span = alongZ ? rect.w : rect.d;
      const [uGap0, uGap1, vGap0, vGap1] = (alongZ ? [sides.z0, sides.z1, sides.x0, sides.x1] : [sides.x0, sides.x1, sides.z0, sides.z1])
        .map(touch => touch ? FACADE_GAP : 0);
      const toPlan = (u0, u1, v0, v1) => alongZ
        ? { x: rect.x + v0, y: rect.y + u0, w: v1 - v0, d: u1 - u0 }
        : { x: rect.x + u0, y: rect.y + v0, w: u1 - u0, d: v1 - v0 };
      const joists = joistStations(length), boards = [];
      for (const [j, u] of joists.entries()) {
        const plan = toPlan(u - JOIST.width / 2, u + JOIST.width / 2, vGap0 + .01, span - vGap1 - .01);
        parts.push({ name: `${rect.id}_joist_${j}`, type: 'box', position: [plan.x + plan.w / 2, plan.y + plan.d / 2, -BOARD.thickness - JOIST.height / 2],
          size: [plan.w, plan.d, JOIST.height], material: 'joist', category: 'deck' });
        const pads = Math.max(1, Math.ceil((span - .2) / MAX_PAD_SPACING));
        for (let k = 0; k <= pads; k++) {
          const v = .1 + (span - .2) * k / pads, c = toPlan(u, u, v, v);
          const ground = [-PAD / 2, 0, PAD / 2].flatMap(dx => [-PAD / 2, 0, PAD / 2].map(dz => groundHeight(c.x + dx, c.y + dz) - floorHeight));
          const top = -BUILD_UP, bottom = Math.min(...ground) - .04;
          if (top - bottom <= .005) continue;
          parts.push({ name: `${rect.id}_pad_${j}_${k}`, type: 'box', position: [c.x, c.y, (top + bottom) / 2],
            size: [PAD, PAD, top - bottom], material: 'pad', category: 'deck', bevel: .002 });
        }
      }
      const rows = Math.ceil((span - vGap0 - vGap1) / BOARD.pitch - 1e-9);
      for (let row = 0; row < rows; row++) {
        const v0 = vGap0 + row * BOARD.pitch, v1 = Math.min(v0 + BOARD.width, span - vGap1);
        if (v1 - v0 < .005) continue;
        const start = uGap0, end = length - uGap1;
        const stations = [start, ...jointStations(start, end, joists, row), end];
        for (let p = 1; p < stations.length; p++) {
          const u0 = stations[p - 1] + (p > 1 ? BOARD.buttGap / 2 : 0), u1 = stations[p] - (p < stations.length - 1 ? BOARD.buttGap / 2 : 0);
          const board = toPlan(u0, u1, v0, v1);
          const pieces = drain ? PortalDrain().boardPieces(board, drain) : [board];
          for (const [i, piece] of pieces.entries()) {
            const name = `${rect.id}_board_${row}_${p - 1}${pieces.length > 1 ? `_${i}` : ''}`;
            parts.push({ name, type: 'box', position: [piece.x + piece.w / 2, piece.y + piece.d / 2, -BOARD.thickness / 2],
              size: [piece.w, piece.d, BOARD.thickness], material: `board_${alongZ ? 'y' : 'x'}_${row % 4}`, category: 'deck',
              bevel: Math.min(.002, Math.min(piece.w, piece.d) / 4) });
            boards.push(piece);
          }
        }
      }
      decks.push({ ...rect, alongZ, facadeSides: sides, joists, boards });
    }
    return { name: 'Twinson terrace decks', floorHeight, board: BOARD, joist: JOIST, buildUp: BUILD_UP, facadeGap: FACADE_GAP,
      decks, materials, parts, lights: [] };
  }

  function PortalDrain() {
    return typeof module !== 'undefined' ? require('./portal-drain-model.js').PortalDrainModel : PortalDrainModel;
  }

  return { build, deckRects, joistStations, jointStations };
})();
if (typeof module !== 'undefined') module.exports = { TerraceDeckModel };
