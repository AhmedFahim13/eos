# How open try-on models handle Bangladeshi clothing

Runs so far: 0. Updated 2026-09-24. Live page: /bench.

| model | garment | attempts | generated | judged right |
|---|---|---|---|---|

## Method

Openly licensed photos of women (Pexels; sources, licences and credits in `data/bench/people.json`) × two pieces per garment type from the live catalog × each model that accepts that type. Each output is scored by the same judge that runs in the app: garment colour present (share of the garment region within CIELAB ΔE 25 of a tagged colour), same person (difference hash of the head region), outfit changed (mean ΔE across the garment region).

Judge agreement with human ratings: not calibrated yet.
The catalog tagger chose the right garment type for 88% of 60 pieces and the right main colour for 77%, checked against labels from a second AI model (Claude, labelling blind from the product photo and name), not a person. Most misses are two-piece sets tagged as three-piece: brands sell a kameez with dupatta as a two-piece and photograph it with trousers.

## Limits

Small sample: treat differences under about 15 points as noise. Regions are fixed fractions of a portrait, so crops and poses outside the norm are judged less reliably. Garment colours come from the vision tagger, not a measurement.
