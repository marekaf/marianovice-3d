const FIXTURE_SAMPLES = [
  { id: 'cabinets', label: 'Cabinets and open shelving', furniture: [
    { kind: 'cab', x0: 0, z0: 0, x1: 2.4, z1: 0.6, h: 0.9, front: 'S', modules: [0.6, 0.6, 0.6, 0.6],
      tags: ['d', 'a', 'o', 'd'], plinth: 0.1, worktop: 0.035 },
  ] },
  { id: 'island', label: 'Two-sided island', furniture: [
    { kind: 'cab', x0: 0, z0: 0, x1: 1.8, z1: 0.9, h: 0.9, front: ['N', 'S'], modules: [0.6, 0.6, 0.6],
      tags: ['d', 'o', 'd'], plinth: 0.1, worktop: 0.03, fmat: 'green', wmat: 'stone' },
  ] },
  { id: 'bath', label: 'Bath', furniture: [
    { kind: 'fix', type: 'bath', x0: 0, z0: 0, x1: 0.8, z1: 1.7, h: 0.6 },
  ] },
  { id: 'basin', label: 'Wall-hung basin', furniture: [
    { kind: 'fix', type: 'basin', x0: 0, z0: 0, x1: 0.65, z1: 0.48, y0: 0.68, h: 0.22 },
  ] },
  { id: 'wc', label: 'Toilet', furniture: [
    { kind: 'fix', type: 'wc', x0: 0, z0: 0, x1: 0.4, z1: 0.65, h: 0.45 },
  ] },
  { id: 'bed', label: 'Bed and bedding', furniture: [
    { kind: 'bed', x0: 0, z0: 0, x1: 1.8, z1: 2, h: 0.62 },
  ] },
  { id: 'glass', label: 'Shower screen', furniture: [
    { kind: 'glass', x0: 0, z0: 0, x1: 0.012, z1: 1.2, h: 2 },
  ] },
];
if (typeof module !== 'undefined') module.exports = { FIXTURE_SAMPLES };
