// Regenerates zahrada-plan.svg from layout.js. Usage: node generate-svg.js
const fs = require("fs");
const path = require("path");
const { GARDEN } = require("./layout.js");
const { renderPlanSVG } = require("./plan.js");

const out = path.join(__dirname, "zahrada-plan.svg");
fs.writeFileSync(out, renderPlanSVG(GARDEN));
console.log(`wrote ${out}`);
