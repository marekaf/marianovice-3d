// Writes blender/garden.json — the scene data blender/poc.py builds from. The terrain plane ships
// with it so the Blender scene reads the same grading as terrain.js instead of its own copy.
// Regenerate with: node generate-blender-json.js
const fs = require("fs");
const path = require("path");
const { GARDEN } = require("./layout.js");
const { TERRAIN } = require("./terrain.js");
const { SaunaModel } = require("./sauna-model.js");
const { PergolaModel } = require("./pergola-model.js");
const { GarageModel } = require("./garage-model.js");
const { FurnitureModel } = require("./furniture-model.js");
const { FIXTURE_SAMPLES } = require("./fixture-samples.js");
const { GreenhouseModel } = require("./greenhouse-model.js");
const { RaisedBedsModel } = require("./raised-beds-model.js");

const out = path.join(__dirname, "blender", "garden.json");
fs.writeFileSync(out, JSON.stringify({
  ...GARDEN,
  saunaModel: SaunaModel.build(GARDEN, TERRAIN.plane),
  pergolaModel: PergolaModel.build(GARDEN),
  garageModel: GarageModel.build(GARDEN, TERRAIN.houseFFLInternal - 0.5),
  fixtureModels: Object.fromEntries(FIXTURE_SAMPLES.map(sample => [sample.id, FurnitureModel.build(sample.furniture)])),
  greenhouseModel: GreenhouseModel.build(GARDEN, TERRAIN.plane),
  raisedBedsModel: RaisedBedsModel.build(GARDEN),
  terrain: { ...TERRAIN.plane, houseFFLInternal: TERRAIN.houseFFLInternal, bpvDatum: TERRAIN.bpvDatum },
}, null, 1));
console.log("wrote " + out);
