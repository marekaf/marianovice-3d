// Writes docs/plansheets/<zoneId>.svg (one sheet per planting zone), docs/bloom-calendar.svg
// and docs/vykaz-vymer.md from layout.js + planting.js. Run: node generate-plansheets.js
const fs = require("fs");
const path = require("path");
const { GARDEN } = require("./layout.js");
const { PLANTING } = require("./planting.js");
const sheets = require("./plansheets.js");

const OUT_DIR = path.join(__dirname, "docs", "plansheets");
fs.mkdirSync(OUT_DIR, { recursive: true });

const zoneIds = Object.keys(PLANTING.zones);
const plans = {};
for (const zoneId of zoneIds) {
  const svg = sheets.renderPlanSheet(GARDEN, PLANTING, zoneId);
  fs.writeFileSync(path.join(OUT_DIR, `${zoneId}.svg`), svg);
  plans[zoneId] = sheets.computeZonePlan(GARDEN, PLANTING, zoneId);
  console.log(`plansheets/${zoneId}.svg`);
}
fs.writeFileSync(path.join(__dirname, "docs", "bloom-calendar.svg"), sheets.renderBloomCalendar(GARDEN, PLANTING));
console.log("bloom-calendar.svg");

// ---- quantity takeoff (docs/vykaz-vymer.md) --------------------------------

const P = PLANTING.pricesCZK;
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const kc = (v) => Math.round(v).toLocaleString("cs-CZ").replace(/ /g, " ") + " Kč";

// perennial layer of these beds is planted in Phase 1 (autumn) per the review; the rest in Phase 2 (spring)
const PHASE1_BEDS = ["bedTerrace", "pondFringe", "northFoundation", "southFoundation"];
// steel edging: bed perimeter minus runs against walls/terrace/fence/driveway (no lawn edge there)
const EDGING_DEDUCT = {
  bedTerrace: { m: 7.8, why: "západní hrana přiléhá k terase" },
  northFoundation: { m: 10.6, why: "stěna domu" },
  southFoundation: { m: 10.8, why: "stěna domu" },
  garageFaceBed: { m: 10, why: "stěna garáže" },
  eastUnderstory: { m: 16.5, why: "východní plot" },
  arrivalStrip: { m: 43.95, why: "sevřen příjezdem a plotem — lemují se jen 2 krátké konce" },
  orchardMeadow: { m: Infinity, why: "louka — kosená hrana, bez lemu" },
  atriumPots: { m: Infinity, why: "nádoby na dlažbě" }
};

function unitPrice(sp) {
  if (sp.role === "cibulovina") return P.bulb;
  const byLat = {
    "Taxus baccata": P.taxusK, "Syringa vulgaris": P.syringaK, "Amelanchier lamarckii": P.amelanchierMultistem,
    "Rosa — keřové odrůdy": P.rosaShrub, "Rosa 'New Dawn'": P.rosaClimber, "Clematis viticella cvs.": P.clematis
  };
  if (byLat[sp.lat] != null) return byLat[sp.lat];
  if (sp.role === "ker" || sp.role === "strom") return P.shrubK;
  if (sp.potSize === "P9") return P.plugP9;
  if (sp.potSize === "C2") return P.perennialC2;
  if (sp.potSize === "C5") return P.perennialC5;
  return P.perennialC9;
}

const rollup = new Map(); // lat|pot → { cz, lat, pot, group, count, price, phase1, phase2 }
function addItem(sp, count, group, phase) {
  const key = `${sp.lat}|${sp.potSize}`;
  if (!rollup.has(key)) rollup.set(key, { cz: sp.cz, lat: sp.lat, pot: sp.potSize, group, count: 0, price: unitPrice(sp), phase1: 0, phase2: 0 });
  const row = rollup.get(key);
  row.count += count;
  row[phase === 1 ? "phase1" : "phase2"] += count;
}

