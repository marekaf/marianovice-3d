// Terrain datum + base grading plane — shared by the 3D viewer (index.html) and the 2D plans.
// Coordinates in meters, x → east, z (= y in plan) → south. Heights are internal model units;
// the house finished floor (±0.000) sits at houseFFLInternal and equals bpvDatum in Bpv.
const TERRAIN = {
  houseFFLInternal: 2.465, // internal height of the house finished floor = ±0.000
  bpvDatum: 397.00,        // Bpv elevation of ±0.000 (DPS koordinační situace C.3)
  // Natural grade before cuts: SW→NE fall of ~7.9% (high SW corner, low toward the NE road/gate). Cut pads/decks layer on top.
  plane: { a: -0.06451, b: 0.04531, c: 2.748 },
  basePlaneHeight(x, z) { return Math.max(0, this.plane.a * x + this.plane.b * z + this.plane.c); },
  relToHouse(internal) { return internal - this.houseFFLInternal; },   // meters relative to ±0.000
  bpv(internal) { return this.bpvDatum + (internal - this.houseFFLInternal); },
};
if (typeof module !== "undefined") module.exports = { TERRAIN };
