# Asset manifest

Two asset sources. Poly Haven (polyhaven.com), license CC0, covers the ground textures,
HDRI, shrubs, ferns, flowers and grass clumps. The primary canopy tree and the flowering
accents are client-supplied .blend files downloaded from Fab — kept out of git (gitignored)
and NOT redistributed here; check each asset's own Fab licence before any commercial use of
the renders. Poly Haven textures/shrub/fern/flower models are 2k; the CC0 tree and grass
models are 1k (their geometry, not texture resolution, is what makes them heavy).

## HDRI

| File | Source | License |
|---|---|---|
| hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 |

## Textures (diff + nor_gl + rough, 2k)

| Dir | Use | Source | License |
|---|---|---|---|
| textures/leafy_grass/ | lawn/ground | https://polyhaven.com/a/leafy_grass | CC0 |
| textures/bark_brown_02/ | tree trunks | https://polyhaven.com/a/bark_brown_02 | CC0 |
| textures/plastered_wall_02/ | house/garage walls | https://polyhaven.com/a/plastered_wall_02 | CC0 |
| textures/clean_asphalt/ | driveway/parking | https://polyhaven.com/a/clean_asphalt | CC0 |
| textures/metal_plate_02/ | standing-seam roof | https://polyhaven.com/a/metal_plate_02 | CC0 |
| textures/gravel_floor_02/ | fire-pit apron | https://polyhaven.com/a/gravel_floor_02 | CC0 |
| textures/dark_rock/ | fire-pit rocks, pond rim | https://polyhaven.com/a/dark_rock | CC0 |

## Models (.blend + external textures in each model's textures/ subdir)

| Dir | Res | Use | Source | License |
|---|---|---|---|---|
| models/island_tree_01/ | 1k | secondary perimeter broadleaf | https://polyhaven.com/a/island_tree_01 | CC0 |
| models/island_tree_03/ | 1k | orchard + young perimeter broadleaf | https://polyhaven.com/a/island_tree_03 | CC0 |
| models/tree_small_02/ | 1k | orchard broadleaf (wild syringa) | https://polyhaven.com/a/tree_small_02 | CC0 |
| models/shrub_01/ | 1k | garden shrubs | https://polyhaven.com/a/shrub_01 | CC0 |
| models/shrub_02/ | 2k | garden shrubs | https://polyhaven.com/a/shrub_02 | CC0 |
| models/shrub_03/ | 2k | garden shrubs | https://polyhaven.com/a/shrub_03 | CC0 |
| models/shrub_04/ | 2k | garden shrubs | https://polyhaven.com/a/shrub_04 | CC0 |
| models/shrub_sorrel_01/ | 2k | perennial beds | https://polyhaven.com/a/shrub_sorrel_01 | CC0 |
| models/fern_02/ | 2k | perennial beds | https://polyhaven.com/a/fern_02 | CC0 |
| models/flower_empodium/ | 2k | perennial beds + meadow flowers | https://polyhaven.com/a/flower_empodium | CC0 |
| models/grass_medium_01/ | 1k | ornamental-grass clumps in beds | https://polyhaven.com/a/grass_medium_01 | CC0 |

## Client-supplied plants (Fab downloads, gitignored, NOT redistributed)

| Path | Use | Notes |
|---|---|---|
| models/maple_freeman/maple_freeman.blend | primary canopy | Acer x freemanii (Freeman maple), 3 sizes (~6.8/9.8/10.2 m), packed textures |
| models/plants/daisy_white/pink/red.blend | flower-bed colour accents | ~1.8 m marguerite bushes, joined to one mesh each, packed |
| models/plants/roses.blend | pergola + terrace beds | ~1 m rose shrub, packed 4k atlas |
| models/plants/wood_logs.blend | firewood by the sauna | packed bark textures |
| models/plants/tomato.blend | edible raised beds | stylized, 3 growth stages, text labels stripped |

Poly Haven ships its .blend files referencing textures via relative `//textures/<map>`
paths; the matching maps are downloaded into each model's `textures/` subdir so the paths
resolve. The client plant .blend files have their textures packed in-file. Tree/plant
templates are appended once and linked-duplicated, so N instances of a species share one
mesh datablock.

Trees are real scanned/geometry-node models, no longer procedural, and no longer conifers.
The Freeman maple (3 ready-grown sizes) is the dominant species across the perimeter screen
and orchard; the CC0 island/wild-syringa broadleaves are minority silhouettes for variety.
pine_tree_01, fir_tree_01, jacaranda_tree and island_tree_02 remain on disk but are
deliberately unused. The Sapling addon zip may still sit in addons/ but is unused.
