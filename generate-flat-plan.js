// Regenerates zahrada-flat-plan.svg from layout.js + terrain.js. Usage: node generate-flat-plan.js
const fs = require("fs");
const path = require("path");
const { GARDEN } = require("./layout.js");
const { renderFlatPlanSVG } = require("./flatplan.js");

const out = path.join(__dirname, "zahrada-flat-plan.svg");
fs.writeFileSync(out, renderFlatPlanSVG(GARDEN));
console.log(`wrote ${out}`);
