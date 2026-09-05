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
const { FirepitModel } = require("./firepit-model.js");
const { HiddenBenchModel } = require("./hidden-bench-model.js");
const { SiteTerrain } = require("./site-terrain.js");

const pergolaModel = PergolaModel.build(GARDEN);
const garageModel = GarageModel.build(GARDEN, TERRAIN.houseFFLInternal - 0.5);
const greenhouseModel = GreenhouseModel.build(GARDEN, TERRAIN.plane);
const raisedBedsModel = RaisedBedsModel.build(GARDEN);
const siteTerrain = SiteTerrain.create(GARDEN, TERRAIN.plane, { garage: garageModel.groundPatch,
  pergola: pergolaModel.groundPatch, greenhouse: greenhouseModel.groundPatch, raisedBeds: raisedBedsModel.groundPatch });

const out = path.join(__dirname, "blender", "garden.json");
fs.writeFileSync(out, JSON.stringify({
  ...GARDEN,
  saunaModel: SaunaModel.build(GARDEN, TERRAIN.plane),
  pergolaModel,
  garageModel,
  fixtureModels: Object.fromEntries(FIXTURE_SAMPLES.map(sample => [sample.id, FurnitureModel.build(sample.furniture)])),
  greenhouseModel,
  raisedBedsModel,
  firepitModel: FirepitModel.build(GARDEN, TERRAIN.plane),
  hiddenBenchModel: HiddenBenchModel.build(GARDEN, TERRAIN.plane, GarageModel.groundPatch(GARDEN, TERRAIN.houseFFLInternal - 0.5)),
  siteTerrain: siteTerrain.spec,
  terrain: { ...TERRAIN.plane, houseFFLInternal: TERRAIN.houseFFLInternal, bpvDatum: TERRAIN.bpvDatum },
}, null, 1));
console.log("wrote " + out);
