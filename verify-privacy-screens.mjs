import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
assert.ok(!GARDEN.elements.some(element => element.id === 'screenNorth'), 'Firepit seating stays open without a paravan');
const { SaunaModel } = require('./sauna-model.js');
const { PergolaModel } = require('./pergola-model.js');
const sauna = SaunaModel.build(GARDEN, 2.51);
const pergola = PergolaModel.build(GARDEN);
for (const [model, count] of [[sauna, 2], [pergola, 1]]) {
  assert.equal(model.privacyScreens?.length, count, `${model.name}: neighbour-facing screens required`);
  for (const screen of model.privacyScreens) {
    assert.ok(screen.top >= 2 && screen.bottom <= 0.1);
    const slats = model.parts.filter(p => p.name.startsWith(screen.name + '_slat_'));
    assert.ok(slats.length >= 20, 'Privacy screens need continuous seated-height coverage');
    const covering = [...slats, ...model.parts.filter(p => p.name === screen.name + '_backing')];
    const bands = covering.map(p => p.vertices ? [Math.min(...p.vertices.map(v => v[2])), Math.max(...p.vertices.map(v => v[2]))]
      : [p.position[2]-p.size[2]/2,p.position[2]+p.size[2]/2]);
    for (let h = 0.9; h <= 1.8; h += 0.005)
      assert.ok(bands.some(([lo, hi]) => h >= lo && h <= hi), `${screen.name}: direct sight gap at ${h}`);
    for (const part of model.parts.filter(p => p.name.startsWith(screen.name))) {
      assert.ok(!/\.[0-9]{10,}$/.test(part.name), 'Blender numeric name suffix must fit its integer parser');
      assert.ok(model.materials[part.material]);
      assert.ok([...part.vertices?.flat() || [], ...part.position || [], ...part.size || []].every(Number.isFinite));
    }
  }
}
assert.deepEqual(sauna.privacyScreens.map(s => s.side), ['north', 'west']);
for (const screen of sauna.privacyScreens) for (const face of ['inner', 'outer']) {
  const boards = sauna.parts.filter(p => p.name.startsWith(`${screen.name}_slat_${face}_`));
  assert.equal(boards.length, 24, 'Both bay wall faces have horizontal boards');
  assert.ok(boards.every(p => !sauna.materials[p.material].grain), 'Large bay wall faces avoid heavy procedural grain');
}
assert.deepEqual(pergola.privacyScreens.map(s => s.side), ['north']);
console.log('Privacy: three screens; continuous coverage at seated/bathing heights; garden-facing access open');
