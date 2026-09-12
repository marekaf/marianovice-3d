import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js');
const {GradingZones}=require('./grading-zones.js');
const {GradingOverlay}=require('./grading-overlay.js');
const {renderPlanSVG}=require('./plan.js');
const svg=renderPlanSVG(GARDEN),data=GradingZones.create(GARDEN);
assert.equal(readFileSync(new URL('./zahrada-plan.svg',import.meta.url),'utf8'),svg,'Published SVG matches the shared editor renderer');
for(const bank of GARDEN.gradingBanks){
  assert(svg.includes(`data-terrain-bank="${bank.id}"`),'Fence banks have visible hatching');
  assert(svg.includes(`data-terrain-downhill="${bank.id}"`),'Fence banks have downhill arrows');
}
for(const [,label] of GradingOverlay.terrainLegend)assert(svg.includes(label),'Terrain symbols have a Czech legend');
assert(svg.includes('data-terrain-flat='));
assert.equal(svg.includes('data-terrain-preserve='),data.fenceSegments.length>0,'Preservation marks require measured fence data');
for(const dimension of data.dimensions.filter(d=>d.from&&d.to))assert(svg.includes(`<title>${dimension.name}: ${dimension.value}</title>`),'Dimension is drawn on the map, not only listed');
for(const id of ['saunaDepth','pergolaDepth']){
  const dimension=data.dimensions.find(d=>d.id===id);
  assert(dimension&&svg.includes(`<title>${dimension.name}: ${dimension.value}</title>`));
  assert(!new RegExp(`<text[^>]*>${dimension.name}</text>`).test(svg),'Depth dimension does not duplicate the footprint table row');
}
assert(!svg.includes('Koncepční návrh;'));
assert(!/NaN|undefined/.test(svg));
console.log('Static plan: shared dimensions, bank hatching, downhill arrows and qualified terrain legend pass');
