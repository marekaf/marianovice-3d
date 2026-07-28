# Asset manifest

All assets from Poly Haven (polyhaven.com), license CC0 (public domain), except
`leaf_generated.png` (see Generated below).
Textures and the original shrub/fern/flower models are 2k; the tree and grass-clump
models added for the real-plant pass are 1k (their geometry, not texture resolution,
is what makes them heavy).

## HDRI

The day shots (iso/walk/living/terrace) light and background off the 4k sky; `hdri_env`
picks the largest sky file present, so the 2k is kept only as a lightweight fallback.

| File | Source | License |
|---|---|---|
| hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 |
| hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 |

## Generated

| File | Use | Source | License |
|---|---|---|---|
| leaf_generated.png | fallen-leaf/twig ground litter cards | procedurally generated in-repo | CC0 |

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
| models/pine_tree_01/ | 1k | perimeter conifer (native pine) | https://polyhaven.com/a/pine_tree_01 | CC0 |
| models/fir_tree_01/ | 1k | perimeter conifer (native fir/spruce) | https://polyhaven.com/a/fir_tree_01 | CC0 |
| models/tree_small_02/ | 1k | orchard + young perimeter broadleaf | https://polyhaven.com/a/tree_small_02 | CC0 |
| models/shrub_01/ | 1k | garden shrubs | https://polyhaven.com/a/shrub_01 | CC0 |
| models/shrub_02/ | 2k | garden shrubs | https://polyhaven.com/a/shrub_02 | CC0 |
| models/shrub_03/ | 2k | garden shrubs | https://polyhaven.com/a/shrub_03 | CC0 |
| models/shrub_04/ | 2k | garden shrubs | https://polyhaven.com/a/shrub_04 | CC0 |
| models/shrub_sorrel_01/ | 2k | perennial beds | https://polyhaven.com/a/shrub_sorrel_01 | CC0 |
| models/fern_02/ | 2k | perennial beds | https://polyhaven.com/a/fern_02 | CC0 |
| models/flower_empodium/ | 2k | perennial beds + meadow flowers | https://polyhaven.com/a/flower_empodium | CC0 |
| models/grass_medium_01/ | 1k | ornamental-grass clumps in beds | https://polyhaven.com/a/grass_medium_01 | CC0 |

Poly Haven ships these .blend files referencing their textures via relative
`//textures/<map>` paths; the matching maps are downloaded into each model's
`textures/` subdir so the paths resolve. Tree variants (`_a/_b/_c_LOD1`) are static
baked meshes — poc.py appends them as templates and linked-duplicates them, so N
trees of a species share one mesh datablock.

Trees are real scanned/geometry-node models, no longer procedural. Poly Haven has no
CC0 European deciduous or fruit tree, so the two native conifers cover the perimeter
screen and the one CC0 broadleaf (tree_small_02, African wild syringa) stands in by
silhouette for the orchard and young deciduous accents. The Sapling addon zip may
still sit in addons/ but is unused.
