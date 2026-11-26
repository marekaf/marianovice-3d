# Photoreal pictures from the model

Two steps. A plain render of the garden model fixes the geometry and the camera. Codex then paints a photoreal picture over it from a text prompt.

Run `yarn install` first. The render needs Chrome; the picture step needs the `codex` CLI with a login that can use its image tool.

## 1. Render a view

```sh
node scripts/pictures/render-view.mjs views.json out/ [name ...]
```

`views.json` maps a file name to a camera. The script loads `index.html`, waits for the whole garden, and writes `out/<name>.png` at 1536 x 1024 for each view, or only for the names given.

```json
{
  "sauna-model-house": {"eye": [10.3, 1.65, 7.4], "look": [4.8, 1.2, 3.2], "fov": 55, "hour": 15},
  "pergola-model-house": {"eye": [22.5, 1.65, 12.5], "look": [25.4, 1.2, 3.7], "fov": 55, "hour": 15}
}
```

- `eye` is `[x, height above the ground, z]` and `look` is the point the camera faces, also with its height above the ground at that point. x and z are the `layout.js` coordinates in metres.
- `pos` instead of `eye` takes an absolute `[x, y, z]`, and `look` is then absolute too.
- `fov` is the vertical field of view in degrees (default 50), `hour` and `day` set the sun (defaults 14 and day 172).

The output line of each view prints the camera position used. Chrome without a GPU renders on the CPU and needs about two minutes to load the garden; `CHROME_PATH` points the script at another Chrome binary.

## 2. Make the picture

```sh
node scripts/pictures/gen.mjs out/ sauna-v1-house out/sauna-model-house.png place.txt variant.txt tail.txt
```

The prompt files are joined in order and every `NAME` in them becomes the picture name. Codex gets the render with `-i` and writes `out/<name>.png`. Several renders are joined with commas and all go to Codex. The script refuses a name that already exists, so a new variant needs a new name. It prints the Codex tokens used. The prompt, log and Codex reply go to `$PICTURE_WORK/<name>` (default `model-pictures` in the system temp directory).

A prompt in three parts kept the geometry in earlier runs:

1. The place: say that the attached image is a plain 3D render to use as the exact scene and camera, list what must not move (camera, lens, building size and openings, paths, fence, plants) and forbid added buildings. Then describe each object with its real dimensions.
2. The variant: materials, colours and finishes, one file per variant, so a change of finish reuses the place file.
3. The tail: light and photography, forbidden content (text, labels, logos, watermarks, frames), and the instruction to save `NAME.png` in the current directory and reply with its path only.

A picture costs about 15 000 to 22 000 Codex tokens. Codex can still move the camera closer than the render or add greenery beyond the fence, so compare each picture with its render.
