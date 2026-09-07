const PortalDrainModel = {
  build(garden, floorHeight, openings = []) {
    const terrace = garden.elements.find(e => e.id === 'eastTerrace').parts.find(p => p.kind === 'rect');
    const portal = openings.find(e => e.model.opening.sliding && e.match.axis === 'x' && Math.abs(e.match.wall - terrace.x) < .6);
    const width = portal?.model.opening.width ?? 5.16;
    const center = portal?.match.center ?? 16.78;
    const facadeGap = .012;
    const footprint = { x: terrace.x + facadeGap, y: center - width / 2, w: .1, d: width };
    const parts = [];
    const box = (name, x, z, y, w, d, h, material) => parts.push({
      name: `portal_drain_${name}`, type: 'box', position: [x, z, y], size: [w, d, h], material, category: 'drainage',
    });
    const x = footprint.x, z = footprint.y, w = footprint.w, d = footprint.d;
    box('channel_base', x + w / 2, z + d / 2, -.066, w, d, .004, 'channel');
    for (const side of [0, 1]) {
      box(`wall_${side}`, x + .003 + side * (w - .006), z + d / 2, -.032, .006, d, .064, 'channel');
      box(`rim_${side}`, x + .004 + side * (w - .008), z + d / 2, -.004, .008, d, .008, 'grate');
      box(`end_${side}`, x + w / 2, z + .003 + side * (d - .006), -.032, w - .012, .006, .064, 'channel');
    }
    const count = Math.ceil((d - .016) / .02), pitch = (d - .016) / count;
    for (let i = 0; i < count; i++) {
      box(`grate_${i}`, x + w / 2, z + .008 + (i + .5) * pitch, -.004, w - .012, pitch * .55, .008, 'grate');
    }
    return { name: 'East portal drainage proposal', floorHeight, status: 'visual proposal', facadeGap, footprint,
      materials: { channel: { color: '#303537', roughness: .65, metalness: .25 },
        grate: { color: '#707779', roughness: .4, metalness: .65 } }, parts, lights: [] };
  },
  boardPieces(board, model) {
    const f = model.footprint;
    const cuts = [board.y, f.y, f.y + f.d, board.y + board.d]
      .filter(z => z >= board.y && z <= board.y + board.d).sort((a, b) => a - b);
    return cuts.slice(1).flatMap((end, i) => {
      const start = cuts[i];
      if (end - start < .0001) return [];
      const besideDrain = start < f.y + f.d && end > f.y;
      const x = besideDrain ? f.x + f.w + .004 : board.x + model.facadeGap;
      return [{ x, y: start, w: board.x + board.w - x, d: end - start }];
    });
  },
};
if (typeof module !== 'undefined') module.exports = { PortalDrainModel };
