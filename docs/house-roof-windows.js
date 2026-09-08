const RoofWindows = (() => {
  const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]];

  function build({ gable, ridgeY, eaveY, eaveOverhang = 0.45, windows = [
    { side: 'e', z: 24.76, width: 0.66, height: 1.4 },
    { side: 'e', z: 20.78, width: 0.78, height: 1.4 },
    { side: 'w', z: 20.78, width: 0.78, height: 1.4 },
  ] }) {
    const parts = [], cutouts = [];
    const materials = {
      roofWindowFlashing: { color: '#383e42', roughness: 0.48, metalness: 0.55 },
      roofWindowCladding: { color: '#454a4d', roughness: 0.4, metalness: 0.48 },
      roofWindowGasket: { color: '#161b1c', roughness: 0.86 },
      roofWindowPine: { color: '#c9ae83', roughness: 0.55, grain: 'x' },
      roofWindowGlass: { color: '#e3ece9', roughness: 0.08, transmission: 0.94 },
      roofWindowHardware: { color: '#959b9c', roughness: 0.35, metalness: 0.78 },
    };
    const ridgeX = (gable[0] + gable[1]) / 2;
    const run = (gable[1] - gable[0]) / 2 + eaveOverhang;
    const rise = ridgeY - eaveY, slopeLength = Math.hypot(run, rise);
    const cos = run / slopeLength, sin = rise / slopeLength;

    windows.forEach(({ side, z, width, height = 1.4 }, index) => {
      if (!['e', 'w'].includes(side) || !Number.isFinite(z) || width <= 0.2 || height <= 0.4) throw new Error('Invalid roof window dimensions');
      const sign = side === 'e' ? 1 : -1;
      const center = [ridgeX + sign * run * 0.45, z, ridgeY - rise * 0.45];
      const slopeAxis = [cos, 0, -sign * sin], normal = [sign * sin, 0, cos];
      const point = (u, v, n) => [center[0] + u * cos + n * sign * sin, z + v, center[2] - u * sign * sin + n * cos];
      const prism = (name, u0, u1, v0, v1, n0, n1, material) => parts.push({
        name: `roof_window_${index}_${name}`, type: 'mesh', category: 'roofWindows', material,
        vertices: [[u0, v0, n0], [u1, v0, n0], [u1, v1, n0], [u0, v1, n0],
          [u0, v0, n1], [u1, v0, n1], [u1, v1, n1], [u0, v1, n1]].map(p => point(...p)),
        faces,
      });
      const ring = (name, h, w, rail, n0, n1, material) => {
        prism(`${name}_slope_low`, -h / 2, -h / 2 + rail, -w / 2, w / 2, n0, n1, material);
        prism(`${name}_slope_high`, h / 2 - rail, h / 2, -w / 2, w / 2, n0, n1, material);
        prism(`${name}_north`, -h / 2 + rail, h / 2 - rail, -w / 2, -w / 2 + rail, n0, n1, material);
        prism(`${name}_south`, -h / 2 + rail, h / 2 - rail, w / 2 - rail, w / 2, n0, n1, material);
      };
      const h = height / 2, w = width / 2;
      ring('timber_frame', height, width, 0.045, -0.14, 0.025, 'roofWindowPine');
      ring('weather_seal', height - 0.084, width - 0.084, 0.009, 0.026, 0.041, 'roofWindowGasket');
      ring('timber_sash', height - 0.106, width - 0.106, 0.042, -0.045, 0.045, 'roofWindowPine');
      ring('frame_cap', height, width, 0.037, 0.025, 0.073, 'roofWindowCladding');
      ring('sash_cap', height - 0.108, width - 0.108, 0.027, 0.046, 0.082, 'roofWindowCladding');
      ring('glass_seal', height - 0.159, width - 0.159, 0.012, 0.044, 0.065, 'roofWindowGasket');
      prism('triple_glazing', -h + 0.09, h - 0.09, -w + 0.09, w - 0.09, 0.03, 0.058, 'roofWindowGlass');

      prism('north_flashing', -h - 0.13, h + 0.13, -w - 0.12, -w, 0.008, 0.013, 'roofWindowFlashing');
      prism('south_flashing', -h - 0.13, h + 0.13, w, w + 0.12, 0.008, 0.013, 'roofWindowFlashing');
      for (const direction of [-1, 1]) {
        const start = direction < 0 ? -h - 0.18 : h;
        const end = direction < 0 ? -h : h + 0.18;
        prism(direction === sign ? 'apron' : 'head_flashing', start, end, -w - 0.12, w + 0.12, 0.014, 0.019, 'roofWindowFlashing');
        const edge = direction * (w + 0.075);
        prism(`drainage_fold_${direction}`, -h - 0.12, h + 0.12, edge - 0.005, edge + 0.005, 0.013, 0.03, 'roofWindowFlashing');
        const pivot = direction * (w - 0.045);
        prism(`center_pivot_${direction}`, -0.027, 0.027, pivot - 0.012, pivot + 0.012, -0.01, 0.036, 'roofWindowHardware');
      }
      const controlU = -sign * (h - 0.12);
      prism('top_control_bar', controlU - 0.023, controlU + 0.023, -w + 0.11, w - 0.11, -0.075, -0.053, 'roofWindowHardware');
      prism('vent_slot', controlU - 0.036, controlU + 0.036, -w + 0.09, w - 0.09, -0.049, -0.046, 'roofWindowGasket');
      cutouts.push({ side, center, normal, slopeAxis, width, height,
        x0: center[0] - h * cos, x1: center[0] + h * cos, z0: z - w, z1: z + w,
        corners: [point(-h, -w, 0), point(h, -w, 0), point(h, w, 0), point(-h, w, 0)],
      });
    });
    return { name: 'house_roof_windows', floorHeight: 0, parts, materials, lights: [], cutouts,
      notes: [
        'Ordered clear-lacquer centre-pivot windows: two 780 x 1400 mm and one 660 x 1400 mm; anthracite flashing.',
        'Frame sections, glazing sightlines, hardware and flashing folds are visual approximations, not manufacturer installation dimensions.',
        'Existing roof positions are preserved; remove roof surfaces and standing seams inside each cutout before rendering glazing.',
      ],
    };
  }
  return { build };
})();

if (typeof window !== 'undefined') window.RoofWindows = RoofWindows;
if (typeof module !== 'undefined') module.exports = RoofWindows;
