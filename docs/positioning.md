# EOS: positioning

**One line.** EOS lets Bangladeshi shoppers see a real piece on themselves before they order, and
tells them honestly when the preview isn't reliable.

## Who it is for

Not a consumer destination. Shoppers buy on brand sites and Facebook pages, not on a third-party
site, and a catalogue built from public feeds is not a business footing. EOS is a **trust layer
for small and mid-sized Bangladeshi fashion sellers**: a "Try it on me" button and a
better-tagged catalogue they plug into their own shop.

| For | Value |
|---|---|
| Shoppers | See the piece on yourself; get a plain warning when the result is off |
| Sellers | More confident orders and fewer returns (to be proven in a pilot); searchable catalogue by occasion and budget |
| The market | A public benchmark of how open try-on models handle sarees, salwar kameez and kurtis |

## Why not just build it in-house?

A brand with a developer can connect a paid try-on API in a day or two. Try-on alone is a
commodity, and EOS should not pretend otherwise. What is harder to copy:

1. **Cross-brand discovery.** One photo, tried across several brands; "Eid, under ৳3,000" across
   all of them. No single brand will build a tool that lists its competitors.
2. **Data that compounds.** The benchmark of which models fail on which garments, a judge
   calibrated to real ratings, labelled catalogues, and later what shoppers try on but don't buy,
   across brands. Code is cheap to copy; this is not.
3. **Maintenance.** Models change, free GPU hosts go down, APIs and prices move. Small sellers have
   no AI engineers; a plugin that keeps working beats a one-off project.
4. **Quality control.** Results are judged and bad ones are held back, tuned on local clothing.

Consequences: large brands (Aarong's size) are not the market; they can build or buy directly.
The long tail of small sellers, especially on Facebook, is. If sellers will not agree to be
listed side by side, the moat is thin and EOS is best treated as a showcase.

## Where it stands (September 2026)

- 490 tagged pieces from Yellow, Twelve and Kay Kraft; garment type right 98% of the time on a
  held-out test set (colour accuracy work in progress; see `docs/bench.md`).
- Free try-on runs in the visitor's browser; a code-locked paid model for demos.
- Known weaknesses: free models are poor on sarees and long kurtis; the free GPU allowance is
  small; brands without a public feed (Aarong, Le Reve, Sailor) are missing.

## What to prove next

1. Talk to 3–5 small sellers: do returns and refused cash-on-delivery orders hurt, and would they
   add the button?
2. One pilot with a seller who shares their catalogue directly, which also removes the reliance on
   public feeds.
3. Measure orders and returns with and without try-on. That number is the case.

## Nearby players (checked September 2026)

- **Le Reve** promoted a "Virtual Trial Room" for Eid on Facebook; no sign of it on their site now.
  Single-brand.
- **GlamourBox**: a Bangla-language demo for small businesses to make product photos on AI models.
  Seller-side, not shopper-side.
- **FitRoom, TryThisFit**: general try-on apps with pages on Bangladeshi traditional wear; you
  bring your own garment image, no local catalogue.
- **Saree photo apps** (SareeDrape AI, AI Saree, Sketchto): AI saree makeovers, not real
  purchasable pieces.
