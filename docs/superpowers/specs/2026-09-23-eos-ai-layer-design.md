# Eos AI layer: Bangladeshi catalog, trustworthy try-on, and a try-on benchmark

Date: 2026-09-23. Status: approved in brainstorming, awaiting spec review.

## 1. Purpose

Eos stays what it is: a place where a customer sees how she will look in a piece before
buying it. This work changes three things underneath that promise.

1. The catalog becomes real Bangladeshi women's wear instead of foreign Shopify brands.
2. Try-on runs at zero cost and every result is checked before the customer sees it.
3. The same checker powers a published benchmark of how open try-on models handle
   Bangladeshi clothing, which no one has measured.

It is also the AI centrepiece of Fahim's portfolio for a product-management role at Advanced
AI Lab Limited, Dhaka. Every decision must survive "why this and not something bigger".

## 2. Constraints

- Production cost is zero taka. Free tiers only: Vercel Hobby, GitHub Actions, Hugging Face
  ZeroGPU Spaces, Gemini API free tier (Flash-Lite).
- The demo must never break in front of a recruiter. Every AI call has a fallback that still
  shows something honest.
- AI is called where it earns its keep. Anything that can be computed once is computed once,
  offline, and cached.
- Customer photos are never stored. They pass through the server route to the try-on model
  and are dropped. The UI says which third party receives them.
- Catalog data comes only from public product feeds. Every piece links back to the brand's
  own product page.

## 3. Verified facts (2026-09-23)

- Public feeds exist for Yellow and Twelve (Shopify `/products.json`), Dorjibari (Shopify),
  and Kay Kraft (WooCommerce `/wp-json/wc/store/v1/products`); all returned products with
  images. Richman, Lubnan and Easy also have feeds but are almost all menswear, so they are
  out of scope. Aarong, Le Reve, Sailor, Cat's Eye, Infinity, Ecstasy, Deshal and Sara have
  no feed and are not scraped.
- Hugging Face Spaces `yisol/IDM-VTON` and `levihsu/OOTDiffusion` run on free ZeroGPU;
  `Kwai-Kolors/Kolors-Virtual-Try-On` runs on CPU-upgrade hardware. `zhengchong/CatVTON` was
  in a runtime error. ZeroGPU quota is per account, so all visitors share Fahim's daily
  GPU minutes: expect tens of live try-ons a day, not hundreds.
- Google no longer publishes fixed free-tier numbers; the account's live limits are in AI
  Studio. Third-party trackers put Flash-Lite in the hundreds to about 1,000 requests a day
  and newer Flash models far lower. Free-tier inputs may be used to improve Google's models.
- The current `app/api/tryon/route.ts` uses fal.ai's FASHN endpoint (not IDM-VTON as the
  README says) and Pollinations for text-to-image renders.

## 4. Architecture

```
weekly GitHub Action                         browser (Next.js on Vercel)
  scripts/catalog/fetch  ─┐                    Board / Library  ← catalog.json
  scripts/catalog/tag    ─┼→ public/catalog.json      │
  scripts/catalog/eval   ─┘                    Try-on panel ──→ /api/tryon ──→ HF Spaces chain
                                                      │                     └→ fal (if FAL_KEY)
  scripts/bench/run  ──→ public/bench/*.json   judge (browser) ←─ result image
                         public/bench/img/*     Stylist ──→ /api/stylist ──→ Gemini Flash-Lite
                                                                         └→ rules fallback
```

### 4.1 Catalog pipeline (offline)

`scripts/catalog/fetch.mjs` pulls the four feeds at one request per second and keeps women's
pieces only. It writes raw rows with brand, product URL, price in taka, all image URLs and the
brand's own type and tags.

`scripts/catalog/tag.mjs` sends each new piece's images, one call per piece, to Gemini
Flash-Lite with a JSON schema and gets back:

| field | values |
|---|---|
| `slot` | `saree`, `set3`, `set2`, `kurti`, `top`, `bottom`, `orna`, `accessory`, `skip` |
| `colors` | up to three named colours from a fixed palette, plus hex |
| `fabric` | cotton, georgette, silk, linen, lawn, chiffon, khadi, mixed, unknown |
| `work` | none, print, embroidery, karchupi, block, sequin |
| `formality` | 1 (home) to 5 (bridal) |
| `occasions` | subset of eid, wedding, gaye_holud, puja, office, university, casual, party |
| `tryon_image` | index of the image best suited to try-on |
| `image_kind` | flat, on_model, detail |
| `tryon_ok` | whether a usable try-on image exists |

