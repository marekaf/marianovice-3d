# Garden visualization

Interactive 3D model of a residential garden.

**Live:** https://marianovice.marekbartik.com

## Contents

- [`index.html`](index.html) — 3D viewer (Three.js, single-file)
  - Procedural sky shader with day-of-year + hour sliders (real solar formula, 50° N)
  - Walking tour POV (38 stops)
  - First-person mode (WASD + mouse look)
  - Hover labels for major elements
  - Camera presets (top-down, isometric, walking eye level, etc.)
- [`editor.html`](editor.html) — interactive 2D editor (drag-drop elements on a grid)
- [`zahrada-plan.svg`](zahrada-plan.svg) — static 2D plan (slightly out of sync with 3D)

## Tech

- Vanilla HTML + JS
- Three.js loaded from CDN
- No build step — just open in a browser
