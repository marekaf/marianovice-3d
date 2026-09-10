# Garage roof levels

Section 301 gives garage finished floor −0.500 m, western roof +3.000 m
and eastern roof +2.300 m, all relative to the house finished floor.
The corresponding roof heights above the garage floor are 3.500 and 2.800 m.

The drawing labels 6 degrees and a 6480 mm rafter. The model retains the existing
3.500 m ridge and 2.800 m east-wall roof datum above the garage floor. With the
documented ridge offset, that gives approximately 6.25 degrees. It does not claim
simultaneous exact agreement with the rounded elevation labels and 6 degree pitch.

Architectural plan 101 and structural floor plan 3 agree on a 6500 × 7050 mm
garage footprint: 6000 × 6550 mm internally plus two 250 mm walls. The current
model footprint matches both drawings.

Roof plan 103 separately dimensions 7150 mm north–south, made up of the
7050 mm wall footprint and 50 mm at each end. These are roof-edge projections,
not a larger garage room. The garden garage and carport roof geometry includes
these 50 mm projections, with its 7150 mm total extent checked directly from
generated vertices. Export source code uses the same dimension, but a fresh
render/export has not been run.

The east roof edge also projects 50 mm, ending at model x=34.18 rather than
34.43. Both the skin and standing-seam centrelines use that endpoint and retain
the east-wall height. Export source uses the same projection.

Roof plan 103 dimensions the horizontal chain as 6000 + 110 + 6390 + 50 mm.
The ridge is 110 mm east of the garage's west outside wall, at model x=27.740.
Both roof skins and seam centrelines now meet there instead of overlapping across
different endpoints. The 6440 mm ridge-to-east-edge run also agrees within about
5 mm with the horizontal projection of section 301's 6480 mm rafter at 6 degrees.
Wall caps split at the ridge so they follow both roof planes; interior ceilings
and roof-mounted equipment follow the east-falling plane.

The plan's 6000 mm carport dimension begins at the house roof edge x=21.630.
The model's west endpoint x=21.280 retains 350 mm concealed beneath that eave.
This does not change the carport ground footprint or post positions. The plate's
underside and post tops follow its roof datum; the two metal top faces meet.

Both roof plan 103 and section 301 specify a 2 degree carport fall westward.
The plate, seams and supporting posts now follow that slope. The existing
ridge height is retained; the west edge is derived from the shared pitch and
corrected span. Geometry checks cover the plate and seams;
export source is updated without a fresh render.

Plan 103's ridge label appears to say +3.500, while section 301 labels the
peak +3.000 above house finished floor and garage floor −0.500. The datum
relationship is unresolved; do not use the apparent label to raise the ridge.

The dashed stepped line in section 301 is not labeled as a finished soffit.
Do not derive ceiling steps from it without identifying that line. A continuous
sloping ST04 underside is shown above it. The present interior finish remains
illustrative while conflicting timber/plasterboard notes are reconciled.
