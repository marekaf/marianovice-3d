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

## Stereo 360 walkthrough for Meta Quest

The same route can render as a 360 equirectangular video for a headset. Set `generated/video-options.json` to `{"preview":true,"projection":"stereo360","resolution":[1440,720]}` for a one-second test, then `{"preview":false,"projection":"stereo360","durationScale":2}` for the full video. Run `render-walkthrough.py` inside Unreal as before. Enable the **Movie Render Queue Additional Render Passes** plugin (`MoviePipelineMaskRenderPass`) in the local project first; it owns the panoramic pass.

Unreal 5.8 compiles a stereo mode into that pass but leaves its properties without reflection, so no script or editor panel can switch it on. The renderer therefore queues two mono panoramic jobs per frame, one per eye, with the camera moved 3.2 cm left and right of the route across the shot heading. Depth is correct where the viewer faces the heading and fades toward the sides; behind the viewer the eyes are swapped. Set `projection` to `mono360` for a single job with no stereo when comfort matters more than depth.

With a 360 projection the renderer:

- uses the panoramic pass with 8×3 panes, camera orientation followed, and per-pane history so Lumen, auto exposure and TAA work.
- writes 2:1 frames, 5760×2880 by default, at 30 fps under `generated/video-frames-360/` (`left/` and `right/` for stereo), with progress in `generated/video-render-360.json`. Override `resolution` with a 2:1 pair for faster tests.
- keeps one level heading per shot, aimed at the shot's first target. The camera never turns; the viewer turns their head. Flat rendering keeps its look-at motion.
- scales every shot by `durationScale`, so the same translation happens more slowly. Two is a comfortable starting point for a 4-minute tour.
- uses `exposureBias` (EV, default 0) as the bias for every shot, unless the shot has its own `exposureBias360` in `walkthrough-route.json`. The flat video's per-shot `exposureBias` is ignored in 360: a panorama meters the whole sphere, so values tuned for one view do not carry over and stacking them rendered the loft black. The living room measured well exposed at -4 and still clipped at -2; in the garden level interiors sit at -3.25, small-window rooms and the loft at -3 and exteriors at -5.5. The house-only level needs very different values because its windows look onto a bright void. A 360 bias of 0 still overrides the level's own exposure volume.
- keeps a scene history per pane unless `paneHistory` is `false`. Each pane's history lives in GPU memory for the whole job; a 150-frame shot at 1440×720 pushed the local Mac into heavy swap and frame times grew from 20 s to over 100 s. Try `paneHistory: false` first and check the preview for black or flickering panes before choosing.

Each frame renders 24 panes per eye, so the full video takes far longer than the flat render. The 1440×720 stereo preview took about eleven minutes for its 30 frames per eye on the local Mac. Check the preview on the headset before committing to the full run. Motion blur, vignette, depth of field and chromatic aberration should stay off in the local post-process volume; they break stereo fusion.

Encode the frames with:

```sh
node unreal/encode-walkthrough.mjs --stereo360
```

Use `--mono360` for the single-eye render and add `--preview` to encode a one-second preview render into a `-preview.mp4` file. The stereo output is `generated/house-walkthrough-360-tb.mp4`: the two eyes stacked top-bottom into a square H.265 stream in a faststart MP4 tagged `hvc1`, 4:2:0, with a half-second fade through black at every cut and no subtitle track. The encoder then injects Spherical Video V1 metadata (equirectangular, top-bottom or mono) into the video track and checks with `ffprobe` that the projection and layout read back. Validation lands in `generated/video-validation-360.json`.

To watch it, copy the file to the headset over USB or Meta Quest Developer Hub and open it from the Files app, choosing 360 and top-bottom if the player does not detect the layout. The Meta Quest Browser also plays it from an HTTPS URL in fullscreen with the 360 top-bottom projection selected. An unlisted YouTube upload works too; YouTube reads the injected metadata.

`node unreal/verify-spherical-metadata.mjs` checks the metadata injector, `node unreal/verify-encode-walkthrough.mjs` runs the encoders on synthetic frames when ffmpeg is available, and `python3 -I unreal/verify-panoramic-render.py` checks the sequence headings, eye offsets and queue configuration without Unreal.

## Stereo 360 still tour

A tour of stills costs one frame per route position instead of thirty per second, so every position renders at full size in one night. Set `generated/video-options.json` to `{"preview":false,"projection":"stereo360","stills":true,"exposureBias":-4}` and run `render-walkthrough.py` inside Unreal. With `stills` on, each shot becomes a one-frame cut at the shot's start position and heading; `shotNames` still limits the set. Frames land in `generated/video-frames-360/left` and `right`, numbered in route order.

Export the stills with:

```sh
node unreal/export-tour.mjs
```

This writes `generated/tour/<index>-<room>_360_TB.jpg`, the two eyes stacked top-bottom, plus `generated/tour/tour.json` with the shot heading and floor hotspots to the previous and next positions. The hotspot azimuth is the target's Unreal yaw minus the shot heading, positive to the right, which `verify-tour.mjs` checks against known positions. The `_360_TB` name tags let DeoVR and similar players open the JPEGs directly from the headset.

