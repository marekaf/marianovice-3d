// Planting data — Flera mixes, densities and zone assignments per docs/flera-design-review.md.
// Species roles follow the e-book legend (kosterní / skupinové / půdopokryvné / vtroušené + cibuloviny, dřeviny).
// bloom (month numbers 1–12) and heightCm are APPROXIMATE, from general horticultural knowledge, not Flera data.
// share = fraction of that role's plant count inside its mix (shares per role sum to 1, renormalized after zone subsetting).
// Consumed by plansheets.js / generate-plansheets.js: node generate-plansheets.js
const PLANTING = {
  densities: {
    perennialsPerM2: 6.5,
    bulbsPerM2: 25
  },
  // Convention (this project, not a Flera number): perennial count splits per role as
  // kosterní 8 %, skupinové 50 %, půdopokryvné 30 %, vtroušené 12 %; missing roles fold into skupinové.
  roleSplit: { kosterni: 0.08, skupinove: 0.5, pudopokryvne: 0.3, vtrousene: 0.12 },
  mixes: {
    citronovySorbet: {
      name: "Citrónový sorbet",
      stanoviste: "slunce + sucho",
      species: [
        { cz: "ovsíř stálezelený", lat: "Helictotrichon sempervirens 'Saphirsprudel'", role: "kosterni", bloom: [6, 7], heightCm: 100, potSize: "C2", share: 1, winter: true },
        { cz: "opadavec sivý", lat: "Sporobolus heterolepis", role: "skupinove", bloom: [8, 9], heightCm: 60, potSize: "C9", share: 0.22, winter: true },
        { cz: "agastache", lat: "Agastache rugosa 'Golden Jubilee'", role: "skupinove", bloom: [7, 8, 9], heightCm: 70, potSize: "C9", share: 0.15 },
        { cz: "řebříček tužebníkový", lat: "Achillea filipendulina 'Credo'", role: "skupinove", bloom: [6, 7, 8], heightCm: 100, potSize: "C9", share: 0.15, winter: true },
        { cz: "třapatka žlutá", lat: "Echinacea paradoxa", role: "skupinove", bloom: [6, 7], heightCm: 80, potSize: "C9", share: 0.18, winter: true },
        { cz: "šalvěj hajní", lat: "Salvia nemorosa 'Schneehügel'", role: "skupinove", bloom: [6, 7, 8, 9], heightCm: 40, potSize: "C9", share: 0.18 },
        { cz: "zlatnice", lat: "Solidaster luteus 'Super'", role: "skupinove", bloom: [7, 8, 9], heightCm: 60, potSize: "C9", share: 0.12 },
        { cz: "krásnoočko přeslenité", lat: "Coreopsis verticillata 'Moonbeam'", role: "pudopokryvne", bloom: [6, 7, 8, 9], heightCm: 40, potSize: "C9", share: 0.3 },
        { cz: "krásnoočko přeslenité", lat: "Coreopsis verticillata 'Zagreb'", role: "pudopokryvne", bloom: [6, 7, 8, 9], heightCm: 45, potSize: "C9", share: 0.3 },
        { cz: "pupalka", lat: "Oenothera pilosella 'Yella Fella'", role: "pudopokryvne", bloom: [6, 7], heightCm: 30, potSize: "C9", share: 0.2 },
        { cz: "hvězdnice", lat: "Aster ptarmicoides", role: "pudopokryvne", bloom: [7, 8, 9], heightCm: 40, potSize: "C9", share: 0.2 },
        { cz: "svíčkovec", lat: "Gaura lindheimeri", role: "vtrousene", bloom: [7, 8, 9, 10], heightCm: 80, potSize: "C9", share: 0.6 },
        { cz: "kokarda", lat: "Gaillardia aristata 'Amber Wheels'", role: "vtrousene", bloom: [6, 7, 8, 9], heightCm: 60, potSize: "C9", share: 0.4 },
        { cz: "narcis", lat: "Narcissus 'Hawera'", role: "cibulovina", bloom: [4, 5], heightCm: 20, potSize: "cibule", share: 0.4 },
        { cz: "tulipán", lat: "Tulipa batalinii 'Bright Gem'", role: "cibulovina", bloom: [4, 5], heightCm: 15, potSize: "cibule", share: 0.3 },
        { cz: "tulipán pozdní", lat: "Tulipa tarda", role: "cibulovina", bloom: [4], heightCm: 10, potSize: "cibule", share: 0.3 }
      ]
    },
    letoUVody: {
      name: "Léto u vody",
      stanoviste: "slunce + vlhko (okraje jezírek)",
      species: [
        { cz: "bezkolenec", lat: "Molinia altissima 'Transparent'", role: "kosterni", bloom: [7, 8], heightCm: 200, potSize: "C2", share: 0.6, winter: true },
        { cz: "krvavec", lat: "Sanguisorba tenuifolia 'Alba'", role: "kosterni", bloom: [7, 8], heightCm: 160, potSize: "C9", share: 0.4, winter: true },
        { cz: "kosatec sibiřský", lat: "Iris sibirica 'Butter and Sugar'", role: "skupinove", bloom: [5, 6], heightCm: 80, potSize: "C9", share: 0.22 },
        { cz: "ostřice převislá", lat: "Carex pendula", role: "skupinove", bloom: [5, 6], heightCm: 100, potSize: "C9", share: 0.18, winter: true },
        { cz: "rdesno hadí kořen", lat: "Persicaria officinalis 'Superba'", role: "skupinove", bloom: [5, 6, 7], heightCm: 80, potSize: "C9", share: 0.2 },
        { cz: "třapatka zářivá", lat: "Rudbeckia fulgida var. sullivantii 'Goldsturm'", role: "skupinove", bloom: [7, 8, 9], heightCm: 60, potSize: "C9", share: 0.22, winter: true },
        { cz: "hvězdnice novobelgická", lat: "Aster novi-belgii 'Fellowship'", role: "skupinove", bloom: [9, 10], heightCm: 100, potSize: "C9", share: 0.18 },
        { cz: "rdesno", lat: "Persicaria affinis 'Darjeeling Red'", role: "pudopokryvne", bloom: [6, 7, 8, 9], heightCm: 25, potSize: "C9", share: 0.6 },
        { cz: "rozrazil hořcovitý", lat: "Veronica gentianoides", role: "pudopokryvne", bloom: [5, 6], heightCm: 40, potSize: "C9", share: 0.4 },
        { cz: "česnek kulatohlavý", lat: "Allium sphaerocephalon", role: "cibulovina", bloom: [6, 7], heightCm: 60, potSize: "cibule", share: 0.7 },
        { cz: "bledule jarní", lat: "Leucojum vernum", role: "cibulovina", bloom: [2, 3], heightCm: 25, potSize: "cibule", share: 0.3 }
      ]
    },
    ruzoveMameni: {
      name: "Růžové mámení",
      stanoviste: "stín + sucho (severní strany budov)",
      species: [
        { cz: "bergénie", lat: "Bergenia 'Brahms'", role: "kosterni", bloom: [4, 5], heightCm: 40, potSize: "C9", share: 1, winter: true },
        { cz: "hvězdnice rozkladitá", lat: "Aster divaricatus", role: "skupinove", bloom: [8, 9, 10], heightCm: 60, potSize: "C9", share: 0.5 },
        { cz: "kakost oddenkatý", lat: "Geranium macrorhizum 'Ingwersen's Variety'", role: "skupinove", bloom: [5, 6, 7], heightCm: 30, potSize: "C9", share: 0.5 },
        { cz: "škornice", lat: "Epimedium × rubrum", role: "pudopokryvne", bloom: [4, 5], heightCm: 30, potSize: "C9", share: 0.3, winter: true },
        { cz: "kakost", lat: "Geranium × cantabrigiense 'Karmina'", role: "pudopokryvne", bloom: [5, 6, 7], heightCm: 20, potSize: "C9", share: 0.4 },
        { cz: "barvínek menší", lat: "Vinca minor", role: "pudopokryvne", bloom: [4, 5], heightCm: 15, potSize: "C9", share: 0.3, winter: true }
      ]
    },
    kvetouciStin: {
      name: "Kvetoucí stín",
      stanoviste: "stín + vlhko (pod stromy, severní zeď)",
      species: [
        { cz: "plochoklásek širolistý", lat: "Chasmanthium latifolium", role: "kosterni", bloom: [7, 8, 9], heightCm: 100, potSize: "C2", share: 0.6, winter: true },
        { cz: "kokořík", lat: "Polygonatum × hybridum 'Weihenstephan'", role: "kosterni", bloom: [5, 6], heightCm: 80, potSize: "C9", share: 0.4 },
        { cz: "udatna", lat: "Aruncus aethusifolius 'Horatio'", role: "skupinove", bloom: [6, 7], heightCm: 40, potSize: "C9", share: 0.2 },
        { cz: "čemeřice smrdutá", lat: "Helleborus foetidus", role: "skupinove", bloom: [2, 3, 4], heightCm: 60, potSize: "C9", share: 0.2, winter: true },
        { cz: "dlužicha", lat: "Heuchera villosa var. macrorrhiza", role: "skupinove", bloom: [7, 8, 9], heightCm: 50, potSize: "C9", share: 0.2, winter: true },
        { cz: "japonská astra", lat: "Kalimeris incisa 'Madiva'", role: "skupinove", bloom: [7, 8, 9], heightCm: 70, potSize: "C9", share: 0.2 },
        { cz: "hvězdnice rozkladitá", lat: "Aster divaricatus", role: "skupinove", bloom: [8, 9, 10], heightCm: 60, potSize: "C9", share: 0.2 },
        { cz: "škornice", lat: "Epimedium × youngianum 'Niveum'", role: "pudopokryvne", bloom: [4, 5], heightCm: 25, potSize: "C9", share: 0.3, winter: true },
        { cz: "svízel vonný", lat: "Galium odoratum", role: "pudopokryvne", bloom: [5, 6], heightCm: 20, potSize: "C9", share: 0.35 },
        { cz: "ostřice Morrowova", lat: "Carex morrowii 'Hazy Green'", role: "pudopokryvne", bloom: [4, 5], heightCm: 40, potSize: "C9", share: 0.35, winter: true },
        { cz: "orlíček", lat: "Aquilegia vulgaris 'White Barlow'", role: "vtrousene", bloom: [5, 6], heightCm: 70, potSize: "C9", share: 0.6 },
        { cz: "hrachor jarní", lat: "Lathyrus vernus", role: "vtrousene", bloom: [4, 5], heightCm: 30, potSize: "C9", share: 0.4 },
        { cz: "puškinie", lat: "Puschkinia scilloides", role: "cibulovina", bloom: [3, 4], heightCm: 15, potSize: "cibule", share: 0.25 },
        { cz: "narcis", lat: "Narcissus 'Thalia'", role: "cibulovina", bloom: [4, 5], heightCm: 35, potSize: "cibule", share: 0.25 },
        { cz: "hyacintovec", lat: "Hyacinthoides hispanica 'White Triumphator'", role: "cibulovina", bloom: [5], heightCm: 40, potSize: "cibule", share: 0.2 },
        { cz: "tulipán zelenokvětý", lat: "Tulipa viridiflora 'Green Star'", role: "cibulovina", bloom: [5], heightCm: 50, potSize: "cibule", share: 0.15 },
        { cz: "ladoňkovec", lat: "Camassia leichtlinii", role: "cibulovina", bloom: [5, 6], heightCm: 80, potSize: "cibule", share: 0.15 }
      ]
    },
    oudolf: {
      name: "Oudolf prairie (na motivy Pieta Oudolfa)",
      stanoviste: "slunce, průměrná půda",
      species: [
        { cz: "ozdobnice čínská", lat: "Miscanthus sinensis", role: "kosterni", bloom: [8, 9, 10], heightCm: 180, potSize: "C2", share: 0.5, winter: true },
        { cz: "hlavatka obrovská", lat: "Cephalaria gigantea", role: "kosterni", bloom: [6, 7], heightCm: 200, potSize: "C9", share: 0.5 },
        { cz: "třapatka nachová", lat: "Echinacea purpurea", role: "skupinove", bloom: [7, 8, 9], heightCm: 90, potSize: "C9", share: 0.4, winter: true },
        { cz: "šalvěj hajní", lat: "Salvia nemorosa", role: "skupinove", bloom: [6, 7, 8, 9], heightCm: 50, potSize: "C9", share: 0.3 },
        { cz: "pěchava podzimní", lat: "Sesleria autumnalis", role: "skupinove", bloom: [8, 9], heightCm: 40, potSize: "C9", share: 0.3, winter: true },
        { cz: "sporýš argentinský", lat: "Verbena bonariensis", role: "vtrousene", bloom: [7, 8, 9, 10], heightCm: 150, potSize: "C9", share: 0.6 },
        { cz: "svíčkovec", lat: "Gaura lindheimeri", role: "vtrousene", bloom: [7, 8, 9, 10], heightCm: 80, potSize: "C9", share: 0.4 }
      ]
    },
    // Woody picks (⊕ in the review) — absolute counts per zone via zones[].overrides.woody.
    dreviny: {
      name: "Dřeviny + popínavky (výběr dle review)",
      stanoviste: "dle zóny",
      species: [
        { cz: "dřín obecný", lat: "Cornus mas", role: "ker", bloom: [3, 4], heightCm: 400, potSize: "K12-14" },
        { cz: "kalina obecná", lat: "Viburnum opulus", role: "ker", bloom: [5, 6], heightCm: 350, potSize: "K12-14" },
        { cz: "kalina tušalaj", lat: "Viburnum lantana", role: "ker", bloom: [5, 6], heightCm: 300, potSize: "K12-14" },
        { cz: "líska obecná", lat: "Corylus avellana", role: "ker", bloom: [2, 3], heightCm: 400, potSize: "K12-14" },
        { cz: "brslen evropský", lat: "Euonymus europaeus", role: "ker", bloom: [5, 6], heightCm: 300, potSize: "K12-14" },
        { cz: "tis červený", lat: "Taxus baccata", role: "ker", bloom: [], heightCm: 250, potSize: "K12-14", winter: true },
        { cz: "šeřík obecný", lat: "Syringa vulgaris", role: "ker", bloom: [5], heightCm: 350, potSize: "K12-14" },
        { cz: "růže keřová (záhonová)", lat: "Rosa — keřové odrůdy", role: "ker", bloom: [6, 7, 8, 9, 10], heightCm: 100, potSize: "C5" },
        { cz: "muchovník Lamarckův (vícekmen)", lat: "Amelanchier lamarckii", role: "strom", bloom: [4, 5], heightCm: 500, potSize: "K35-50" },
        { cz: "růže pnoucí", lat: "Rosa 'New Dawn'", role: "popinavka", bloom: [6, 7, 8, 9], heightCm: 300, potSize: "C5" },
        { cz: "plamének vlašský", lat: "Clematis viticella cvs.", role: "popinavka", bloom: [7, 8, 9], heightCm: 300, potSize: "C2" }
      ]
    }
  },
  // zone element id (layout.js) → planting assignment. overrides:
  //   include: keep only these lat names from the mix; exclude: drop these; add: zone-local species entries;
  //   woody: absolute counts of dreviny (by lat); perennialAreaM2: area used for perennial+bulb math;
  //   bulbsPerM2: density override; bulbs: zone-local bulb entries; containers/seedMix/plugs: special zones.
  zones: {
    bedTerrace: {
      mix: "citronovySorbet",
      note: "Z1 — nízký subset ≤ 1 m, rámuje výhled z terasy na jezírko; ovsíř jako kosterní akcent na koncích.",
      overrides: {
        include: [
          "Helictotrichon sempervirens 'Saphirsprudel'", "Sporobolus heterolepis", "Achillea filipendulina 'Credo'",
          "Salvia nemorosa 'Schneehügel'", "Coreopsis verticillata 'Moonbeam'", "Coreopsis verticillata 'Zagreb'",
          "Narcissus 'Hawera'", "Tulipa tarda"
        ]
      }
    },
    pondFringe: {
      mix: "letoUVody",
      note: "Z2 — lem jezírka, vysoký bezkolenec + krvavec na V straně jako clona; štěrkový mulč, ne kůra.",
      overrides: {}
    },
    prairieIsland: {
      mix: "oudolf",
      note: "Z3 — prérijní ostrov dělící trávník; zimní siluety stojí do března.",
      overrides: {}
    },
    saunaBed: {
      mix: "citronovySorbet",
      note: "Z4 — keřová clona Softubu (dřín + kaliny) + aromatická zástěrka u sauny (subset Citrónový sorbet).",
      overrides: {
        include: ["Helictotrichon sempervirens 'Saphirsprudel'", "Agastache rugosa 'Golden Jubilee'", "Salvia nemorosa 'Schneehügel'", "Achillea filipendulina 'Credo'", "Sporobolus heterolepis"],
        perennialAreaM2: 9.6,
        bulbsPerM2: 0,
        woodyShape: 0,
        woody: [{ lat: "Cornus mas", count: 1 }, { lat: "Viburnum opulus", count: 2 }]
      }
    },
    pergolaBeds: {
      mix: "citronovySorbet",
      note: "Z5 — popínavky na sloupcích pergoly, pata v subsetu Citrónového sorbetu.",
      overrides: {
        include: ["Helictotrichon sempervirens 'Saphirsprudel'", "Salvia nemorosa 'Schneehügel'", "Sporobolus heterolepis", "Coreopsis verticillata 'Moonbeam'", "Gaura lindheimeri"],
        bulbsPerM2: 0,
        woody: [{ lat: "Clematis viticella cvs.", count: 4 }, { lat: "Rosa 'New Dawn'", count: 2 }]
      }
    },
    arrivalStrip: {
      mix: "citronovySorbet",
      note: "Z6 — příjezdový pás v plné receptuře (štěrkopísčité, bez závlahy); rytmus 3× vícekmenný muchovník.",
      overrides: {
        woody: [{ lat: "Amelanchier lamarckii", count: 3 }]
      }
    },
    eastUnderstory: {
      mix: "ruzoveMameni",
      note: "Z7 — keřové podrostové patro mezi kmeny + půdní vrstva Růžové mámení (suchý stín pod korunami).",
      overrides: {
        woody: [
          { lat: "Corylus avellana", count: 3 }, { lat: "Viburnum lantana", count: 3 },
          { lat: "Euonymus europaeus", count: 3 }, { lat: "Taxus baccata", count: 3 }
        ]
      }
    },
    atriumPots: {
      mix: null,
      note: "Z8 — nádoby v atriu; žádná výsadba do země, substrát v nádobách.",
      overrides: {
        // order matches the three atriumPots circles in layout.js (small, large, small)
        containers: [
          {
            label: "nádoba 1 (ø ~0.7 m)",
            contents: [
              { cz: "hakonechloa", lat: "Hakonechloa macra", count: 3, potSize: "C2", bloom: [7, 8], heightCm: 40, winter: true },
              { cz: "čemeřice", lat: "Helleborus × hybridus", count: 2, potSize: "C9", bloom: [2, 3, 4], heightCm: 40, winter: true }
            ]
          },
          { label: "nádoba 2 — velká (ø ≥ 1 m)", contents: [{ cz: "muchovník Lamarckův (vícekmen)", lat: "Amelanchier lamarckii", count: 1, potSize: "K35-50", bloom: [4, 5], heightCm: 400 }] },
          {
            label: "nádoba 3 (ø ~0.7 m)",
            contents: [
              { cz: "kapraď samec", lat: "Dryopteris filix-mas", count: 2, potSize: "C2", bloom: [], heightCm: 80 },
              { cz: "škornice", lat: "Epimedium × youngianum 'Niveum'", count: 3, potSize: "C9", bloom: [4, 5], heightCm: 25, winter: true }
            ]
          }
        ]
      }
    },
    northFoundation: {
      mix: "kvetouciStin",
      note: "Z9a — severní podezdívkový záhon v plné receptuře; drženo mimo okapovou linii střechy.",
      overrides: {}
    },
    southFoundation: {
      mix: "citronovySorbet",
      note: "Z9b — emoční záhon: šeřík (Z konec), pivoňky jako kosterní, keřové růže; výplň šalvěj/řebříček/ovsíř.",
      overrides: {
        include: [
          "Helictotrichon sempervirens 'Saphirsprudel'", "Salvia nemorosa 'Schneehügel'", "Achillea filipendulina 'Credo'",
          "Narcissus 'Hawera'", "Tulipa batalinii 'Bright Gem'", "Tulipa tarda"
        ],
        add: [{ cz: "pivoňka čínská", lat: "Paeonia lactiflora", role: "kosterni", bloom: [5, 6], heightCm: 80, potSize: "C5", share: 1 }],
        woody: [{ lat: "Syringa vulgaris", count: 1 }, { lat: "Rosa — keřové odrůdy", count: 5 }]
      }
    },
    garageFaceBed: {
      mix: "ruzoveMameni",
      note: "Z10 — Růžové mámení v suchém stínu severní stěny garáže; vlastní vícekmenná kalina tušalaj u SZ rohu.",
      overrides: {
        woody: [{ lat: "Viburnum lantana", count: 1 }]
      }
    },
    rainGarden: {
      mix: "letoUVody",
      note: "Z11 — adaptace Léto u vody pro mělkou průlehovou zahradu (kosatec, rdesna, ostřice, bledule).",
      overrides: {
        include: [
          "Iris sibirica 'Butter and Sugar'", "Persicaria officinalis 'Superba'", "Persicaria affinis 'Darjeeling Red'",
          "Carex pendula", "Leucojum vernum"
        ]
      }
    },
    orchardMeadow: {
      mix: null,
      note: "Z12 — extenzivní květnatá louka pod ovocnými stromy (výsev, ne sadba); jahodník a svízel u stinného okraje.",
      overrides: {
        seedMix: { name: "květnatá luční směs (regionální)", rateKgPerM2: 0.005, bloom: [5, 6, 7] },
        plugs: [
          { cz: "jahodník obecný", lat: "Fragaria vesca", count: 40, potSize: "P9", bloom: [5, 6], heightCm: 20 },
          { cz: "svízel vonný", lat: "Galium odoratum", count: 30, potSize: "P9", bloom: [5, 6], heightCm: 20 }
        ],
        bulbsPerM2: 10,
        bulbs: [
          { cz: "narcis bílý", lat: "Narcissus poeticus", role: "cibulovina", bloom: [4, 5], heightCm: 40, potSize: "cibule", share: 0.6 },
          { cz: "ladoňkovec", lat: "Camassia leichtlinii", role: "cibulovina", bloom: [5, 6], heightCm: 80, potSize: "cibule", share: 0.4 }
        ]
      }
    }
  },
  // Unit prices in CZK — rough ESTIMATES for budgeting only (docs/vykaz-vymer.md), not quotes.
  pricesCZK: {
    perennialC9: 120, perennialC2: 140, perennialC5: 300, plugP9: 60, bulb: 10,
    shrubK: 550, taxusK: 700, syringaK: 700, rosaShrub: 350, rosaClimber: 400, clematis: 320,
    amelanchierMultistem: 2800,
    compostM3: 850, gravelM3: 950, edgingM: 260, meadowSeedKg: 1500,
    planterLarge: 6000, planterMid: 4000, containerSubstrateM3: 1500
  }
};

if (typeof module !== "undefined") module.exports = { PLANTING };
