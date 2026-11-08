# Entrance stairs and Luneta retaining wall

Shape coordination proposal, 8 November 2026. Dimensions are in millimetres unless noted. This is a dimensioned shape sketch, not a foundation, reinforcement or drainage design. Confirm the setting-out levels, wall system, post footing and drainage before construction.

## Sources and interpretation

The private builder sketch `stairs-luneta.pdf` dated 2026-11-08 and the architect's C.3 and C.4 site drawings were visually reviewed. The sibling project's `project/site-plan.md` identifies those drawings; no source drawings are copied into this public repository.

| Geometry | Architect C.4 | Builder sketch | Previous viewer |
| --- | --- | --- | --- |
| Upper/lower finish, m Bpv | 397.000 / 396.490 | 397.000 / 396.490 | Graded paving, not a fixed lower level |
| Width along facade | 3150 | Upper 1500; bottom approximately 2150 | 1425 |
| Landing depth in facade recess | 700 | 700 inferred from the site geometry | 680 |
| Projection beyond outer facade | 550 | 600 | 660 |
| Treads | Two bands, interpreted as 275 each | Two bands, interpreted as 300 east and 325 south | Two at 340 |
| Rises | Three inferred, nominal 170 | Three inferred, nominal 170 | Three, computed from local paving |
| Retaining wall | No Luneta schedule | Zig-zag Luneta outline, short garden return | Plain narrow edge |

The builder's 600 dimension starts at the outer facade, not at the recessed entrance. Overall projection from the entrance facade is therefore 1300. Riser counts and individual tread dimensions above are interpretations; neither drawing explicitly schedules them.

C.4's 3150 span runs from its terrace end to the facade return. The retained model terrace ends at z=19.230, 3300 mm from the nominal return at z=22.530. This 150 mm difference is retained rather than moving the terrace; proposed wall lengths follow the current model and need setting-out confirmation.

`stair-flight-model.js` builds the indoor stair flight and is not the entrance stair source. `entrance-landing.js` supplies the measured door reveal and retains the prior entrance builders for comparison. `entrance-luneta-model.js` supplies the new outdoor geometry to the browser and Blender export.

## Recommended geometry

Use the builder's wrapping shape: landing 700 deep and 1500 wide, two east-facing goings of 300, southern widening of 325 per step, total lower width 2150. The south-facing tread strips stop at the outer house facade, rather than extending through the house footprint.

The `sketch` variant uses the nominal south facade return at plot z=22.530. The default `aligned` variant shifts the assembly 22.5 mm south to meet the end of the modelled entrance opening at z=22.5525. This is a coordination variant, not a measured correction to the builder's drawing. The nominal footprint and detailed door model disagree at this corner; verify the actual jamb and facade return on site. The door and house geometry are not moved.

The September graded carport falls from 396.490 to 396.480 m Bpv. At the aligned lower southern corner it is 396.484606 m: total rise 515.394 mm, giving three equal model rises of 171.798 mm. The north contact is about 3.05 mm higher. The bottom riser therefore varies slightly across the sloping paving; do not set three 170 mm risers against the existing model grade. Recalculate from the surveyed finished levels. The PDF shows both nominal and model values.

The drawing is horizontal finished geometry: falls on treads, bedding, waterproof junctions and a drainage outlet remain to be detailed. The high timber-post footing mentioned in the builder's sketch has no surveyed size or level in these inputs; its concealment and separation from timber cannot be verified here.

## Retaining wall proposal

The model uses the outer envelope of [BEST LUNETA](https://www.best-as.cz/best-luneta-iv/colormix-brilant): nominal blocks 400 long, 200 wide and 200 high. It does not model cavities or reinforcement. Four courses give 800 overall height, with top at 397.000 and bottom at 396.200 m Bpv. Approximately 285 mm is concealed at the stair paving and 200 mm at the 396.400 garden level. The retained height is approximately 510-515 mm beside the parking and 600 mm beside the terrace; it is not constant across the wall.

The stair-side wall, recess edge and terrace return are located from the current model. Their lengths and the short garden return are proposed setting-out dimensions, not dimensions supplied by the sketch. The wall beyond the terrace is a proposed return around raised fill; confirm its extent against the final garden grading. The builder's continued low curb toward the garage is conditional on actual terrain and is not replaced by a full-height wall.

Four courses are a geometric allowance, not a structural approval. The builder/designer must determine foundation level and width, reinforcement and concrete fill, joints, drainage/filtering, water outlet and palisade embedment. The model's fill and buried palisades depict support volume, not specified construction layers or stock lengths. End blocks may need cutting; the PDF is not a purchasing schedule.

## Preview and verification

Serve the repository over HTTP. The default viewer uses `aligned`; append `?entrance=sketch` for the source interpretation. Run `node verify-entrance-luneta.mjs` for geometry and grading checks, and `node verify-entrance-stairs-browser.mjs` for both rendered variants. The browser check closes Chrome after capture.

Run `node generate-entrance-luneta-pdf.mjs` to generate ignored `docs/entrance-luneta.pdf` and its 3D image. The PDF includes plan, section, wall course dimensions and a 3D view from the same model. Run `yarn verify` for the full repository gate.
