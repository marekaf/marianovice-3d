# Walkthrough proof of concept

Status: local Unreal 5.8.2 scene imported and grounded walking verified on Mac. Lighting and material matching remain provisional.

The PoC focuses on the living room, kitchen, cathedral ceiling and eastern terrace. The adjacent rooms and full house envelope remain in the export so they can occlude light. The garden viewer remains the source of geometry and dimensions. This does not replace either website viewer.

## Generate the import package

Install the repository dependencies with `yarn install --frozen-lockfile`. The exporter uses Chrome and Playwright, following the existing browser verification scripts. Provide an installed Playwright module through `PLAYWRIGHT_MODULE` if it is not available as `playwright`.

Run `yarn unreal:verify`, then `yarn unreal:export --source-root /path/to/active/viewer`.
The source directory must contain the intended viewer and its installed Three.js
dependency. There is no implicit source-directory default. Export helpers come
from this tooling copy; viewer HTML, geometry modules and textures come from the
explicit source. The manifest fingerprints those two inputs separately.

The local preview can override the public procedural floor with a private photo.
Filesystem source selection does not inherit that server override. To export the
selected four-plank Floorify Champagne reference, add
`--floor-reference /path/to/private/reference.jpg` to the export command.
This option uses the preview's plank crops and waits for image loading before
serializing the scene. It is not a general crop configuration for other photos.
Missing files fail before browser startup; image decode/load errors fail export.

The reference is served only by the temporary loopback exporter and is not copied
into viewer sources. Its image and override-module hashes appear in the manifest,
without the private path. The generated GLB embeds the texture and must remain
private too. Without this option, `floorFinish.mode` is `viewer-source`; with it,
the mode is `local-reference`. No fresh GLB has verified this override yet.

For a CPU-only check of the selected viewer's loft factory, run
`node unreal/verify-viewer-loft.mjs --source-root /path/to/active/viewer`.
It uses a fixed roof-opening fixture and checks geometry ownership and mesh
transfer without loading textures, a browser or Unreal. It does not validate
the live garden assembly or replace a GLB round trip.

Full-house exports require an attached furnished loft with visible floor,
furniture, partitions, ceiling and exterior-wall geometry. The manifest records
loft and roof-window ownership as `house` and includes loft coverage counts.
Duplicate roots and ancestor/descendant root pairs are rejected before cloning.

Generated files stay local under `unreal/generated/`:

- `house-walkthrough.glb`: geometry, embedded material textures and separate door assemblies.
- `manifest.json`: source revision, dirty status and input hashes, metre/Y-up coordinates, bounds, material names and door motion data.
- `export-preview.png`: a render of the reloaded GLB in Three.js for geometry/material inspection, not an Unreal render.

The temporary server only listens on loopback. It serves the selected viewer with a response-only export hook; production HTML is not modified. Three.js comes from the selected viewer's installed version, not a network CDN. The exporter reloads the GLB and checks its bounds before saving it.

## What transfers

Physical segmented walls supply the window and door openings. Roof and gable shader cutouts are converted to triangle geometry on export-only copies. Instanced meshes become ordinary meshes; hidden geometry, labels and lights are excluded. Material textures and base PBR properties are retained. Runtime scene references and environment maps are removed.

Door leaves retain their own parent transforms. The manifest describes their motion; it does not implement interaction or collision in Unreal. Node paths are stable for identical inputs, but hierarchy edits can change them. Reimport preservation of Unreal overrides must be tested before relying on it.

`refresh-import.py` prepares a review candidate for unchanged actor topology.
It imports into a unique `/Game/HouseRefresh/` asset folder without replacing
existing assets, checks actor labels and mesh paths, then duplicates the House
level and updates only that candidate. It reopens the original House afterwards.
The result is `candidate_ready`, not an installed refresh. Incompatible topology
is rejected before candidate updates. Failed candidates and staging assets remain
available for inspection; the script does not delete them.

CPU-only tests cover incompatible labels, successful candidate preparation and
a mesh-binding failure using a substitute for the editor API. This workflow has
not yet run in Unreal. Collision, material overrides, hierarchy, unsaved-level
handling and candidate promotion still require engine validation. Integrated-loft
migration changes topology and is not supported by this same-topology refresh.

## First Unreal session

