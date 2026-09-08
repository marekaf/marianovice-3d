const PrivacyScreenModel = (() => {
  function build({ name, start, end, side, category, bottom = 0.08, top = 2.1 }) {
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const ux = (end[0] - start[0]) / length, uy = (end[1] - start[1]) / length;
    const grain = Math.abs(ux) >= Math.abs(uy) ? 'x' : 'y';
    const parts = [];
    const faces = [[0,3,2,1], [4,5,6,7], [0,1,5,4], [1,2,6,5], [2,3,7,6], [3,0,4,7]];
    function prism(id, center, size, material, angle = 0) {
      const vertices = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
        [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c]) => {
        const tangent = center[0] + a * size[0] / 2;
        const normal = center[1] + b * size[1] / 2 * Math.cos(angle) - c * size[2] / 2 * Math.sin(angle);
        const height = center[2] + b * size[1] / 2 * Math.sin(angle) + c * size[2] / 2 * Math.cos(angle);
        return [start[0] + tangent * ux - normal * uy, start[1] + tangent * uy + normal * ux, height];
      });
      parts.push({ name: `${name}_${id}`, type: 'mesh', vertices, faces, material, category });
    }
    const bays = Math.ceil(length / 1.45);
    for (let i = 0; i <= bays; i++) {
      prism(`stile_${i}`, [i * length / bays, 0.065, (top + bottom) / 2], [0.045, 0.04, top - bottom], 'privacy_frame');
      for (const [index, height] of [bottom + 0.14, top - 0.14].entries())
        prism(`bracket_${i}_${index}`, [i * length / bays, 0.04, height], [0.065, 0.095, 0.025], 'privacy_frame');
    }
    for (const [index, height] of [bottom + 0.02, top - 0.02].entries())
      prism(`rail_${index}`, [length / 2, 0.04, height], [length, 0.07, 0.04], 'privacy_frame');
    const angle = -Math.PI * 35 / 180, bladeHeight = 0.145, thickness = 0.025;
    const projectedHeight = bladeHeight * Math.cos(angle) + thickness * Math.abs(Math.sin(angle));
    const count = Math.ceil((top - bottom - projectedHeight) / 0.095) + 1;
    const pitch = (top - bottom - projectedHeight) / (count - 1);
    // Projected overlap closes level sightlines; the angle leaves ventilation between blades.
    for (let i = 0; i < count; i++) {
      for (let bay = 0; bay < bays; bay++)
        prism(`slat_${i}_${bay}`, [(bay + 0.5) * length / bays, 0, bottom + projectedHeight / 2 + i * pitch],
          [length / bays - 0.012, thickness, bladeHeight], `privacy_timber_${grain}_${(i + bay) % 3}`, angle);
    }
    return { parts, screen: { name, start, end, side, bottom, top }, materials: {
      privacy_frame: { color: '#33343a', roughness: 0.55, metalness: 0.4 },
      [`privacy_timber_${grain}_0`]: { color: '#947454', roughness: 0.8, grain },
      [`privacy_timber_${grain}_1`]: { color: '#9b7b59', roughness: 0.8, grain },
      [`privacy_timber_${grain}_2`]: { color: '#907052', roughness: 0.8, grain },
    } };
  }
  return { build };
})();
if (typeof module !== 'undefined') module.exports = { PrivacyScreenModel };