let bedAreaTotal = 0, turfTotal = 0, compostArea = 0, gravelArea = 0;
const zoneRows = [];
const gravelZones = [];
for (const zoneId of zoneIds) {
  const plan = plans[zoneId];
  const ov = plan.zoneDef.overrides || {};
  const perennialPhase = PHASE1_BEDS.includes(zoneId) ? 1 : 2;
  for (const sp of plan.species) {
    if (sp.role === "cibulovina") addItem(sp, sp.count, "cibuloviny", 1);
    else if (sp.container) addItem(sp, sp.count, "nádoby", 1);
    else addItem(sp, sp.count, "trvalky", sp.plug ? 2 : perennialPhase);
  }
  for (const w of plan.woody) addItem(w, w.count, "dřeviny", zoneId === "pergolaBeds" ? 2 : 1);
  if (!plan.containers) {
    bedAreaTotal += plan.area;
    turfTotal += plan.area;
    if (!plan.seedMix) compostArea += plan.area;
    if (plan.zoneDef.mix === "citronovySorbet" || plan.zoneDef.mix === "letoUVody") {
      const a = ov.perennialAreaM2 != null ? ov.perennialAreaM2 : plan.area;
      gravelArea += a;
      gravelZones.push(`${zoneId} ${r2(a)} m²`);
    }
  }
  const perim = plan.containers ? 0 : plan.shapes.reduce((a, s) => a + sheets.shapePerimeter(s), 0);
  const ded = EDGING_DEDUCT[zoneId];
  const edging = Math.max(0, perim - (ded ? ded.m : 0));
  zoneRows.push({ zoneId, plan, perim, edging, dedWhy: ded ? ded.why : "", perennialPhase });
}
const edgingTotal = zoneRows.reduce((a, z) => a + z.edging, 0);
const compostM3 = compostArea * 0.05;
const gravelM3 = gravelArea * 0.05;
const meadowPlan = plans.orchardMeadow;
const seedKg = meadowPlan.area * meadowPlan.seedMix.rateKgPerM2;

const groups = ["trvalky", "cibuloviny", "dřeviny", "nádoby"];
const groupTitle = { trvalky: "Trvalky (+ sadba do louky)", cibuloviny: "Cibuloviny", "dřeviny": "Dřeviny a popínavky", "nádoby": "Rostliny do nádob (Z8)" };
const rows = [...rollup.values()];

const materials = [
  { name: "sejmutí drnu / smothering", qty: `${r2(turfTotal)} m²`, unit: "svépomocí (0 Kč) — příp. ~50 Kč/m² dodavatelsky", cost: 0, note: "louka Z12 lze jen zvertikutovat a přesít" },
  { name: "kompost, 5 cm na záhony (bez louky)", qty: `${r2(compostM3)} m³`, unit: `${P.compostM3} Kč/m³`, cost: compostM3 * P.compostM3 },
  { name: "štěrkový mulč 8/16, 5 cm (jen Citrónový sorbet + Léto u vody)", qty: `${r2(gravelM3)} m³`, unit: `${P.gravelM3} Kč/m³`, cost: gravelM3 * P.gravelM3 },
  { name: "ocelový lem záhonů", qty: `${r1(edgingTotal)} m`, unit: `${P.edgingM} Kč/m`, cost: edgingTotal * P.edgingM },
  { name: "luční osivo (Z12)", qty: `${r2(seedKg)} kg`, unit: `${P.meadowSeedKg} Kč/kg`, cost: seedKg * P.meadowSeedKg },
  { name: "nádoby do atria (1 velká + 2 střední) + substrát", qty: "3 ks + 0.5 m³", unit: "odhad", cost: P.planterLarge + 2 * P.planterMid + 0.5 * P.containerSubstrateM3 }
];
const materialsTotal = materials.reduce((a, m) => a + m.cost, 0);
const plantsPhase1 = rows.reduce((a, r) => a + r.phase1 * r.price, 0);
const plantsPhase2 = rows.reduce((a, r) => a + r.phase2 * r.price, 0);

