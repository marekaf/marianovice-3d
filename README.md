# Garden visualization

Interactive 3D model of a residential garden.

**Live:** https://marianovice.marekbartik.com

## Contents

- [`layout.js`](layout.js) — single source of truth for the garden layout (all coordinates in meters); consumed by the 3D viewer, the 2D editor and the SVG generator
- [`index.html`](index.html) — 3D viewer (Three.js, single-file)
  - Procedural sky shader with day-of-year + hour sliders (real solar formula, 50° N)
  - Walking tour POV
  - First-person mode (WASD + mouse look)
  - Hover labels for major elements
  - Camera presets (top-down, isometric, walking eye level, etc.)
- [`editor.html`](editor.html) — interactive 2D editor (drag-drop on a grid, mouse or touch); exports an updated `layout.js` or SVG
- [`plan.js`](plan.js) — renders the 2D SVG plan from `layout.js`
- [`zahrada-plan.svg`](zahrada-plan.svg) — static 2D plan, generated: `node generate-svg.js`
- [`planting.js`](planting.js) — planting data (Flera mixes, densities, per-zone assignments) consumed by the plansheet generator
- [`generate-plansheets.js`](generate-plansheets.js) — writes `docs/plansheets/*.svg`, `docs/bloom-calendar.svg` and `docs/vykaz-vymer.md`: `node generate-plansheets.js`
- [`generate-sections.js`](generate-sections.js) — writes section/elevation drawings `docs/sections/*.svg`: `node generate-sections.js`
- [`build-book.js`](build-book.js) — assembles the A4-landscape project book `docs/project-book.pdf` (Chrome headless print): `node build-book.js`

## Tech

- Vanilla HTML + JS
- Three.js loaded from CDN
- No build step — just open in a browser

## License

MIT — see [LICENSE](LICENSE).
