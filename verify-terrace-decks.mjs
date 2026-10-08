import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { GARDEN } = require('./layout.js');
const { TerraceDeckModel } = require('./terrace-deck-model.js');
const { PortalDrainModel } = require('./portal-drain-model.js');

const near = (a, b, tolerance = 1e-9) => Math.abs(a - b) < tolerance;
const rects = id => GARDEN.elements.find(e => e.id === id).parts.filter(p => p.kind === 'rect');
const sizes = [...rects('eastTerrace'), ...rects('westDeck')].map(r => [Math.max(r.w, r.d), Math.min(r.w, r.d)]);
assert.deepEqual(sizes, [[7.65, 3], [8.75, 1], [7.25, 1], [3.25, 1.6]], 'Decks follow the DEK laying plan of 2026-10-07');
assert.ok(near(sizes.reduce((sum, [a, b]) => sum + a * b, 0), 44.15), 'Laying plan area is 44.15 m²');

const area = r => r.w * r.d, overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y));
const outline = rects('westTerrace'), paving = GARDEN.elements.find(e => e.id === 'westTerrace').meta.paving, west = rects('westDeck');
const tiles = [...west, ...paving];
for (const tile of tiles) assert.ok(near(outline.reduce((sum, r) => sum + overlap(r, tile), 0), area(tile)), 'Deck and paving stay inside the west outline');
for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) assert.ok(overlap(tiles[i], tiles[j]) < 1e-9, 'Deck and paving do not overlap');
assert.ok(near(tiles.reduce((sum, r) => sum + area(r), 0), outline.reduce((sum, r) => sum + area(r), 0)), 'Deck and paving fill the west outline');
const atrium = west.find(r => near(r.w, 1.6));
assert.ok(near(atrium.x + atrium.w, 14.93), 'Atrium deck sits against the portal wall');
const east = rects('eastTerrace')[0];
assert.ok(near(east.y, 11.58) && near(east.y + east.d, 19.23), 'East deck keeps the recess corner and ends 17 cm short of the old line');

const floor = 2.465, drain = PortalDrainModel.build(GARDEN, floor);
const model = TerraceDeckModel.build(GARDEN, floor, () => floor - .2, drain);
assert.deepEqual(model.decks.map(d => d.id), ['eastTerrace_0', 'westDeck_0', 'westDeck_1', 'westDeck_2']);
assert.deepEqual(model.decks.map(d => Object.entries(d.facadeSides).filter(([, v]) => v).map(([k]) => k).join()), ['x0', 'x1', 'x1', 'x1,z0,z1'], 'Facade gaps only where a deck meets the house');
for (const deck of model.decks) {
  assert.ok(deck.alongZ, `${deck.id}: boards run along the long side`);
  const gaps = deck.joists.slice(1).map((j, i) => j - deck.joists[i]);
  assert.ok(gaps.every(g => g <= .5 + 1e-9), `${deck.id}: joists at most 500 mm apart`);
  assert.ok(deck.joists[0] === .025 && near(deck.joists.at(-1), deck.d - .025), `${deck.id}: end joists 25 mm in`);
  for (const board of deck.boards) {
    assert.ok(board.d <= 4 + 1e-9, `${deck.id}: board pieces fit a 4 m board`);
    assert.ok(board.w <= .14 + 1e-9, `${deck.id}: 140 mm board width`);
    for (const end of [board.y, board.y + board.d]) {
      const local = end - deck.y, edge = local < .02 || local > deck.d - .02;
      const drainCut = [drain.footprint.y, drain.footprint.y + drain.footprint.d].some(z => near(z, end));
      assert.ok(edge || drainCut || deck.joists.some(j => Math.abs(j - local) <= .0021), `${deck.id}: board joints land on a joist`);
    }
    if (deck.facadeSides.x0) assert.ok(board.x >= deck.x + .012 - 1e-9, `${deck.id}: facade gap`);
    if (deck.facadeSides.x1) assert.ok(board.x + board.w <= deck.x + deck.w - .012 + 1e-9, `${deck.id}: facade gap`);
    if (deck.facadeSides.z0) assert.ok(board.y >= deck.y + .012 - 1e-9, `${deck.id}: facade gap`);
    if (deck.facadeSides.z1) assert.ok(board.y + board.d <= deck.y + deck.d - .012 + 1e-9, `${deck.id}: facade gap`);
  }
}
for (const part of model.parts) {
  assert.ok(model.materials[part.material], part.name);
  assert.ok([...part.position, ...part.size].every(Number.isFinite) && part.size.every(v => v > 0), part.name);
  const top = part.position[2] + part.size[2] / 2;
  if (part.name.includes('_board_')) assert.ok(near(top, 0) && near(part.size[2], .028), `${part.name}: 28 mm board finishes at floor level`);
  if (part.name.includes('_joist_')) assert.ok(near(top, -.028) && near(part.size[2], .05), `${part.name}: 50 mm joist under the board`);
  if (part.name.includes('_pad_')) assert.ok(near(top, -.08), `${part.name}: 80 mm build-up`);
}
assert.equal(new Set(model.parts.map(p => p.name)).size, model.parts.length);
console.log(`Terrace decks: ${model.decks.length} Twinson decks, ${model.decks.reduce((n, d) => n + d.boards.length, 0)} board pieces on joists; west outline tiled by deck and paving`);