const md = [];
md.push("# Výkaz výměr — osazovací dokumentace");
md.push("");
md.push("Vygenerováno z `layout.js` + `planting.js` skriptem `node generate-plansheets.js` — needitovat ručně.");
md.push("Počty: trvalky 6,5 ks/m², cibuloviny 25 ks/m² (dle review); role split 8/50/30/12 % je konvence projektu.");
md.push("**Všechny ceny jsou hrubé ODHADY** (trvalka C9 ~90–160 Kč, cibule ~8–15 Kč, keře K ~350–900 Kč, stromy ~1500–3500 Kč), ne nabídka.");
md.push("");
md.push("## Plochy záhonů");
md.push("");
md.push("| zóna | mix | m² | obvod m | lem m | fáze trvalek |");
md.push("|---|---|---:|---:|---:|---|");
for (const z of zoneRows) {
  const mixName = z.plan.mix ? z.plan.mix.name : z.plan.containers ? "nádoby" : z.plan.seedMix.name;
  md.push(`| ${z.plan.el.short || z.zoneId} (${z.zoneId}) | ${mixName} | ${z.plan.containers ? "—" : r2(z.plan.area)} | ${z.perim ? r1(z.perim) : "—"} | ${r1(z.edging)}${z.dedWhy ? ` *(${z.dedWhy})*` : ""} | ${z.plan.containers ? "1 (nádoby)" : z.plan.seedMix ? "2 (výsev)" : z.perennialPhase} |`);
}
md.push(`| **celkem** | | **${r2(bedAreaTotal)}** | | **${r1(edgingTotal)}** | |`);
md.push("");
for (const g of groups) {
  const rs = rows.filter((r) => r.group === g).sort((a, b) => b.count - a.count);
  if (!rs.length) continue;
  md.push(`## ${groupTitle[g]}`);
  md.push("");
  md.push("| druh | latinsky | bal. | ks | Kč/ks *(odhad)* | Kč |");
  md.push("|---|---|---|---:|---:|---:|");
  let sum = 0, cost = 0;
  for (const r of rs) {
    sum += r.count; cost += r.count * r.price;
    md.push(`| ${r.cz} | *${r.lat}* | ${r.pot} | ${r.count} | ${r.price} | ${Math.round(r.count * r.price)} |`);
  }
  md.push(`| **celkem** | | | **${sum}** | | **${Math.round(cost)}** |`);
  md.push("");
}
md.push("## Materiál");
md.push("");
md.push("| položka | množství | jedn. cena *(odhad)* | Kč |");
md.push("|---|---|---|---:|");
for (const m of materials) md.push(`| ${m.name}${m.note ? ` *(${m.note})*` : ""} | ${m.qty} | ${m.unit} | ${Math.round(m.cost)} |`);
md.push(`| **celkem materiál** | | | **${Math.round(materialsTotal)}** |`);
md.push("");
md.push(`Štěrkový mulč jen na záhony receptur Citrónový sorbet + Léto u vody (dle review): ${gravelZones.join(", ")}.`);
md.push("");
md.push("## Rozpočet po fázích *(hrubý odhad)*");
md.push("");
md.push("Fáze dle review: **Fáze 1 — podzim**: všechny dřeviny (kostra, mimo popínavky Z5), záhony Z1 + Z2 + Z9a + Z9b, všechny cibuloviny (září–říjen), nádoby Z8, materiál a příprava. **Fáze 2 — jaro**: trvalky Z3/Z4/Z5/Z6/Z7/Z10/Z11, popínavky Z5, výsev louky Z12 (duben–květen), sadba do louky.");
md.push("");
md.push("| fáze | rostliny Kč | materiál Kč | celkem Kč |");
md.push("|---|---:|---:|---:|");
md.push(`| Fáze 1 (podzim) | ${Math.round(plantsPhase1)} | ${Math.round(materialsTotal)} | **${Math.round(plantsPhase1 + materialsTotal)}** |`);
md.push(`| Fáze 2 (jaro) | ${Math.round(plantsPhase2)} | 0 | **${Math.round(plantsPhase2)}** |`);
md.push(`| **celkem** | ${Math.round(plantsPhase1 + plantsPhase2)} | ${Math.round(materialsTotal)} | **${kc(plantsPhase1 + plantsPhase2 + materialsTotal)}** |`);
md.push("");
md.push("Poznámky: zatravněná plocha se mění na záhon v celé výměře výše (sejmutí drnu svépomocí = 0 Kč v rozpočtu); lem se odečítá u hran přiléhajících ke stěnám, terase, plotu a příjezdu (viz tabulka ploch); kompost bez louky Z12 — květnatá louka chce chudší půdu.");
md.push("");
fs.writeFileSync(path.join(__dirname, "docs", "vykaz-vymer.md"), md.join("\n"));
console.log("vykaz-vymer.md");

// sanity output
const bt = plans.bedTerrace;
console.log(`\nsanity bedTerrace: area ${r2(bt.area)} m², perennials ${bt.totalPerennials}, bulbs ${bt.totalBulbs}`);
console.log(`beds total ${r2(bedAreaTotal)} m², compost ${r2(compostM3)} m³, gravel ${r2(gravelM3)} m³, edging ${r1(edgingTotal)} m, seed ${r2(seedKg)} kg`);
console.log(`budget: phase1 ${Math.round(plantsPhase1 + materialsTotal)} Kč, phase2 ${Math.round(plantsPhase2)} Kč`);
