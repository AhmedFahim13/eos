# Eos — Virtual Atelier

A 3D fitting room + clothing design studio. Pick a **mood**, dress the form, recolor and print
your garments, save looks — and optionally render the outfit **photorealistically** with AI.

Built with Next.js 16, react-three-fiber, drei, postprocessing, Zustand, Framer Motion, Tailwind v4.
Everything runs in the browser and persists to `localStorage` — no account, no database.

## Features
- **4 Moods** (Elegant · Editorial · Romantic · Playful) — each re-skins lighting, environment,
  post-processing and the whole UI in sync.
- **Fitting Room** — 9 procedural garments across dresses / tops / skirts / layers, smart layering,
  15-swatch recolor, save & reload looks.
- **Design Studio** — apply prints (stripes, dots, check, plaid, floral) in any color and scale.
- **Photoreal (2D)** — two modes:
  - *Render my look* — **free, no key** (Pollinations): turns your styled outfit into a photoreal editorial image (~20s).
  - *Try on a photo* — upload a person + garment → they wear it (optional, needs a Gemini key with billing).

## Run locally
```bash
npm install
npm run dev
# open http://localhost:3000  (or the --port you pass)
```

## Deploy to Vercel
1. Push this folder to a GitHub repo.
2. On https://vercel.com → **New Project** → import the repo → **Deploy** (no config needed).
3. That's it — the 3D app is live and fully usable.

## Photoreal modes
- **Render my look** — **free, no key** (Pollinations text-to-image). Works out of the box.
- **Try on a photo** — true try-on of a real person + real garment via **fal.ai IDM-VTON**.
  Needs a **free fal.ai key (no card)**:
  1. Sign up at https://fal.ai and create a key at https://fal.ai/dashboard/keys
  2. Add `FAL_KEY=...` to `.env.local` (local) and to Vercel → Settings → Environment Variables (deploy)
  3. Restart / redeploy. fal gives free signup credits — plenty for personal use.
- *(Optional)* Gemini image edit is also supported (`provider: "gemini"`), but Google's free tier
  excludes image generation, so it needs billing enabled — fal is the better free path.

## Making it personal
Personalization is intentionally left neutral. To add a private message, edit
`components/MoodSwitcher.tsx` (the header/footer text) or drop a line into `app/page.tsx`.

## Structure
- `lib/moods.ts` — the 4 mood presets (single source of truth)
- `lib/garments.ts` — procedural wardrobe definitions
- `lib/pattern.ts` — canvas print generator
- `lib/store.ts` — Zustand state (mood, wardrobe, prints, saved looks) + persistence
- `components/Scene.tsx` — the r3f canvas, lighting, procedural studio env, post-processing
- `components/Figure.tsx` `Mannequin.tsx` `Garment.tsx` — the 3D form + clothing
- `components/Wardrobe.tsx` `MoodSwitcher.tsx` `Photoreal.tsx` — the UI
- `app/api/tryon/route.ts` — the Gemini photoreal proxy