The local evaluation project is `unreal/project/HouseWalkthrough.uproject`. Open `/Game/Walkthrough/House`, press Play, click the viewport, then use WASD and the mouse. Escape stops play; Shift+F1 releases the pointer. The native walking character has a 36 cm capsule diameter, 170 cm standing eye height and 1.65 m/s walking speed. Doors are currently closed and collidable; their website interactions have not been ported.

The complete generated Unreal project is ignored, including editor-generated configuration and credentials. Only export and editor-automation source files belong in version control. Python scripts run inside Unreal Editor, not in the website or a packaged game.

Editor scripts, in order: `import-scene.py`, `setup-scene.py`, `setup-input.py`, `setup-walking.py`. `capture-scene.py` saves a direct Unreal render to `generated/unreal-lit.png`. `verify-walking.py` runs a short Play-mode movement check and writes `generated/unreal-walk-runtime.json`. The optional `editor-session.py` executes changes to the local `generated/editor-task.py`; it opens no network listener. Do not replace a task until its result reports completion.

Use named `pitch`, `yaw` and `roll` arguments for Unreal rotators. Positional construction does not follow that order.

Launch `editor-session.py` only with trusted local task files. It executes an
existing `generated/editor-task.py` immediately on startup and watches for later
changes. It is not a sandbox. Nothing in the website or verification commands
starts that editor session automatically.

After task-owned render delegates and capture callbacks have been released, a
task can call `result = close_editor_session()`. It unregisters the session's
polling callback and disables Python keep-alive; repeated calls are harmless.
With the command-line Python runner, let that runner finish the exit instead of
calling `SystemLibrary.quit_editor()` directly. Unreal's
`FExecuterTickable::RequestExit` destroys its notification before issuing the
deferred `QUIT_EDITOR` command, allowing the notification ticker to drain.
This ordering passed an isolated native editor exit check. It does not establish
that a render or mirror-capture session is free of separate native shutdown
faults. `verify-editor-session.py` checks the callable cleanup without launching
Unreal.

For a fresh project:

1. Create a local Unreal project. Keep generated engine assets out of the public repository while the workflow is being evaluated.
2. Use **File > Import Into Level** with `house-walkthrough.glb`. Keep mesh hierarchy rather than combining the entire house. The [Interchange documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/importing-assets-using-interchange-in-unreal-engine) describes scene import and reimport.
3. Verify one known opening against the source measurements. The GLB uses metres and Y-up; let the importer handle conversion, then confirm centimetres and Z-up in the editor. Do not scale twice.
4. Set up Lumen with software tracing on supported Mac hardware, daylight and evening lighting. No hardware-ray-tracing dependency is assumed. Check the installed engine's [Mac requirements](https://dev.epicgames.com/documentation/en-us/unreal-engine/macos-development-requirements-for-unreal-engine).
5. Review vinyl, cabinetry, glass and upholstery. Three.js environment maps and shader hooks do not transfer. Glass transmission, bump and emissive material extensions need visual verification in Unreal; they are not proof of lighting parity.
6. Add walk collision and separate movable door leaves. Verify opening, bidirectional passage and safe closing at the eastern portal and two living-room pocket doors.
7. Re-export after one deliberate dimension change and test reimport without losing material overrides or door setup.

## Acceptance checks

- Same dimensions and camera positions as the source viewer.
- No sealed windows, missing ceilings, floating furniture or doubled surfaces.
- Visibly better indirect lighting and reflections at identical viewpoints.
- Record frame rate at a fixed resolution on the target Mac; target at least 30 FPS for the PoC.
- Repeatable reimport after a source edit.
- No Pixel Streaming hosting or public deployment in this phase.

## Verified locally

- Imported 1,403 mesh components. Bounds match the GLB after metre-to-centimetre and Y-up-to-Z-up conversion.
- Direct Unreal captures show cabinetry, vinyl and furniture. Provisional ceiling area lights make the interior inspectable; they do not represent the electrical plan.
- Triangle collision is configured for imported meshes, preserving openings instead of filling them with convex hulls.
- Play mode uses the native ArchVisCharacter. The floor movement check remained in `MOVE_WALKING`, with capsule-centre height approximately 91.4 cm in exported coordinates.
- `yarn unreal:verify` passes. Export verification alone does not prove engine behaviour.

