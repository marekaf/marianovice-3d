# Asset manifest

All assets from Poly Haven (polyhaven.com), license CC0 (public domain). 2k resolution.

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

## Models (2k .blend + packed textures)

| Dir | Use | Source | License |
|---|---|---|---|
| models/shrub_02/ | garden shrubs | https://polyhaven.com/a/shrub_02 | CC0 |
| models/shrub_03/ | garden shrubs | https://polyhaven.com/a/shrub_03 | CC0 |
| models/shrub_04/ | garden shrubs | https://polyhaven.com/a/shrub_04 | CC0 |
| models/shrub_sorrel_01/ | perennial beds | https://polyhaven.com/a/shrub_sorrel_01 | CC0 |
| models/fern_02/ | perennial beds | https://polyhaven.com/a/fern_02 | CC0 |
| models/flower_empodium/ | meadow flowers | https://polyhaven.com/a/flower_empodium | CC0 |

## Tools (code, not scene assets)

| File | Source | License |
|---|---|---|
| addons/sapling_tree_gen-0.3.7.zip | https://extensions.blender.org/add-ons/sapling-tree-gen/ | GPL-2.0-or-later |

Deciduous trees are generated at build time with the Sapling Tree Gen addon
(official Blender extension, not bundled with 5.2; poc.py enables it as
bl_ext.user_default.sapling_tree_gen). The leaf texture is generated procedurally
by poc.py (no external asset).
