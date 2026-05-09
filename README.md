# Vizualizace zahrady

Interaktivní 3D model rodinné zahrady.

**Live:** https://marianovice.marekbartik.com

## Obsah

- [`index.html`](index.html) — 3D viewer (Three.js, single-file)
  - Sky shader s denní dobou (slider 6:00–20:00)
  - Walking tour POV
  - First-person mode (WASD)
  - Hover popisky prvků
  - Kamera presets
- [`editor.html`](editor.html) — interaktivní 2D editor (drag-drop prvků na grid)
- [`zahrada-plan.svg`](zahrada-plan.svg) — statický 2D půdorys

## Tech

- Vanilla HTML + JS
- Three.js z CDN
- Žádný build step