Still pending: daylight/sky calibration, full material review, moving doors, repeated reimport, fixed-view performance measurements and a fair visual comparison against the website. This is a runnable local prototype, not a finished replacement walkthrough.

## Walkthrough video

Enable the Movie Render Queue plugin in the local project and restart Unreal. For
older viewers without an integrated loft, export the supplement with
`node unreal/export.mjs --source-root /path/to/viewer --loft`, then run
`import-loft.py` inside the House level. It has its own asset directory and does
not replace the house import. Do not add this supplement to a house export that
already includes the furnished loft; that would duplicate geometry. Migrating
the existing scene to the integrated house needs a separate import review.
The supplement importer rejects a manifest declaring house-owned loft geometry
before loading the engine API. It does not remove an already imported supplement.

`walkthrough-route.json` defines 22 moving shots covering both floors and the garden. Cuts avoid pretending that the closed doors and attic hatch are traversable. The route is 120 seconds at 24 fps. Exterior shots require an aligned garden import in the local map; the house export alone does not provide those surroundings. Per-shot exposure biases are tuned for the reviewed local lighting and require visual checking in another scene. Run `node unreal/verify-walkthrough-motion.mjs` to check movement, speed and route bounds. Verify actual collision geometry and framing in the imported scene before rendering; source-coordinate checks do not establish live clearance.

Set `generated/video-options.json` to `{"preview":true}` for a one-second output test, `{"preview":false,"frameStep":120}` for one storyboard frame per shot, or `{"preview":false}` for the whole video. Run `render-walkthrough.py` inside Unreal. It creates a separate render queue, outputs 1920×1080 PNG frames under `generated/video-frames/`, and records progress/completion in `generated/video-render.json`.

After a successful full render, validate and encode the frames locally:

```sh
node unreal/encode-walkthrough.mjs
```

The encoder requires a successful complete render, checks every frame, adds optional room-name subtitles and verifies dimensions, frame count, duration and error-free decoding. Its output is `generated/house-walkthrough.mp4` with validation in `generated/video-validation.json`.

The video uses fixed exposure and provisional room lighting. It is a visualisation draft, not a daylight or electrical-lighting simulation. Generated videos, images and engine assets stay local.

### Full-detail fallback geometry

Generate a source manifest with `node unreal/export-fallback-manifest.mjs input.glb output.json`.
It records the GLB hash and each mesh's raw/nondegenerate triangle counts and
position fingerprints. The default input is `unreal/generated/house-walkthrough.glb`.

In an idle Unreal editor, load `unreal/build-full-detail.py` with `runpy.run_path`
and call `start(options)`. Supply `sourceRoot` (the imported `StaticMeshes` asset
folder), a separate `targetRoot`, `manifest` (the manifest file path), and `output`
(the build report file path). Source assets must use the importer's
`house-walkthrough_mesh_<index>` naming. Retain the returned session and return
control to the editor: its ticker builds one mesh at a time. Check
`session['active']` and `session['report']['state']` for completion or failure.

The builder duplicates reduced meshes into the separate asset root, configures
100% fallback triangles without trimming, and saves only those copies. It does
not replace scene components, modify source meshes, or save the level. Matching
reports permit resuming; untracked target assets and overlapping builds are
rejected. Do not delete the report when resuming an interrupted build.

Triangle counts alone do not establish geometric equivalence. After completion,
load `unreal/export-fallback-geometry.py` in the editor and call
`export_geometry(report_path, output_path)` to extract the actual LOD0 sections.
Run `node unreal/verify-fallback-geometry.mjs source.glb extraction.json` outside
the editor and require every mesh to match before using the copies. The command
also accepts a third mesh-index argument for a single raw-section probe.

Position comparison assumes mesh-local geometry imported without pivot baking:
source metres become Unreal float32 centimetres using `[x,z,y] * 100`. It checks
nondegenerate triangle positions independent of winding and indexing, not node
transforms, normals, materials, lighting, or visual quality. Inspect the rendered
result separately. A partial extraction verifies only the included meshes.

`yarn unreal:verify` runs synthetic GLB/section tests and a mocked editor build
lifecycle test using Python 3. Neither requires Unreal or generated house assets.
