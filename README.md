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
  - Garage interior — hollow shell with real gate + door openings, open/closed gate toggle
- [`interior.html`](interior.html) — dedicated interiors page: orthographic floor plan + one elevation per wall (the wall you look through is hidden), cutaway 3D, PNG export with a scale bar. Ships with the garage; the house appears when a local (gitignored) `house-interior.js` room-data file is present
- [`interiors3d.js`](interiors3d.js) — shared garage-interior builder consumed by both viewers
- [`sauna-model.js`](sauna-model.js) — shared sauna, shelter, hot tub and entrance geometry; used by the browser and exported to Blender
- [`pergola-model.js`](pergola-model.js) — shared timber frame, paving, dining furniture and lighting; rendered through `model3d.js` and `blender/model_parts.py`
- [`garage-model.js`](garage-model.js) — shared hollow garage, wall finishes, sectional-door mechanisms and workshop furniture; preserves wall and gate cutaways in the interiors viewer
- [`editor.html`](editor.html) — interactive 2D editor (drag-drop on a grid, mouse or touch); exports an updated `layout.js` or SVG
- [`plan.js`](plan.js) — renders the 2D SVG plan from `layout.js`
- [`zahrada-plan.svg`](zahrada-plan.svg) — static 2D plan, generated: `node generate-svg.js`

## Tech

- Vanilla HTML + JS
- Three.js loaded from CDN
- No build step — just open in a browser

## Model previews

The browser's **Sauna and spa** view is also available at `#sauna`. The model includes timber cladding, framed openings, benches, heater, standing-seam roof, shelter framing, a hollow tub and a raised entrance landing. Door placement and architectural details are a design proposal, not construction drawings.

The **Pergola dining** view at `#pergola` shows connected beams, braces, roof slats, detailed dining furniture and lighting. The Roof and Furniture toggles control those parts separately. Both renderers use the pergola's grading level from `layout.js`.

Generate Blender input with `node generate-blender-json.js`. A standalone preview needs no downloaded plant or texture assets:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 -P blender/render-model.py -- blender/garden.json --model=pergola
```

This saves `blender/pergola.blend` and day, evening and dining PNGs using the CPU. Use `--model=sauna` for sauna views, `--quick` for smaller previews, or `--only=day` for one view. The complete garden builder consumes the same geometry and supports `--only=sauna,sauna-evening,pergola,pergola-evening`, but requires the assets listed in `blender/assets/MANIFEST.md`.

Run `node verify-sauna.mjs` to check openings, entrance clearance, footing, roof joins and separation of the tub and log rack.
Run `node verify-pergola.mjs` to check frame connections, furniture supports, paving and lighting placement.
Run `node verify-garage.mjs` to check garage openings, gate states, floor datum and parking clearances. Use `--model=garage` in the standalone Blender command for exterior and interior previews. The browser interior views are available at `interior.html#garage-cut3d` and `interior.html#garage-north`.

## License

MIT — see [LICENSE](LICENSE).
