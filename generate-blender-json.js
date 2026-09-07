// Writes blender/garden.json — the scene data blender/poc.py builds from. The terrain plane ships
// with it so the Blender scene reads the same grading as terrain.js instead of its own copy.
// Regenerate with: node generate-blender-json.js
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
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
const { SurveySurface } = require("./survey-surface.js");
const VehicleModel = require("./vehicle-model.js");
const { ExteriorFurnitureModel } = require("./exterior-furniture-model.js");

const surveyPath = path.join(__dirname, "docs", "survey-terrain.js");
const surveySurface = fs.existsSync(surveyPath)
  ? SurveySurface.create(require(surveyPath).SURVEY_TERRAIN.points, TERRAIN.plane)
  : null;
const existingGround = surveySurface ? surveySurface.height : TERRAIN.basePlaneHeight.bind(TERRAIN);

const pergolaModel = PergolaModel.build(GARDEN);
const garageModel = GarageModel.build(GARDEN, TERRAIN.houseFFLInternal - 0.5);
const greenhouseModel = GreenhouseModel.build(GARDEN, existingGround);
const raisedBedsModel = RaisedBedsModel.build(GARDEN);
const siteTerrain = SiteTerrain.create(GARDEN, TERRAIN.plane, { garage: garageModel.groundPatch,
  pergola: pergolaModel.groundPatch, greenhouse: greenhouseModel.groundPatch, raisedBeds: raisedBedsModel.groundPatch },
  { surveySurface: surveySurface?.data, houseFFL: TERRAIN.houseFFLInternal });

const out = path.join(__dirname, "blender", "garden.json");
if (surveySurface) {
  // Survey coordinates must never be written into a tracked or stageable export.
  const relative = path.relative(__dirname, out);
  const tracked = execFileSync("git", ["ls-files", "--", relative], { cwd: __dirname, encoding: "utf8" }).trim();
  if (tracked) throw new Error("Private survey export destination is tracked");
  execFileSync("git", ["check-ignore", "--quiet", relative], { cwd: __dirname });
}
fs.writeFileSync(out, JSON.stringify({
  ...GARDEN,
  saunaModel: SaunaModel.build(GARDEN, siteTerrain.spec.deckTop),
  pergolaModel,
  garageModel,
  vehicleModels: GARDEN.vehicles.map(v => VehicleModel.build(v)),
  exteriorFurnitureModel: ExteriorFurnitureModel.build(GARDEN, siteTerrain.spec.deckTop),
  fixtureModels: Object.fromEntries(FIXTURE_SAMPLES.map(sample => [sample.id, FurnitureModel.build(sample.furniture)])),
  greenhouseModel,
  raisedBedsModel,
  firepitModel: FirepitModel.build(GARDEN, siteTerrain.height),
  hiddenBenchModel: HiddenBenchModel.build(GARDEN, siteTerrain.height),
  siteTerrain: siteTerrain.spec,
  terrain: { ...TERRAIN.plane, houseFFLInternal: TERRAIN.houseFFLInternal, bpvDatum: TERRAIN.bpvDatum },
}, null, 1));
console.log("wrote " + out);
