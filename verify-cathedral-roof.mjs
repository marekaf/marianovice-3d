import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cathedralGeometry} from './docs/cathedral-interior.js';
const require=createRequire(import.meta.url);
const {HOUSE_INTERIOR}=require('./house-interior.js');
const {HouseRoof}=require('./house-roof.js');
const roof=HouseRoof.describe({bbox:[0,0,10.8,19.25],atrium:[0,8.75,4.45,12],gable:[3.2,10.8]});
const lining=cathedralGeometry(HOUSE_INTERIOR);
assert.equal(lining.ridgeX,roof.ridgeX,'Cathedral and exterior roof share their horizontal ridge position');
for(const x of [lining.x0,lining.ridgeX,lining.x1]) {
  const roofHeight=(x<roof.ridgeX?roof.mainWest:roof.mainEast).heightAt(x);
  const liningHeight=lining.ridgeY-Math.abs(x-lining.ridgeX);
  assert(Math.abs((roofHeight-liningHeight)/Math.SQRT2-.292)<1e-9,
    'ST03 lining retains 292 mm normal build-up on both slopes');
}
assert.equal(lining.baseY,HOUSE_INTERIOR.clearH);
console.log('Cathedral roof: shared ridge axis, 292 mm ST03 build-up, unchanged room footprint');