Tags are cached by product id and image hash, so a piece is tagged once. Pieces tagged `skip`
(underwear, kids', menswear that slipped through) are dropped. Output: `public/catalog.json`,
committed by the Action. The runtime catalog URL moves from the gist to this file.

`scripts/catalog/eval.mjs` scores the tagger against `data/labels/tags-gold.json`, about 60
pieces Fahim labels by hand, and writes slot accuracy, colour agreement and occasion
precision to `public/bench/tagger.json`.

The workflow runs weekly and on dispatch, fails soft (keeps the last good catalog), and
never exceeds a per-run call budget.

### 4.2 Slots and UI

`lib/catalog.ts` replaces the western slots with the table's slots, labelled Sarees, 3-piece,
2-piece, Kurtis, Tops, Bottoms, Ornas, Accessories. Board, Catalog and Library keep their
layout and read the new catalog. Each piece card gains a "View at <brand>" link and price.
The 3D room is untouched.

### 4.3 Try-on engine

`app/api/tryon/route.ts` gains a provider chain in `lib/tryon/providers.ts`, each provider
behind one interface: `run(person, garment, slot) → image | error`.

Order by slot, because the models differ in what they were trained on:
- full-length pieces (`saree`, `set3`, `set2`, `kurti`): OOTDiffusion full-body, then
  IDM-VTON, then Kolors;
- upper-body pieces (`top`): IDM-VTON, then Kolors, then OOTDiffusion;
- any slot: fal FASHN last, only if `FAL_KEY` is set.

Spaces are called through `@gradio/client` with `HF_TOKEN`. Timeouts are 90 seconds per
provider. The route keeps a per-IP limit (5 try-ons an hour) so one visitor cannot spend the
day's GPU budget. When every provider is out of quota the route answers `quota_exhausted` and
the UI shows the demo gallery (4.5) for that piece instead of an error.

Pollinations "Render my look" stays as it is for the 3D room.

### 4.4 Try-on judge

`lib/judge/` runs in the browser on every result and returns a verdict with three scores:

- **Garment colour kept:** dominant colours in the garment region of the result against the
  piece's tagged colours, in CIELAB, pass under ΔE 20.
- **Person kept:** the head region of the result against the head region of the input,
  downsampled perceptual hash, pass above a Hamming-similarity threshold.
- **Outfit changed:** the torso region must differ from the input by a minimum amount, which
  catches models that return the person unchanged.

Regions come from fixed proportions of a portrait photo plus the input's aspect ratio; no
pose model is added in this version. Thresholds are set on the benchmark (4.5), not guessed.

On a fail the client asks the route once for the next provider. On a second fail it shows the
best of the two with a plain note ("the colours came out wrong on this one"). Live verdicts
are not collected in this version; quality is measured by the benchmark.

### 4.5 Bangladeshi try-on benchmark

`scripts/bench/run.mjs` crosses 10 person photos (openly licensed South Asian women from
Unsplash or Pexels, licence recorded in `data/bench/people.json`) with 40 pieces (5 per slot)
across each provider, runs the same judge in Node, and writes:

- `public/bench/results.json`: pass rates per provider × slot, with counts;
- `public/bench/img/`: every output image, which doubles as the demo gallery;
- `docs/bench.md`: the write-up, method, limits and what surprised us.

A small hand-rated subset (Fahim marks 80 outputs good or bad) checks the judge itself, and
its agreement rate is published next to the scores. It runs by dispatch only, spread across
days to stay inside ZeroGPU quota, and resumes from what it has.

A `/bench` page on the site shows the table and a grid of examples.

### 4.6 Occasion stylist

A small panel above the catalog: pick an occasion and optionally a budget in taka. The route
`/api/stylist` filters the catalog by tags to about 30 candidates, then asks Gemini
Flash-Lite, with a JSON schema, for three piece ids and one line of reasoning each. The
answer is validated: ids must exist in the candidates or the response is discarded. The rules
fallback ranks by occasion match, formality and price and returns the top three with
templated reasons; the UI marks which one it got. Each suggestion has a "Try it on" button
that opens the try-on panel. "Complete the look" on a chosen piece suggests one orna or
accessory the same way.

## 5. Error handling summary

| failure | what the customer sees |
|---|---|
| a Space errors or times out | next provider, silently |
| all providers out of quota | demo gallery for that piece, with a note |
| judge fails twice | best result with a plain note |
| Gemini quota or error | rules-based suggestions, marked as such |
| catalog Action fails | last good catalog stays live |
| brand removes a product | image fails to load, card hidden client-side |

## 6. Testing

- Unit tests (Vitest) for the provider chain order and fallbacks with mocked providers, the
  judge's colour and hash functions on fixture images, the stylist's filter and fallback
  ranking, and the stylist response validator.
- Fixture tests for the feed parsers on saved Shopify and WooCommerce responses.
- The tagger and judge are measured, not unit-tested: their accuracy is the published
  `tagger.json` and the judge's agreement rate.
- CI workflow runs lint, typecheck and tests on every push.

## 7. What gets published

- README rewritten around the customer problem, with the decisions and the rejected options
  (live LLM on every request; in-browser models).
- `/bench` page and `docs/bench.md`.
- A privacy note next to the upload button naming the providers a photo goes to.

## 8. Out of scope

Photo-to-wardrobe. Menswear. Scraping brands without a feed. Changes to the 3D room. A pose
or segmentation model in the judge. Accounts, payments, storing any photo.

## 9. Open risks

- ZeroGPU quota may be tighter than expected. Mitigation: the benchmark runs across days; the
  demo gallery covers live exhaustion.
- A Space owner may take a Space down. Mitigation: the chain has three Spaces and fal.
- Sarees may fail on every model. That is a finding, not a failure: the benchmark reports it.
- Brands may object to use of their product photos. Mitigation: non-commercial, linked back,
  removed on request, noted in the README.