`tour.html` at the repository root shows the tour in the browser and in VR. Serve the repository over HTTP or HTTPS, open `tour.html`, drag to look around, and click a green floor disc or use the Previous and Next buttons to move between positions. On the Quest browser, Enter VR shows each eye its own half; the panorama centre faces the shot heading. Run `node verify-tour-browser.mjs` with Chrome available to check the image orientation, eye layout and hotspot navigation against a synthetic panorama.

## Levels are snapshots: refresh before rendering

An Unreal level holds whatever the viewer looked like on the day of its import. Nothing keeps it in step with the website model. In September 2026 a full tour was rendered from a level imported on the ninth, and it showed a key hanger and network rack on their old walls, non-reflective mirrors, exposed roof sheeting in the loft and a stairwell ledge that the viewer had fixed days earlier. `/Game/Walkthrough/House` also contains the house alone, so exteriors rendered over a black void and interiors metered against it.

Before any render that matters:

1. Export the current viewer: `PLAYWRIGHT_MODULE=<path>/playwright-core/index.mjs node unreal/export.mjs --source-root <clean checkout of main>`. It takes under a minute.
2. Compare it with what Unreal has. Load the old and new GLB in three.js and compare the bounds of named objects such as `keyMetal`, `UniFi_12U_wall_rack` and the mirror materials' metalness. Moved bounds or changed materials mean the level is stale.
3. Rebuild the level. Write `generated/rebuild-level.json`, for example `{"sourceLevel":"HouseGardenSync20260913","newLevel":"HouseFresh20260918","assetFolder":"HouseFresh20260918","replaceAssetFolders":["HouseVideo20260910_1702","HouseSync20260913","AtticSync20260914","HouseFullDetail20260910","StairSync20260913V2","HouseBase20260910","HangerJoint20260911"]}`, and run `rebuild-level.py` inside the editor. It copies the source level, removes only the static meshes that come from the listed import folders, prunes the hierarchy groups they leave empty, keeps garden, terrain context, lights, sky and the exposure volume, imports `generated/house-walkthrough.glb` into the new asset folder, and refuses to overwrite an existing level or folder. List a level's import folders by grouping its static mesh actors by the second path segment of their mesh.
4. Render with `"level": "<newLevel>"` in `video-options.json`, and load that map in the task before calling `render()`. The renderer refuses to run when the loaded map and `level` differ. The default stays `House` for the existing flat video.

The garden and terrain context are their own imports and go stale the same way. In equirectangular stills, roof windows near the zenith stretch into wide blue bands; that is projection, not a missing roof.

## Rendering on a Windows PC

An Nvidia desktop card renders the panoramic pass far faster than the Mac: one 5760×2880 stereo still took about eleven minutes on an RTX 5080, against roughly two hours per still estimated on the M3 Pro. Copy the project's `Config` and `Content` folders and this `unreal/` directory to the PC, install the same engine version, and keep both plugins enabled in the `.uproject`. macOS `tar` adds `._*` sidecar files; delete them after copying or Unreal reports broken assets.

Four settings make the Windows render match the Mac and stay alive:

- Add a Windows target block to the PC copy of `Config/DefaultEngine.ini` so D3D12 runs Shader Model 6. On SM5 Lumen is off and interiors render pale and flat.

  ```ini
  [/Script/WindowsTargetPlatform.WindowsTargetSettings]
  DefaultGraphicsRHI=DefaultGraphicsRHI_DX12
  -D3D12TargetedShaderFormats=PCD3D_SM5
  +D3D12TargetedShaderFormats=PCD3D_SM6
  ```

- Set `r.Shadow.Virtual.Enable=0` in the same file. Virtual Shadow Maps hit a GPU timeout inside Nanite culling during the 5760 panoramic warm-up.
- Set `"serialRenderGraph": true` in `video-options.json`. With parallel render-graph execution the pass fails with "Too many residency sets are open concurrently", and that fatal error leaves the Nvidia driver hung: every later editor start ends in `DXGI_ERROR_DEVICE_HUNG` until the PC reboots.
- Keep a user logged in on the PC desktop. An editor started without a desktop session loses its D3D12 device two seconds after start. A locked screen is fine.

To drive the PC from another machine over SSH, start the editor detached from the SSH session, for example with PowerShell's `Invoke-CimMethod -ClassName Win32_Process -MethodName Create`, using `UnrealEditor-Cmd.exe <project> /Game/Walkthrough/House -ExecutePythonScript=<unreal>/editor-session.py -RenderOffscreen -unattended -nosplash -log -abslog=<log>`. A child of the SSH session dies when the session closes. Copy task files into `generated/` with `scp`; the session script picks them up as on the Mac. For a visible editor with the Movie Render Queue progress window, start `UnrealEditor.exe` with the same arguments, minus `-RenderOffscreen` and `-unattended`, from the PC desktop.

Each still costs 32 warm-up frames per eye, so the 22-position stereo tour takes about four hours even on the PC. Test any new setting at `mono360` and 2880×1440 first: a failed experiment at full size can cost a reboot.

