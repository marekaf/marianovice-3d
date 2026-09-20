const GradingNotation = (() => {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const number = value => Number(value.toFixed(4));

  function spans(points, u) {
    const crossings = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[0] <= u && b[0] > u) || (b[0] <= u && a[0] > u)) crossings.push(a[1] + (u - a[0]) / (b[0] - a[0]) * (b[1] - a[1]));
    }
    crossings.sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i + 1 < crossings.length; i += 2) result.push([crossings[i], crossings[i + 1]]);
    return result;
  }

  function bankHachures({ garden, site, px, pz, scale }) {
    if (!(scale > 0)) throw new Error('Bank hachures require a positive drawing scale');
    const painted = [];
    return (garden.gradingBanks ?? []).map((bank, index) => {
      const points = bank.points;
      if (!points || points.length < 3 || points.some(p => !p.every(Number.isFinite))) return '';
      const centre = [0, 1].map(axis => points.reduce((sum, p) => sum + p[axis], 0) / points.length);
      const step = 0.05;
      let direction = bank.spotCrest && bank.spotFoot
        ? bank.spotFoot.map((value, axis) => value - bank.spotCrest[axis])
        : [site.height(centre[0] - step, centre[1]) - site.height(centre[0] + step, centre[1]), site.height(centre[0], centre[1] - step) - site.height(centre[0], centre[1] + step)];
      const magnitude = Math.hypot(...direction);
      if (!Number.isFinite(magnitude) || magnitude < 1e-8) return '';
      direction = direction.map(value => value / magnitude);
      const along = [-direction[1], direction[0]];
      const transformed = points.map(p => [dot(p, along), dot(p, direction)]);
      const exclusions = painted.map(polygon => polygon.map(p => [dot(p, along), dot(p, direction)]));
      const minimum = Math.min(...transformed.map(p => p[0])), maximum = Math.max(...transformed.map(p => p[0]));
      const count = Math.floor((maximum - minimum) * scale / 7);
      if (count < 1) return '';
      const toWorld = (u, v) => [along[0] * u + direction[0] * v, along[1] * u + direction[1] * v];
      const strokes = [];
      for (let i = 0; i < count; i++) {
        const u = minimum + (i + 0.5) * (maximum - minimum) / count;
        for (const [start, finish] of spans(transformed, u)) {
          let crest = toWorld(u, start), foot = toWorld(u, finish);
          const high = site.height(...crest), low = site.height(...foot);
          if (![high, low].every(Number.isFinite) || Math.abs(high - low) < 0.005) continue;
          if (high < low) [crest, foot] = [foot, crest];
          const fraction = i % 2 ? 0.43 : 0.9;
          const crestV = dot(crest, direction), endV = crestV + (dot(foot, direction) - crestV) * fraction;
          let pieces = [[Math.min(crestV, endV), Math.max(crestV, endV)]];
          for (const exclusion of exclusions) for (const [lo, hi] of spans(exclusion, u)) {
            pieces = pieces.flatMap(([a, b]) => b <= lo || a >= hi ? [[a, b]] : [...(a < lo ? [[a, lo]] : []), ...(b > hi ? [[hi, b]] : [])]);
          }
          for (const [a, b] of pieces) {
            if ((b - a) * scale < 0.5) continue;
            const from = toWorld(u, crestV < endV ? a : b), to = toWorld(u, crestV < endV ? b : a);
            strokes.push(`<line x1="${number(px(from[0]))}" y1="${number(pz(from[1]))}" x2="${number(px(to[0]))}" y2="${number(pz(to[1]))}"/>`);
          }
        }
      }
      if (!strokes.length) return '';
      painted.push(points);
      const id = `grading-bank-${index}`, name = String(bank.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const polygon = points.map(p => `${number(px(p[0]))},${number(pz(p[1]))}`).join(' ');
      return `<g data-bank-hachure="${name}"><defs><clipPath id="${id}"><polygon points="${polygon}"/></clipPath></defs><g clip-path="url(#${id})" stroke="#675344" stroke-width="0.65" stroke-linecap="butt" fill="none">${strokes.join('')}</g></g>`;
    }).join('');
  }

  return { bankHachures };
})();
if (typeof module !== 'undefined') module.exports = { GradingNotation };
