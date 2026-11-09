# Entrance stairs and Luneta retaining wall

Shape coordination proposal, 9 November 2026. Dimensions are in millimetres unless noted. This is a dimensioned shape sketch, not a foundation, reinforcement or drainage design. Confirm the setting-out levels, wall system, post footing and drainage before construction.

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

Use a straight front: landing 700 deep and 1500 wide, two east-facing goings of 300, total footprint 1300 × 1500. There is no southern wrap. The default `straight` variant meets the detailed entrance opening at plot z=22.5525. The `sketch` and `aligned` wrapping variants remain comparison geometry: their southern riser crosses the middle carport post. They are not recommended for construction.

The owner places the middle post approximately 350 mm south of the facade return. Model axes are x=21.405 for all three posts, z=19.475 north, 22.880 middle and 26.355 south. This is 125 mm east of the outer facade at x=21.280. Architectural drawings show 150 mm posts while the structural drawing shows 140 mm; the model uses 150 mm pending confirmation. Always include all three carport supports when coordinating stairs, terrain and drawings; identify off-sheet supports explicitly.

The nominal middle footing envelope is 600 × 600 mm. Its northern edge at z=22.580 is only 27.5 mm from the straight stair footprint at z=22.5525. This is a provisional plan gap, not a verified separation, excavation clearance or foundation approval. The nominal north footing also overlaps the proposed Luneta wall by 25 mm in plan: its east edge x=21.705 passes the wall inner face x=21.680. Resolve this clash from surveyed footing geometry and agreed wall setting out before construction. The existing high footing's actual dimensions and elevation are unknown. Survey it before construction; do not assume it can be buried beneath steps or altered. The PDF shows dashed nominal footing outlines only, without an invented vertical envelope. The 3D illustration cuts the two nearby posts at FFL +1.000 m for visibility; this is not their actual height. The southern post is off the drawing's view.

The nominal house footprint returns at z=22.530, whereas the detailed door ends at z=22.5525: a 22.5 mm mismatch. Confirm the actual jamb and facade return on site. The door and house geometry are not moved.

The September graded carport falls from 396.490 to 396.480 m Bpv. At the straight lower southern corner, the modelled drop is 514.472 mm, giving three equal reference rises of 171.491 mm. The bottom riser varies slightly across sloping paving. Recalculate from surveyed finished levels; the nominal drawing drop of 510 mm implies 170 mm, not the current graded model value. For comparison, the former aligned wrapping shape used a 515.394 mm drop and 171.798 mm rises because its lower corner extends farther south.

The drawing is horizontal finished geometry: tread falls, bedding, waterproof junctions and a drainage outlet remain to be detailed. The straight option avoids the timber post itself, but its foundation coordination remains a construction hold point.

The whole entrance recess is paved continuously at house finished-floor height, matching the terrace boards. The 1100 mm-wide rear recess joins the 700 mm-deep upper landing through paving, with no transverse wall across the walking connection. The stair-side Luneta remains along the exposed 600 mm-wide tread edge. The eastern L-shaped return contains lawn at the same finished level, not exposed soil. These finishes do not set drainage falls or replace the required threshold waterproofing detail.

## Retaining wall proposal

The model uses the outer envelope of [BEST LUNETA](https://www.best-as.cz/best-luneta-iv/colormix-brilant): nominal blocks 400 long, 200 wide and 200 high. It does not model cavities or reinforcement. Four courses give 800 overall height, with top at 397.000 and bottom at 396.200 m Bpv. Approximately 285 mm is concealed at the stair paving and 200 mm at the 396.400 garden level. The retained height is approximately 510-515 mm beside the parking and 600 mm beside the terrace; it is not constant across the wall.

The stair-side wall, recess edge and terrace return are located from the current model. Their lengths and the short garden return are proposed setting-out dimensions, not dimensions supplied by the sketch. The wall beyond the terrace is a proposed return around raised fill; confirm its extent against the final garden grading. The builder's continued low curb toward the garage is conditional on actual terrain and is not replaced by a full-height wall.

Four courses are a geometric allowance, not a structural approval. The builder/designer must determine foundation level and width, reinforcement and concrete fill, joints, drainage/filtering, water outlet and palisade embedment. The model's fill and buried palisades depict support volume, not specified construction layers or stock lengths. End blocks may need cutting; the PDF is not a purchasing schedule.

## Preview and verification

Serve the repository over HTTP. The default viewer uses `straight`; append `?entrance=aligned` or `?entrance=sketch` for the wrapping comparisons. Run `node verify-entrance-luneta.mjs` for geometry and grading checks, and `node verify-entrance-stairs-browser.mjs` for all three rendered variants. The browser check closes Chrome after capture.

Run `node generate-entrance-luneta-pdf.mjs` to generate ignored `docs/entrance-luneta.pdf` and its 3D image. The PDF includes plan, section, wall course dimensions and a 3D view from the same model. Run `yarn verify` for the full repository gate.
