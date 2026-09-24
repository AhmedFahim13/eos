# Eos

See yourself in a piece before you buy it. Eos lets you pick real pieces from Bangladeshi brands
(sarees, three-piece and two-piece sets, kurtis, tops, bottoms), upload a photo, and see yourself
wearing them. It costs nothing to run.

Live: https://eos-93xe.vercel.app · Benchmark: https://eos-93xe.vercel.app/bench

## How it works

1. **Catalog.** Every week a GitHub Action reads the public product feeds of Yellow, Twelve and
   Kay Kraft, and a vision model (Gemini Flash-Lite, free tier) tags each new piece once: garment
   type, colours, fabric, work, formality, occasions, and which photo suits try-on. Tags are
   cached, so a piece is never tagged twice. Every piece links back to the brand.
2. **Try-on.** Your browser sends your photo and the piece straight to open try-on models on
   Hugging Face (OOTDiffusion for full-length pieces, IDM-VTON for tops). Each visitor uses their
   own free GPU allowance, and Eos never sees or stores the photo. A "stronger model" (fal.ai
   FASHN, paid) is available behind an owner's code: then the photo goes through Eos's server to
   fal.ai for that try-on, is not stored, and the free models remain the backup.
3. **Judge.** Every result is checked before you see it: is the garment's colour kept, is it
   still you, did the outfit actually change. A miss is retried once on the other model; if both
   miss, you get the better one with a plain note instead of a silently wrong picture.
4. **Benchmark.** The same judge scores a fixed set of benchmark photos every day.
   The result, how well open try-on models handle Bangladeshi clothing, is at `/bench`.
5. **Stylist.** Pick an occasion (Eid, wedding, gaye holud, office…) and an optional budget; one
   model call picks three pieces from a rule-narrowed shortlist and says why. If the free quota
   runs out, rules answer instead, and the panel says so.

## Decisions

- **AI where it pays, cached everywhere else.** Tagging happens once per piece, offline. The
  stylist makes one call per request over about 30 candidates, never the whole catalog.
- **Try-on from the browser.** A server calling Hugging Face with one token would give the whole
  site about 3.5 GPU minutes a day. Calling from the browser gives every visitor their own.
- **Measure, then show.** The judge's thresholds will be fitted to human ratings once the
  benchmark has run, and the agreement is published next to the results, as is the tagger's
  accuracy.
- **Rejected:** calling an LLM on every click (burns the free quota in an afternoon); running
  models in the browser (a 1–2 GB download, weak on phones and on Bangladeshi occasions).
- **Not built:** menswear (Dorjibari is menswear only, so it was dropped from the catalog),
  brands without a public feed (Aarong, Le Reve, Sailor), turning a photo of your own clothes
  into a wardrobe item.

## Run it

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY; HF_TOKEN only for the benchmark
npm run dev
npm test
```

Catalog: `npm run catalog:fetch`, then `npm run catalog:tag`. Tagger accuracy: `npm run catalog:eval`.
Benchmark: `npm run bench:run`, `npm run bench:report`, `npm run bench:calibrate`.

## Data and privacy

Product data comes only from the brands' public feeds, for a non-commercial demo, with every
piece linked to the brand's own page. A brand can ask for removal at any time. Uploaded photos go
directly from the visitor's browser to Hugging Face and are never stored by Eos. When the
code-locked stronger model is on, a photo instead passes through Eos's server to fal.ai for that
try-on; it is not stored by either. Benchmark photos are openly licensed; sources and
credits are in `data/bench/people.json`.

The 3D atelier (moods, procedural garments, prints) is still in the app under the 3D tab.
