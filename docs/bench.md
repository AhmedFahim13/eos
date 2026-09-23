# How open try-on models handle Bangladeshi clothing

Runs so far: 0. Updated 2026-09-23. Live page: /bench.

| model | garment | attempts | generated | judged right |
|---|---|---|---|---|

## Method

Five openly licensed photos of South Asian women (sources and licences in `data/bench/people.json`) × two pieces per garment type from the live catalog × each model that accepts that type. Each output is scored by the same judge that runs in the app: garment colour kept (CIELAB ΔE against the tagged colour), same person (difference hash of the head region), outfit changed (mean ΔE across the garment region).

Judge agreement with human ratings: not calibrated yet.
Tagger accuracy: not scored yet.

## Limits

Small sample: treat differences under about 15 points as noise. Regions are fixed fractions of a portrait, so crops and poses outside the norm are judged less reliably. Garment colours come from the vision tagger, not a measurement.
