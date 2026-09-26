# How open try-on models handle Bangladeshi clothing

Runs so far: 24. Updated 2026-09-26. Live page: /bench.

| model | garment | attempts | generated | judged right |
|---|---|---|---|---|
| OOTDiffusion | saree | 4 | 100% | 75% |
| IDM-VTON | saree | 2 | 100% | 100% |
| OOTDiffusion | three-piece salwar kameez | 4 | 100% | 50% |
| IDM-VTON | three-piece salwar kameez | 1 | 100% | 0% |
| OOTDiffusion | two-piece set | 3 | 100% | 67% |
| OOTDiffusion | bottom | 2 | 100% | 100% |
| OOTDiffusion | kurti | 2 | 100% | 100% |
| IDM-VTON | kurti | 2 | 100% | 100% |
| IDM-VTON | top | 2 | 100% | 100% |
| OOTDiffusion | top | 2 | 100% | 100% |

## Method

Openly licensed photos of women (Pexels; sources, licences and credits in `data/bench/people.json`) × two pieces per garment type from the live catalog × each model that accepts that type. Each output is scored by the same judge that runs in the app: garment colour present (share of the garment region within CIELAB ΔE 25 of a tagged colour), same person (difference hash of the head region), outfit changed (mean ΔE across the garment region).

Judge agreement with human ratings: not calibrated yet.
Catalog tagger, on a held-out test set of 60 pieces labelled blind before any tuning: right garment type 98%, right colour family 92%, exact shade name 77%. Reference labels were made by a second AI model (Claude), not a person; the remaining colour misses are mostly printed sarees whose colour is itself debatable.

## Limits

Small sample: treat differences under about 15 points as noise. Regions are fixed fractions of a portrait, so crops and poses outside the norm are judged less reliably. Garment colours come from the vision tagger, not a measurement.
