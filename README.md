# House and garden visualization

Interactive 3D model of a house and its garden.

**Live:** https://marianovice.marekbartik.com

[House interiors](https://marianovice.marekbartik.com/interior.html) · [Office views](https://marianovice.marekbartik.com/docs/offices.html)

This is a visualization, not a construction drawing or clearance approval. Some furniture dimensions, equipment placements, roof geometry and lighting remain proposals. Original drawings, supplier documents and reference photographs are not included.

The pale-oak flooring uses an original procedural texture. It is an illustrative approximation, not an exact product photograph or colour sample.

## Verification

Run `yarn verify` with Node.js 22 and Yarn 1.22.18, or run `corepack enable` to use the pinned Yarn version. No dependency installation is needed.

This runs the same checks as CI and regenerates the two SVG drawings. It fails if any check fails or Git reports changed, staged, or untracked SVGs. Review and commit intentional drawing updates before rerunning.

After changing an asset referenced with `?v=`, run `yarn assets:version` and commit the updated viewer pages. These URLs use content hashes so returning browsers fetch changed scripts. `yarn verify` rejects stale hashes.

With Playwright and Chrome available, run `yarn verify:visual` for a local screenshot gallery of furnished rooms, dressing joinery, roofs and operable doors. Set `PLAYWRIGHT_MODULE` to an installed Playwright module path if it is not available by name. The command prints the gallery path and saves full-size PNGs beside it in a temporary directory. It runs browser checks sequentially, closes each browser afterwards, and returns a nonzero exit code with a partial gallery if a check fails. It does not start Unreal or use private finish photos. Passing checks still require visual review of the images.

The viewer and gallery use the published Floorify Champagne reference by default, with publication permission confirmed by the owner. To override it locally, use `yarn verify:visual --floor-reference /path/to/reference.jpg`. This applies the selected plank crops to every capture and waits for image loading. Override photos are not copied into the repository; keep their screenshots private unless you have publication permission. The gallery manifest records the finish mode and reference fingerprint.

## Contents

- [`grading.html`](grading.html) — one-page Czech grading map and legend with work areas A–M, dimensions, surface areas and height marks; `node generate-grading-plan.js` exports the local HTML and SVG
- [`layout.js`](layout.js) — single source of truth for the garden layout (all coordinates in meters); consumed by the 3D viewer, the 2D editor and the SVG generator
- [`index.html`](index.html) — 3D viewer (Three.js, single-file)
  - Procedural sky shader with day-of-year + hour sliders (real solar formula, 50° N)
  - Walking tour POV
  - First-person mode (WASD + mouse look)
  - Hover labels for major elements
  - Camera presets (top-down, isometric, walking eye level, etc.)
  - Garage interior — hollow shell with real gate + door openings, open/closed gate toggle
- [`interior.html`](interior.html) — house, loft, garage and sauna interiors: floor plans, wall elevations, cutaway 3D, furnished eye-level views and PNG export. House cutaway is the default view
- [`interiors3d.js`](interiors3d.js) — shared garage-interior builder consumed by both viewers
- [`sauna-model.js`](sauna-model.js) — shared sauna, shelter, hot tub and entrance geometry; used by the browser and exported to Blender
- [`pergola-model.js`](pergola-model.js) — shared timber frame, paving, dining furniture and lighting; rendered through `model3d.js` and `blender/model_parts.py`
- [`garage-model.js`](garage-model.js) — shared hollow garage, wall finishes, sectional-door mechanisms and workshop furniture; preserves wall and gate cutaways in the interiors viewer
- [`furniture-model.js`](furniture-model.js) — data-driven cabinetry, sanitary fixtures and bedding; generic examples are available at [`fixtures.html`](fixtures.html)
- [`greenhouse-model.js`](greenhouse-model.js) — shared hollow greenhouse, framed glazing, roof vent, drainage and potting furniture
- [`raised-beds-model.js`](raised-beds-model.js) — four timber beds with recessed soil, irrigation and crops on their shared gravel pad
- [`firepit-model.js`](firepit-model.js) — hollow corten firepit, logs and supported benches following the existing slope
- [`hidden-bench-model.js`](hidden-bench-model.js) — painted garden bench with slats, metal framing and feet fitted to the garage-side grading
- [`site-terrain.js`](site-terrain.js) — shared grading definition and house/deck rendering levels; Blender evaluates the exported definition through [`blender/site_terrain.py`](blender/site_terrain.py)
- [`editor.html`](editor.html) — interactive 2D editor (drag-drop on a grid, mouse or touch); exports an updated `layout.js` or SVG
- [`plan.js`](plan.js) — renders the 2D SVG plan from `layout.js`
- [`zahrada-plan.svg`](zahrada-plan.svg) — static 2D plan, generated: `node generate-svg.js`

## Tech

- Vanilla HTML + JS
- Three.js loaded from CDN
- No build step — serve the repository over HTTP and open it in a browser

## Model previews

The house roof uses a 250 mm normal depth for the main overhangs and a 227 mm normal build-up for the western wing: 160 mm rafters plus 67 mm of roof layers. The western enclosed finish is illustrative; its additional lining thickness is not confirmed. Roof elevations and window positions remain fixed. Exterior wall tops follow the western underside in both garden and walk views.

Run `node verify-house-roof.mjs` and `node verify-roof-wall-cap.mjs` to check depths, closed junctions, gutter clearance and wall caps. With Playwright and Chrome available, `node verify-roof-browser.mjs` checks the rendered garden and furnished walk geometry. Set `PLAYWRIGHT_MODULE` to a local Playwright module path if needed, and `ROOF_SCREENSHOT_DIR` to an existing directory to save six exterior views.

The browser's **Sauna and spa** view is also available at `#sauna`. The model includes timber cladding, framed openings, benches, heater, standing-seam roof, shelter framing, a hollow tub and a raised entrance landing. Door placement and architectural details are a design proposal, not construction drawings.

The interiors page includes a sauna floor plan, four wall elevations and a cutaway at `interior.html#sauna-cut3d`. It uses the same geometry as the garden view; the outdoor shelter and tub are hidden to keep the interior inspection focused.

The **Pergola dining** view at `#pergola` shows connected beams, braces, roof slats, detailed dining furniture and lighting. The Roof and Furniture toggles control those parts separately. Both renderers use the pergola's grading level from `layout.js`.

Generate Blender input with `node generate-blender-json.js`. A standalone preview needs no downloaded plant or texture assets:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 -P blender/render-model.py -- blender/garden.json --model=pergola
```

This saves `blender/pergola.blend` and day, evening and dining PNGs using the CPU. Use `--model=sauna` for sauna views, `--quick` for smaller previews, or `--only=day` for one view. The complete garden builder consumes the same geometry and supports `--only=sauna,sauna-evening,pergola,pergola-evening`, but requires the assets listed in `blender/assets/MANIFEST.md`.

Run `node verify-sauna.mjs` to check openings, entrance clearance, footing, roof joins and separation of the tub and log rack.
Run `node verify-pergola.mjs` to check frame connections, furniture supports, paving and lighting placement.

Run `node verify-pergola-view-browser.mjs` with Playwright available to capture the bedroom bed view, window-seat view and garden overview in headless Chrome. Images go to `/tmp/pergola-bedroom-review`; set `PERGOLA_SCREENSHOT_DIR` to choose another output directory. The browser closes after capture. `node verify-pergola-bedroom-view.mjs` checks the north-boundary clearance and the bedroom-to-firepit sightline.
Run `node verify-garage.mjs` to check garage openings, gate states, floor datum and parking clearances. Use `--model=garage` in the standalone Blender command for exterior and interior previews. The browser interior views are available at `interior.html#garage-cut3d` and `interior.html#garage-north`.
Run `node verify-fixtures.mjs` to check fixture footprints, heights and floor offsets. Use `--model=fixtures --sample=bath` or `--sample=bed` for standalone fixture renders. Beds default to a north-facing headboard; optional `head: 'N'|'S'|'E'|'W'` rotates the bedding within the supplied footprint.
Run `node verify-greenhouse.mjs` to check the doorway, roof vent and interior supports. The browser preview is at `#greenhouse`; Roof and Furniture controls expose its interior. Use `--model=greenhouse` for standalone exterior and interior Blender previews.
Run `node verify-raised-beds.mjs` to check the bed shells, soil, crop supports and grading. The browser's Kitchen garden view is at `#raisedBeds`; the Furniture control hides the crops for inspection. Use `--model=raisedBeds` for standalone Blender previews.
Run `node verify-firepit.mjs` to check the cavity, seating footprint, supports and approach. The browser preview is at `#firepit`; the Furniture control hides the benches, and flames appear after sunset. Use `--model=firepit` for standalone Blender previews.
Run `node verify-hidden-bench.mjs` to check the bench footprint, connected framing and graded foot contacts. The browser preview is at `#hiddenBench`; use `--model=hiddenBench` for standalone Blender previews.
Run `node verify-site-terrain.mjs` to compare grading with the saved browser baseline and the Python sampler. Rendering levels follow the placed house geometry; `TERRAIN.houseFFLInternal` remains the nominal survey reference.

## License

MIT — see [LICENSE](LICENSE).
