# Eos AI Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Eos's foreign catalog with tagged Bangladeshi women's wear, make photo try-on free and self-checking, publish a Bangladeshi try-on benchmark, and add a small occasion stylist, without changing the core "see yourself in it" product.

**Architecture:** A weekly GitHub Action fetches four brands' public product feeds and tags each piece once with Gemini Flash-Lite into `public/catalog.json`. In the browser, try-on calls free Hugging Face Spaces directly (each visitor spends their own anonymous ZeroGPU quota), and a pure-TypeScript judge scores every result from pixels, retrying once on the next model. The same providers and judge run in Node for a resumable daily benchmark whose numbers and images feed a `/bench` page and the quota fallback.

**Tech Stack:** Next.js 16 (App Router), React 19, Zustand, Tailwind v4, `@gradio/client`, Gemini REST API, `sharp` (Node only), Vitest, tsx, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-23-eos-ai-layer-design.md`, including section 9 (revisions), which overrides the earlier sections.

---

## File map

| Path | Responsibility |
|---|---|
| `lib/catalog/slots.ts` | Slot type, labels, tints, which slots displace which, try-on order |
| `lib/catalog/types.ts` | `Piece` and `Occasion` types |
| `lib/catalog.ts` | Runtime catalog store, image proxy URL, search (re-exports the two above) |
| `lib/build/feeds.ts` | Feed URLs and parsers for Shopify and WooCommerce, women's-wear filter |
| `lib/build/tags.ts` | Tag schema, prompt, normaliser, cache key, raw + tag → `Piece` |
| `lib/build/tagEval.ts` | Tagger accuracy against hand labels |
| `lib/ai/gemini.ts` | One JSON-mode Gemini call, `QuotaError` |
| `lib/tryon/types.ts` | Provider interface and result types |
| `lib/tryon/chain.ts` | Provider order per slot, run a chain, detect "out of capacity" |
| `lib/tryon/hf.ts` | OOTDiffusion and IDM-VTON providers (isomorphic) |
| `lib/tryon/falClient.ts` | Browser provider that calls the fal route |
| `lib/tryon/fit.ts` | One piece: chain → judge → one retry → best-of-two note |
| `lib/tryon/live.ts` | Browser wiring of providers, judge and order |
| `lib/tryon/node.ts` | Node image loaders for benchmark and smoke test |
| `lib/judge/*.ts` | Pixels type, colour science, regions, hash, `measure` + `decide` |
| `lib/judge/thresholds.json` | Judge thresholds, rewritten by calibration |
| `lib/judge/browser.ts` / `lib/judge/node.ts` | Image → `Pixels` in each runtime |
| `lib/ratelimit.ts` | In-memory sliding-window limiter |
| `lib/stylist/*.ts` | Candidates, rules, prompt, validation, `suggest` orchestrator |
| `lib/bench/*.ts` | Piece selection, aggregation, judge agreement |
| `app/api/tryon/route.ts` | fal-only try-on route (rewritten) |
| `app/api/result/route.ts` | No-store proxy for `*.hf.space` result images |
| `app/api/stylist/route.ts` | Stylist route |
| `app/bench/page.tsx` | Benchmark page |
| `components/Board.tsx` | Try-on flow (rewritten) |
| `components/Stylist.tsx` | Occasion stylist panel |
| `scripts/catalog/{fetch,tag,eval}.ts` | Catalog pipeline |
| `scripts/bench/{run,calibrate,report}.ts` | Benchmark pipeline |
| `scripts/tryon-smoke.ts` | One real try-on per provider |
| `.github/workflows/{ci,catalog,bench}.yml` | CI, weekly catalog, daily benchmark |
| `tests/**` | Vitest tests |

Removed: `components/Photoreal.tsx`, `lib/describe.ts` (never mounted), `scripts/scrape.mjs`, `scripts/shopify.mjs`.

Untouched: the 3D room (`components/Scene.tsx`, `Wardrobe.tsx`, `Figure.tsx`, `Garment.tsx`, `Mannequin.tsx`, `lib/store.ts`, `lib/garments.ts`, `lib/moods.ts`, `lib/pattern.ts`).

---

## Task 0: Prerequisites (Fahim)

These unblock later tasks. Tasks 1 to 5 can start without them.

- [ ] **Gemini key:** create a key at https://aistudio.google.com/apikey. Put `GEMINI_API_KEY=...` in `C:\Users\hp\Auto\eos\.env.local`, add it as the GitHub repo secret `GEMINI_API_KEY`, and add it to the Vercel project's environment variables. Needed by Task 7.
- [ ] **Hugging Face token:** create a read token at https://huggingface.co/settings/tokens. Put `HF_TOKEN=hf_...` in `.env.local` and add the GitHub secret `HF_TOKEN`. Needed by Task 15.
- [ ] **Photos:** six openly licensed photos (Unsplash or Pexels) of South Asian women, standing, facing the camera, full body or knees up, plain background, portrait orientation. Save one as `public/samples/model.jpg` and five as `data/bench/people/p01.jpg` to `p05.jpg`. Record the source URL, licence and credit for each in `data/bench/people.json` (format in Task 22). Needed by Tasks 15 and 22.

---

## Task 1: Test tooling and CI

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `.github/workflows/ci.yml`

- [ ] **Step 1: Install dev tools and the Gradio client**

```bash
cd C:/Users/hp/Auto/eos
npm install
npm install @gradio/client
npm install -D vitest tsx sharp
```

- [ ] **Step 2: Add scripts to `package.json`**

Replace the `"scripts"` block with:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "catalog:fetch": "node --env-file-if-exists=.env.local --import tsx scripts/catalog/fetch.ts",
    "catalog:tag": "node --env-file-if-exists=.env.local --import tsx scripts/catalog/tag.ts",
    "catalog:eval": "node --env-file-if-exists=.env.local --import tsx scripts/catalog/eval.ts",
    "tryon:smoke": "node --env-file-if-exists=.env.local --import tsx scripts/tryon-smoke.ts",
    "bench:run": "node --env-file-if-exists=.env.local --import tsx scripts/bench/run.ts",
    "bench:calibrate": "node --env-file-if-exists=.env.local --import tsx scripts/bench/calibrate.ts",
    "bench:report": "node --env-file-if-exists=.env.local --import tsx scripts/bench/report.ts"
  },
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
```

- [ ] **Step 4: Check the baseline**

Run: `npx vitest run --passWithNoTests; npm run typecheck; npm run lint`
Expected: vitest reports no test files and exits 0. Note any typecheck or lint errors that already exist; fix them only if each is a one-line fix, otherwise list them in the commit message and continue.

- [ ] **Step 5: Create `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  push:
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --passWithNoTests
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .github/workflows/ci.yml
git commit -m "chore: add vitest, tsx, sharp, gradio client and CI"
```

---

## Task 2: Slot model

**Files:**
- Create: `lib/catalog/slots.ts`, `lib/catalog/types.ts`
- Test: `tests/catalog/slots.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/catalog/slots.test.ts
import { describe, expect, it } from "vitest";
import { displaced, TRYON_ORDER, isWearable } from "@/lib/catalog/slots";

describe("displaced", () => {
  it("an outfit clears every other wearable but keeps extras", () => {
    const d = displaced("saree");
    expect(d).toEqual(expect.arrayContaining(["set3", "set2", "kurti", "top", "bottom"]));
    expect(d).not.toContain("saree");
    expect(d).not.toContain("orna");
  });
  it("kurti and top replace each other and any outfit", () => {
    expect(displaced("kurti").sort()).toEqual(["saree", "set2", "set3", "top"]);
    expect(displaced("top").sort()).toEqual(["kurti", "saree", "set2", "set3"]);
  });
  it("a bottom only clears outfits", () => {
    expect(displaced("bottom").sort()).toEqual(["saree", "set2", "set3"]);
  });
  it("extras clear nothing", () => {
    expect(displaced("orna")).toEqual([]);
    expect(displaced("accessory")).toEqual([]);
  });
});

describe("try-on order", () => {
  it("puts the bottom before what goes over it", () => {
    expect(TRYON_ORDER.indexOf("bottom")).toBeLessThan(TRYON_ORDER.indexOf("kurti"));
  });
  it("does not try on extras", () => {
    expect(isWearable("orna")).toBe(false);
    expect(isWearable("saree")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/catalog/slots.test.ts`
Expected: FAIL, cannot resolve `@/lib/catalog/slots`.

- [ ] **Step 3: Create `lib/catalog/slots.ts`**

```ts
// lib/catalog/slots.ts — Bangladeshi women's-wear slots and how they combine.
export type Slot = "saree" | "set3" | "set2" | "kurti" | "top" | "bottom" | "orna" | "accessory";

export const SLOT_VALUES: Slot[] = ["saree", "set3", "set2", "kurti", "top", "bottom", "orna", "accessory"];

export const SLOTS: { slot: Slot; label: string; noun: string }[] = [
  { slot: "saree", label: "Sarees", noun: "saree" },
  { slot: "set3", label: "3-piece", noun: "three-piece salwar kameez" },
  { slot: "set2", label: "2-piece", noun: "two-piece set" },
  { slot: "kurti", label: "Kurtis", noun: "kurti" },
  { slot: "top", label: "Tops", noun: "top" },
  { slot: "bottom", label: "Bottoms", noun: "bottom" },
  { slot: "orna", label: "Ornas", noun: "orna" },
  { slot: "accessory", label: "Accessories", noun: "accessory" },
];

export const SLOT_NOUN = Object.fromEntries(SLOTS.map((s) => [s.slot, s.noun])) as Record<Slot, string>;

export const SLOT_TINT: Record<Slot, string> = {
  saree: "#efe3e6", set3: "#e9dfe8", set2: "#e3e7ec", kurti: "#e7e2d8",
  top: "#dfe4e0", bottom: "#ece2df", orna: "#e8e3ea", accessory: "#efe6dc",
};

/** Complete outfits: each one replaces every other wearable. */
export const OUTFITS: Slot[] = ["saree", "set3", "set2"];
/** The order pieces are sent to try-on: an outfit alone, else the bottom before what goes over it. */
export const TRYON_ORDER: Slot[] = ["saree", "set3", "set2", "bottom", "kurti", "top"];
/** Shown on the board, never sent to try-on. */
export const EXTRAS: Slot[] = ["orna", "accessory"];

export const isWearable = (s: Slot): boolean => TRYON_ORDER.includes(s);

/** Slots that must be emptied when a piece in `slot` is equipped. */
export function displaced(slot: Slot): Slot[] {
  if (OUTFITS.includes(slot)) return TRYON_ORDER.filter((s) => s !== slot);
  if (slot === "kurti") return [...OUTFITS, "top"];
  if (slot === "top") return [...OUTFITS, "kurti"];
  if (slot === "bottom") return [...OUTFITS];
  return [];
}
```

- [ ] **Step 4: Create `lib/catalog/types.ts`**

```ts
// lib/catalog/types.ts — the shape of one catalog piece as the app sees it.
import type { Slot } from "./slots";

export type Occasion = "eid" | "wedding" | "gaye_holud" | "puja" | "office" | "university" | "casual" | "party";

export const OCCASIONS: Occasion[] = ["eid", "wedding", "gaye_holud", "puja", "office", "university", "casual", "party"];

export const OCCASION_LABEL: Record<Occasion, string> = {
  eid: "Eid", wedding: "Wedding", gaye_holud: "Gaye holud", puja: "Puja",
  office: "Office", university: "University", casual: "Everyday", party: "Party",
};

export type ImageKind = "flat" | "on_model" | "detail";

export interface Piece {
  id: string;
  slot: Slot;
  name: string;
  brand: string;
  url: string;
  price: number | null;
  image: string;
  colors: { name: string; hex: string }[];
  fabric: string;
  work: string;
  formality: number;
  occasions: Occasion[];
  imageKind: ImageKind;
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npx vitest run tests/catalog/slots.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/catalog tests/catalog
git commit -m "feat: Bangladeshi women's-wear slot model"
```

---

## Task 3: Feed parsers

**Files:**
- Create: `lib/build/feeds.ts`
- Test: `tests/build/feeds.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/build/feeds.test.ts
import { describe, expect, it } from "vitest";
import { parseShopify, parseWoo, isWomens, pageLength, feedUrl, type FeedSource } from "@/lib/build/feeds";

const yellow: FeedSource = { brand: "Yellow", domain: "yellowclothing.net", kind: "shopify" };
const kay: FeedSource = { brand: "Kay Kraft", domain: "www.kaykraft.com", kind: "woo" };

const shopifyPage = {
  products: [
    { id: 11, title: "Printed Cotton Kurti", handle: "printed-kurti", product_type: "Womens Wear", tags: ["Kurti", "Eid"], variants: [{ price: "1890.00" }], images: [{ src: "https://cdn.shopify.com/a.jpg" }, { src: "https://cdn.shopify.com/b.jpg" }] },
    { id: 12, title: "No Image Tee", handle: "x", product_type: "Womens Wear", tags: [], variants: [{ price: "500" }], images: [] },
  ],
};

const wooPage = [
  { id: 7, name: "Magenta Cotton Printed Saree", permalink: "https://www.kaykraft.com/product/magenta/", prices: { price: "450000", currency_minor_unit: 2 }, images: [{ src: "https://www.kaykraft.com/m.jpg" }], categories: [{ name: "Saree" }], tags: [{ name: "Cotton" }] },
];

describe("parseShopify", () => {
  it("maps a product and drops ones without images", () => {
    const rows = parseShopify(yellow, shopifyPage);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "yellow-11", brand: "Yellow", name: "Printed Cotton Kurti",
      url: "https://yellowclothing.net/products/printed-kurti", price: 1890,
      images: ["https://cdn.shopify.com/a.jpg", "https://cdn.shopify.com/b.jpg"],
      hints: "Womens Wear | Kurti | Eid",
    });
  });
  it("accepts tags as a comma string", () => {
    const rows = parseShopify(yellow, { products: [{ ...shopifyPage.products[0], tags: "Kurti, Eid" }] });
    expect(rows[0].hints).toBe("Womens Wear | Kurti | Eid");
  });
});

describe("parseWoo", () => {
  it("maps a product and converts minor units", () => {
    const [row] = parseWoo(kay, wooPage);
    expect(row.id).toBe("kay-kraft-7");
    expect(row.price).toBe(4500);
    expect(row.url).toBe("https://www.kaykraft.com/product/magenta/");
    expect(row.hints).toBe("Saree | Cotton");
  });
  it("decodes HTML entities in names", () => {
    const [row] = parseWoo(kay, [{ ...wooPage[0], name: "LUBNAN WOMEN&#8217;S KURTI" }]);
    expect(row.name).toBe("LUBNAN WOMEN’S KURTI");
  });
});

describe("isWomens", () => {
  const base = { id: "x", brand: "b", url: "u", price: null, images: ["i"] };
  it("keeps women's wear", () => {
    expect(isWomens({ ...base, name: "Printed Cotton Kurti", hints: "Womens Wear" })).toBe(true);
    expect(isWomens({ ...base, name: "Womens Off White 3-Piece Set", hints: "Womens 3Pcs" })).toBe(true);
    expect(isWomens({ ...base, name: "Magenta Saree", hints: "Saree" })).toBe(true);
  });
  it("drops men's, kids' and underwear", () => {
    expect(isWomens({ ...base, name: "Regular Fit Panjabi", hints: "Mens Wear" })).toBe(false);
    expect(isWomens({ ...base, name: "Girls' Dress (6-8 Years)", hints: "Kids Wear" })).toBe(false);
    expect(isWomens({ ...base, name: "Semi Fit Solid Boxer", hints: "Underwear" })).toBe(false);
  });
});

describe("paging", () => {
  it("builds feed URLs", () => {
    expect(feedUrl(yellow, 2)).toBe("https://yellowclothing.net/products.json?limit=250&page=2");
    expect(feedUrl(kay, 3)).toBe("https://www.kaykraft.com/wp-json/wc/store/v1/products?per_page=100&page=3");
  });
  it("counts raw page length before filtering", () => {
    expect(pageLength(yellow, shopifyPage)).toBe(2);
    expect(pageLength(kay, wooPage)).toBe(1);
    expect(pageLength(kay, { code: "error" })).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/build/feeds.test.ts`
Expected: FAIL, cannot resolve `@/lib/build/feeds`.

- [ ] **Step 3: Create `lib/build/feeds.ts`**

```ts
// lib/build/feeds.ts — public product feeds of Bangladeshi brands (verified 2026-09-23).
export interface FeedSource { brand: string; domain: string; kind: "shopify" | "woo" }

export interface RawPiece {
  id: string;
  brand: string;
  name: string;
  url: string;
  price: number | null;
  images: string[];
  hints: string;
}

export const SOURCES: FeedSource[] = [
  { brand: "Yellow", domain: "yellowclothing.net", kind: "shopify" },
  { brand: "Twelve", domain: "twelvebd.com", kind: "shopify" },
  { brand: "Dorjibari", domain: "dorjibari.com.bd", kind: "shopify" },
  { brand: "Kay Kraft", domain: "www.kaykraft.com", kind: "woo" },
];

interface ShopifyProduct {
  id: number; title: string; handle: string; product_type?: string;
  tags?: string[] | string; variants?: { price?: string }[]; images?: { src: string }[];
}
interface WooProduct {
  id: number; name: string; permalink: string;
  prices?: { price?: string; currency_minor_unit?: number };
  images?: { src: string }[]; categories?: { name: string }[]; tags?: { name: string }[];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const decode = (s: string) =>
  s.replace(/&#8217;/g, "’").replace(/&#8211;/g, "–").replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function feedUrl(src: FeedSource, page: number): string {
  return src.kind === "shopify"
    ? `https://${src.domain}/products.json?limit=250&page=${page}`
    : `https://${src.domain}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
}

/** Number of products on a raw page, before any filtering; 0 ends paging. */
export function pageLength(src: FeedSource, json: unknown): number {
  if (src.kind === "shopify") {
    const p = (json as { products?: unknown[] } | null)?.products;
    return Array.isArray(p) ? p.length : 0;
  }
  return Array.isArray(json) ? json.length : 0;
}

export function parseShopify(src: FeedSource, json: unknown): RawPiece[] {
  const products = ((json as { products?: ShopifyProduct[] } | null)?.products ?? []);
  return products.filter((p) => p.images?.length).map((p) => {
    const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(",");
    return {
      id: `${slug(src.brand)}-${p.id}`,
      brand: src.brand,
      name: decode(p.title),
      url: `https://${src.domain}/products/${p.handle}`,
      price: toNum(p.variants?.[0]?.price),
      images: (p.images ?? []).map((i) => i.src).slice(0, 4),
      hints: [p.product_type ?? "", ...tags].map((t) => t.trim()).filter(Boolean).join(" | "),
    };
  });
}

export function parseWoo(src: FeedSource, json: unknown): RawPiece[] {
  const products = Array.isArray(json) ? (json as WooProduct[]) : [];
  return products.filter((p) => p.images?.length).map((p) => {
    const minor = p.prices?.currency_minor_unit ?? 0;
    const price = toNum(p.prices?.price);
    return {
      id: `${slug(src.brand)}-${p.id}`,
      brand: src.brand,
      name: decode(p.name),
      url: p.permalink,
      price: price === null ? null : price / 10 ** minor,
      images: (p.images ?? []).map((i) => i.src).slice(0, 4),
      hints: [...(p.categories ?? []), ...(p.tags ?? [])].map((c) => decode(c.name)).join(" | "),
    };
  });
}

const WOMEN = /\b(women|womens|women's|ladies|lady|saree|sari|kurti|kameez|salwar|three[- ]?piece|3[- ]?pc?s?|two[- ]?piece|2[- ]?pc?s?|orna|dupatta|tunic|kaftan|abaya|shrug|palazzo|leggings?|skirt)\b/i;
const NOT_WOMEN = /\b(men|mens|men's|boys?|kids?|baby|infant|underwear|boxer|brief|panjabi|fatua|lungi|wallet|household|bed ?sheet|cushion|towel)\b|\(\d+\s*-\s*\d+\s*(years|yrs|months)\)|\bgirls?'?(\s|$)/i;

/** Rough pre-filter so the tagger is not spent on menswear; the tagger's "skip" catches the rest. */
export function isWomens(p: RawPiece): boolean {
  const text = `${p.hints} | ${p.name}`;
  return WOMEN.test(text) && !NOT_WOMEN.test(text);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run tests/build/feeds.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/build/feeds.ts tests/build/feeds.test.ts
git commit -m "feat: parsers for Bangladeshi brands' public product feeds"
```

---

## Task 4: Gemini JSON client

**Files:**
- Create: `lib/ai/gemini.ts`
- Test: `tests/ai/gemini.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ai/gemini.test.ts
import { describe, expect, it, vi } from "vitest";
import { generateJSON, QuotaError } from "@/lib/ai/gemini";

const ok = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

describe("generateJSON", () => {
  it("parses the JSON text of the first candidate", async () => {
    const f = vi.fn().mockResolvedValue(ok('{"a":1}'));
    const out = await generateJSON<{ a: number }>({ parts: [{ text: "hi" }], schema: {}, apiKey: "k", fetchImpl: f });
    expect(out).toEqual({ a: 1 });
    const [url, init] = f.mock.calls[0];
    expect(url).toContain(":generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("k");
    expect(JSON.parse(init.body).generationConfig.responseMimeType).toBe("application/json");
  });
  it("throws QuotaError on 429", async () => {
    const f = vi.fn().mockResolvedValue(new Response("slow down", { status: 429 }));
    await expect(generateJSON({ parts: [], schema: {}, apiKey: "k", fetchImpl: f })).rejects.toBeInstanceOf(QuotaError);
  });
  it("throws QuotaError on RESOURCE_EXHAUSTED bodies", async () => {
    const f = vi.fn().mockResolvedValue(new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', { status: 400 }));
    await expect(generateJSON({ parts: [], schema: {}, apiKey: "k", fetchImpl: f })).rejects.toBeInstanceOf(QuotaError);
  });
  it("fails without a key", async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    await expect(generateJSON({ parts: [], schema: {} })).rejects.toThrow(/GEMINI_API_KEY/);
    if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/ai/gemini.test.ts`
Expected: FAIL, cannot resolve `@/lib/ai/gemini`.

- [ ] **Step 3: Create `lib/ai/gemini.ts`**

```ts
// lib/ai/gemini.ts — one JSON-mode call to the Gemini API (free tier, Flash-Lite by default).
export class QuotaError extends Error {}

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export interface GenerateOptions {
  parts: Part[];
  schema: object;
  model?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function generateJSON<T>(opts: GenerateOptions): Promise<T> {
  const key = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = opts.model ?? process.env.GEMINI_TEXT_MODEL ?? "gemini-flash-lite-latest";
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: opts.parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: opts.schema, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  if (res.status === 429) throw new QuotaError(await res.text());
  if (!res.ok) {
    const body = await res.text();
    if (/RESOURCE_EXHAUSTED|quota/i.test(body)) throw new QuotaError(body);
    throw new Error(`gemini ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const parts: { text?: string }[] = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("gemini: empty response");
  return JSON.parse(text) as T;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run tests/ai/gemini.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/ai tests/ai
git commit -m "feat: Gemini JSON-mode client with quota detection"
```

---

## Task 5: Tag schema, normaliser and catalog builder

**Files:**
- Create: `lib/build/tags.ts`
- Test: `tests/build/tags.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/build/tags.test.ts
import { describe, expect, it } from "vitest";
import { normalizeTag, toPiece, tagKey, selectUntagged, buildCatalog, PALETTE, type Tag } from "@/lib/build/tags";
import type { RawPiece } from "@/lib/build/feeds";

const raw: RawPiece = {
  id: "yellow-11", brand: "Yellow", name: "Printed Cotton Kurti", url: "https://y/p", price: 1890,
  images: ["https://i/0.jpg", "https://i/1.jpg"], hints: "Womens Wear",
};

const good = {
  slot: "kurti", colors: ["maroon", "gold", "not-a-colour"], fabric: "cotton", work: "print",
  formality: 3.6, occasions: ["eid", "office", "moon"], tryon_image: 5, image_kind: "flat", tryon_ok: true,
};

describe("normalizeTag", () => {
  it("keeps allowed values, clamps numbers and drops unknowns", () => {
    const t = normalizeTag(good, 2)!;
    expect(t.colors).toEqual(["maroon", "gold"]);
    expect(t.formality).toBe(4);
    expect(t.occasions).toEqual(["eid", "office"]);
    expect(t.tryon_image).toBe(1);
  });
  it("rejects an unknown slot", () => {
    expect(normalizeTag({ ...good, slot: "dress" }, 2)).toBeNull();
  });
  it("rejects a wearable with no valid colour", () => {
    expect(normalizeTag({ ...good, colors: ["plaid"] }, 2)).toBeNull();
  });
  it("accepts skip without colours", () => {
    expect(normalizeTag({ slot: "skip", colors: [] }, 1)?.slot).toBe("skip");
  });
});

describe("toPiece", () => {
  it("builds a piece using the chosen image and palette hex", () => {
    const p = toPiece(raw, normalizeTag(good, 2)!)!;
    expect(p.image).toBe("https://i/1.jpg");
    expect(p.colors[0]).toEqual({ name: "maroon", hex: PALETTE.maroon });
    expect(p.imageKind).toBe("flat");
  });
  it("drops skipped pieces and wearables without a usable try-on image", () => {
    expect(toPiece(raw, normalizeTag({ slot: "skip", colors: [] }, 2)!)).toBeNull();
    expect(toPiece(raw, normalizeTag({ ...good, tryon_ok: false }, 2)!)).toBeNull();
  });
  it("keeps extras even without a try-on image", () => {
    expect(toPiece(raw, normalizeTag({ ...good, slot: "orna", tryon_ok: false }, 2)!)?.slot).toBe("orna");
  });
});

describe("cache", () => {
  it("keys change when images change", () => {
    expect(tagKey(raw)).not.toBe(tagKey({ ...raw, images: ["https://i/9.jpg"] }));
    expect(tagKey(raw)).toBe(tagKey({ ...raw }));
  });
  it("selects only untagged pieces, up to the budget", () => {
    const b = { ...raw, id: "b" }, c = { ...raw, id: "c" };
    const cache: Record<string, Tag> = { [tagKey(raw)]: normalizeTag(good, 2)! };
    expect(selectUntagged([raw, b, c], cache, 1).map((r) => r.id)).toEqual(["b"]);
  });
  it("builds the catalog from cached tags only", () => {
    const b = { ...raw, id: "b" };
    const cache: Record<string, Tag> = { [tagKey(raw)]: normalizeTag(good, 2)! };
    expect(buildCatalog([raw, b], cache).map((p) => p.id)).toEqual(["yellow-11"]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/build/tags.test.ts`
Expected: FAIL, cannot resolve `@/lib/build/tags`.

- [ ] **Step 3: Create `lib/build/tags.ts`**

```ts
// lib/build/tags.ts — what the vision tagger returns for each piece, and how a tag becomes a Piece.
import { createHash } from "node:crypto";
import { SLOT_VALUES, isWearable, type Slot } from "@/lib/catalog/slots";
import { OCCASIONS, type ImageKind, type Occasion, type Piece } from "@/lib/catalog/types";
import type { RawPiece } from "./feeds";

export const PALETTE: Record<string, string> = {
  white: "#f5f5f0", ivory: "#efe7dc", cream: "#f3e5c0", beige: "#d9c3a0", yellow: "#e8c33a",
  mustard: "#c9a227", orange: "#e07b39", peach: "#f2b596", coral: "#ee6f5b", red: "#c0282d",
  maroon: "#6e1a24", pink: "#e58fb0", magenta: "#b8246f", purple: "#6c3a8c", lavender: "#b9a7d6",
  blue: "#2f5fb3", navy: "#1f2a48", sky: "#8cc3e8", teal: "#1f7a7a", green: "#2e7d4f",
  olive: "#6b6b2a", mint: "#a8d8b9", brown: "#6b4226", grey: "#8a8a8a", black: "#111111",
  gold: "#c9a646", silver: "#c0c0c8",
};

export const FABRICS = ["cotton", "georgette", "silk", "linen", "lawn", "chiffon", "khadi", "mixed", "unknown"] as const;
export const WORKS = ["none", "print", "embroidery", "karchupi", "block", "sequin"] as const;
export const IMAGE_KINDS: readonly ImageKind[] = ["flat", "on_model", "detail"];

export interface Tag {
  slot: Slot | "skip";
  colors: string[];
  fabric: string;
  work: string;
  formality: number;
  occasions: Occasion[];
  tryon_image: number;
  image_kind: ImageKind;
  tryon_ok: boolean;
}

const str = (values: readonly string[]) => ({ type: "STRING", enum: [...values] });

export const TAG_SCHEMA = {
  type: "OBJECT",
  properties: {
    slot: str([...SLOT_VALUES, "skip"]),
    colors: { type: "ARRAY", items: str(Object.keys(PALETTE)) },
    fabric: str(FABRICS),
    work: str(WORKS),
    formality: { type: "INTEGER" },
    occasions: { type: "ARRAY", items: str(OCCASIONS) },
    tryon_image: { type: "INTEGER" },
    image_kind: str(IMAGE_KINDS),
    tryon_ok: { type: "BOOLEAN" },
  },
  required: ["slot", "colors", "fabric", "work", "formality", "occasions", "tryon_image", "image_kind", "tryon_ok"],
};

export function tagPrompt(p: RawPiece, nImages: number): string {
  return [
    "You are cataloguing a Bangladeshi women's clothing product for a virtual try-on app.",
    `Product: "${p.name}" from ${p.brand}. Shop category hints: ${p.hints || "none"}.`,
    `You see ${nImages} product photo(s), numbered from 0.`,
    "Decide:",
    "- slot: saree; set3 (three-piece salwar kameez with orna or dupatta); set2 (two-piece: kameez or kurti with a bottom, or a co-ord); kurti (a single long tunic or kameez); top (short top, shirt, blouse, tee); bottom (salwar, palazzo, pants, skirt, leggings); orna (dupatta, scarf, shawl); accessory (jewellery, bag, other); skip (menswear, kidswear, underwear, homeware, or not clothing).",
    "- colors: up to three main garment colours, most dominant first, from the allowed list. Ignore the background and skin.",
    "- fabric; work (surface decoration); formality from 1 (at home) to 5 (bridal); the occasions it suits.",
    "- tryon_image: the index of the photo that best shows the whole garment from the front. Prefer a flat or mannequin shot, else a front on-model shot.",
    "- image_kind: what that chosen photo is.",
    "- tryon_ok: false if no photo shows the whole garment from the front.",
  ].join("\n");
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function normalizeTag(raw: unknown, nImages: number): Tag | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const slot = t.slot;
  if (typeof slot !== "string" || ![...SLOT_VALUES, "skip"].includes(slot)) return null;
  const colors = Array.isArray(t.colors)
    ? [...new Set(t.colors.filter((c): c is string => typeof c === "string" && c in PALETTE))].slice(0, 3)
    : [];
  if (slot !== "skip" && colors.length === 0) return null;
  const occasions = Array.isArray(t.occasions)
    ? [...new Set(t.occasions.filter((o): o is Occasion => typeof o === "string" && (OCCASIONS as string[]).includes(o)))]
    : [];
  const last = Math.max(0, nImages - 1);
  return {
    slot: slot as Tag["slot"],
    colors,
    fabric: oneOf(t.fabric, FABRICS, "unknown"),
    work: oneOf(t.work, WORKS, "none"),
    formality: Math.min(5, Math.max(1, Math.round(Number(t.formality) || 3))),
    occasions,
    tryon_image: Math.min(last, Math.max(0, Math.round(Number(t.tryon_image) || 0))),
    image_kind: oneOf(t.image_kind, IMAGE_KINDS, "on_model"),
    tryon_ok: t.tryon_ok !== false,
  };
}

/** Cache key: the piece plus the images the tagger saw, so a re-shot product is re-tagged. */
export function tagKey(raw: RawPiece): string {
  const h = createHash("sha1").update(raw.images.slice(0, 3).join("|")).digest("hex").slice(0, 12);
  return `${raw.id}:${h}`;
}

export function selectUntagged(raws: RawPiece[], cache: Record<string, Tag>, budget: number): RawPiece[] {
  return raws.filter((r) => !(tagKey(r) in cache)).slice(0, budget);
}

export function toPiece(raw: RawPiece, tag: Tag): Piece | null {
  if (tag.slot === "skip") return null;
  if (isWearable(tag.slot) && !tag.tryon_ok) return null;
  return {
    id: raw.id,
    slot: tag.slot,
    name: raw.name,
    brand: raw.brand,
    url: raw.url,
    price: raw.price,
    image: raw.images[tag.tryon_image] ?? raw.images[0],
    colors: tag.colors.map((name) => ({ name, hex: PALETTE[name] })),
    fabric: tag.fabric,
    work: tag.work,
    formality: tag.formality,
    occasions: tag.occasions,
    imageKind: tag.image_kind,
  };
}

export function buildCatalog(raws: RawPiece[], cache: Record<string, Tag>): Piece[] {
  const out: Piece[] = [];
  for (const r of raws) {
    const tag = cache[tagKey(r)];
    const piece = tag ? toPiece(r, tag) : null;
    if (piece) out.push(piece);
  }
  return out;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run tests/build/tags.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/build/tags.ts tests/build/tags.test.ts
git commit -m "feat: tag schema, normaliser and catalog builder"
```

---

## Task 6: Fetch script

**Files:**
- Create: `scripts/catalog/fetch.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create `scripts/catalog/fetch.ts`**

```ts
// scripts/catalog/fetch.ts — pull the brands' public feeds at one request per second.
// Writes data/catalog/raw.json only when enough pieces came back, so a bad night keeps the last good file.
import { mkdirSync, writeFileSync } from "node:fs";
import { SOURCES, feedUrl, isWomens, pageLength, parseShopify, parseWoo, type RawPiece } from "@/lib/build/feeds";

const UA = "EosCatalogBot/1.0 (+https://github.com/AhmedFahim13/eos)";
const MAX_PAGES = 20;
const MIN_PIECES = 50;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const out: RawPiece[] = [];
const seen = new Set<string>();

for (const src of SOURCES) {
  let total = 0;
  let kept = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    let json: unknown = null;
    try {
      const res = await fetch(feedUrl(src, page), {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) { console.warn(`  ${src.brand} page ${page}: HTTP ${res.status}`); break; }
      json = await res.json();
    } catch (e) {
      console.warn(`  ${src.brand} page ${page}: ${String(e).slice(0, 120)}`);
      break;
    }
    if (pageLength(src, json) === 0) break;
    const rows = src.kind === "shopify" ? parseShopify(src, json) : parseWoo(src, json);
    total += rows.length;
    for (const r of rows) {
      if (seen.has(r.id) || !isWomens(r)) continue;
      seen.add(r.id);
      out.push(r);
      kept++;
    }
    await sleep(1000);
  }
  console.log(`${src.brand}: ${kept} women's pieces of ${total}`);
}

if (out.length < MIN_PIECES) {
  console.error(`Only ${out.length} pieces; keeping the previous raw.json.`);
  process.exit(1);
}
mkdirSync("data/catalog", { recursive: true });
writeFileSync("data/catalog/raw.json", JSON.stringify(out));
console.log(`Wrote ${out.length} pieces to data/catalog/raw.json`);
```

- [ ] **Step 2: Allow `.env.example` and ignore smoke output**

Append to `.gitignore`:

```
# env
.env*
!.env.example

# local try-on smoke output
/data/smoke/
```

- [ ] **Step 3: Run it for real**

Run: `npm run catalog:fetch`
Expected: one line per brand, e.g. `Yellow: 180 women's pieces of 1200`, then `Wrote N pieces`. N should be at least a few hundred. If a brand shows 0, open its feed URL in a browser to confirm, then continue with the others.

- [ ] **Step 4: Spot-check the filter**

Run: `node -e "const r=require('./data/catalog/raw.json');console.log(r.length);for(const x of r.sort(()=>Math.random()-.5).slice(0,15))console.log(x.brand,'|',x.name,'|',x.hints.slice(0,60))"`
Expected: women's wear only. If menswear or kidswear appears often, add the leaking word to `NOT_WOMEN` in `lib/build/feeds.ts`, add a matching case to `tests/build/feeds.test.ts`, and rerun both.

- [ ] **Step 5: Commit**

```bash
git add scripts/catalog/fetch.ts .gitignore data/catalog/raw.json
git commit -m "feat: catalog fetch script for Yellow, Twelve, Dorjibari, Kay Kraft"
```

---

## Task 7: Tag script and first catalog

Needs `GEMINI_API_KEY` from Task 0.

**Files:**
- Create: `scripts/catalog/tag.ts`
- Create (by running): `data/catalog/tags-cache.json`, `public/catalog.json`

- [ ] **Step 1: Create `scripts/catalog/tag.ts`**

```ts
// scripts/catalog/tag.ts — tag each new piece once with a vision model, then rebuild public/catalog.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { generateJSON, QuotaError } from "@/lib/ai/gemini";
import { TAG_SCHEMA, buildCatalog, normalizeTag, selectUntagged, tagKey, tagPrompt, type Tag } from "@/lib/build/tags";
import type { RawPiece } from "@/lib/build/feeds";

const RAW = "data/catalog/raw.json";
const CACHE = "data/catalog/tags-cache.json";
const OUT = "public/catalog.json";
const BUDGET = Number(process.env.TAG_BUDGET ?? 300);
const DELAY_MS = Number(process.env.TAG_DELAY_MS ?? 4500);
const MIN_PIECES = 30;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function smallJpeg(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`image ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = await sharp(buf).resize({ width: 512, height: 512, fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
  return out.toString("base64");
}

const raws: RawPiece[] = JSON.parse(readFileSync(RAW, "utf8"));
const cache: Record<string, Tag> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const todo = selectUntagged(raws, cache, BUDGET);
console.log(`${raws.length} pieces, ${Object.keys(cache).length} cached, tagging ${todo.length}`);

let done = 0;
for (const r of todo) {
  try {
    const images = await Promise.all(r.images.slice(0, 3).map(smallJpeg));
    const raw = await generateJSON<unknown>({
      parts: [{ text: tagPrompt(r, images.length) }, ...images.map((data) => ({ inline_data: { mime_type: "image/jpeg", data } }))],
      schema: TAG_SCHEMA,
    });
    const tag = normalizeTag(raw, images.length);
    if (tag) cache[tagKey(r)] = tag;
    else console.warn(`  ${r.id}: invalid tag, will retry next run`);
  } catch (e) {
    if (e instanceof QuotaError) { console.warn("Gemini quota reached; stopping for today."); break; }
    console.warn(`  ${r.id}: ${String(e).slice(0, 120)}`);
  }
  if (++done % 20 === 0) { writeFileSync(CACHE, JSON.stringify(cache)); console.log(`  ${done}/${todo.length}`); }
  await sleep(DELAY_MS);
}
writeFileSync(CACHE, JSON.stringify(cache));

const pieces = buildCatalog(raws, cache);
if (pieces.length < MIN_PIECES) {
  console.error(`Only ${pieces.length} usable pieces; keeping the previous ${OUT}.`);
  process.exit(1);
}
writeFileSync(OUT, JSON.stringify(pieces));
const bySlot: Record<string, number> = {};
for (const p of pieces) bySlot[p.slot] = (bySlot[p.slot] ?? 0) + 1;
console.log(`Wrote ${pieces.length} pieces to ${OUT}`, bySlot);
```

- [ ] **Step 2: Try a small batch**

Run: `$env:TAG_BUDGET=10; npm run catalog:tag` (PowerShell) or `TAG_BUDGET=10 npm run catalog:tag` (bash)
Expected: `tagging 10`, no errors except possibly "invalid tag", then it exits 1 with "Only N usable pieces" because 10 is below 30. That is correct. Open `data/catalog/tags-cache.json` and check that 3 or 4 tags look right against the product pages.

- [ ] **Step 3: Tag the rest**

Run: `npm run catalog:tag` (budget 300 by default; repeat on later days if the quota stops it)
Expected: `Wrote N pieces to public/catalog.json { saree: …, set3: …, … }` with every wearable slot above 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/catalog/tag.ts data/catalog/tags-cache.json public/catalog.json
git commit -m "feat: vision tagging of the catalog and first Bangladeshi catalog"
```

---

## Task 8: Switch the app to the new catalog

**Files:**
- Modify: `lib/catalog.ts` (full rewrite), `lib/photostore.ts`, `components/Catalog.tsx`, `components/Board.tsx:4-8`
- Test: `tests/catalog/search.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/catalog/search.test.ts
import { describe, expect, it } from "vitest";
import { searchPieces, type Piece } from "@/lib/catalog";

const piece = (over: Partial<Piece>): Piece => ({
  id: "a", slot: "saree", name: "Cotton Saree", brand: "Kay Kraft", url: "u", price: 4500, image: "i",
  colors: [{ name: "magenta", hex: "#b8246f" }], fabric: "cotton", work: "print", formality: 3,
  occasions: ["eid"], imageKind: "flat", ...over,
});

describe("searchPieces", () => {
  const all = [piece({}), piece({ id: "b", name: "Georgette Kurti", slot: "kurti", brand: "Yellow" })];
  it("filters by slot", () => {
    expect(searchPieces(all, "kurti", "").map((p) => p.id)).toEqual(["b"]);
  });
  it("matches name, brand or colour", () => {
    expect(searchPieces(all, "saree", "kay").map((p) => p.id)).toEqual(["a"]);
    expect(searchPieces(all, "saree", "magenta").map((p) => p.id)).toEqual(["a"]);
    expect(searchPieces(all, "saree", "silk")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/catalog/search.test.ts`
Expected: FAIL, `Piece` has no `colors` in the old module, or `searchPieces` does not match on brand.

- [ ] **Step 3: Rewrite `lib/catalog.ts`**

```ts
// lib/catalog.ts — Bangladeshi women's-wear catalog, rebuilt weekly by scripts/catalog
// (fetch → tag) and served from /catalog.json. Images proxy through /api/img.
import { create } from "zustand";
import type { Slot } from "./catalog/slots";
import type { Piece } from "./catalog/types";

export * from "./catalog/slots";
export * from "./catalog/types";
export type CatSlot = Slot;

export const CATALOG_URL = "/catalog.json";

interface CatalogState {
  pieces: Piece[];
  byId: Record<string, Piece>;
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
}

export const useCatalog = create<CatalogState>((set, get) => ({
  pieces: [],
  byId: {},
  status: "idle",
  load: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading" });
    try {
      const res = await fetch(CATALOG_URL);
      const pieces: Piece[] = await res.json();
      set({ pieces, byId: Object.fromEntries(pieces.map((p) => [p.id, p])), status: "ready" });
    } catch {
      set({ status: "error" });
    }
  },
}));

// Serve brand images through our cached proxy (fast + reliable everywhere).
export function imgUrl(image: string): string {
  return `/api/img?u=${encodeURIComponent(image)}`;
}

export function searchPieces(pieces: Piece[], slot: Slot, q: string): Piece[] {
  const term = q.trim().toLowerCase();
  return pieces.filter((p) => {
    if (p.slot !== slot) return false;
    if (!term) return true;
    return `${p.name} ${p.brand} ${p.colors.map((c) => c.name).join(" ")}`.toLowerCase().includes(term);
  });
}
```

- [ ] **Step 4: Update `lib/photostore.ts`**

Change the import line to:

```ts
import { useCatalog, displaced, type CatSlot } from "./catalog";
```

Change `tab: "dress",` to:

```ts
      tab: "saree",
```

Replace the whole `pick` implementation with:

```ts
      pick: (id) => {
        const p = useCatalog.getState().byId[id];
        if (!p) return;
        const eq = { ...get().equipped };
        if (eq[p.slot] === id) {
          delete eq[p.slot];
          set({ equipped: eq, active: null });
          return;
        }
        for (const s of displaced(p.slot)) delete eq[s];
        eq[p.slot] = id;
        set({ equipped: eq, active: id });
      },
```

In the `persist` options object, after `name: "eos-photo",` add a version bump so looks saved against the old foreign catalog are cleared:

```ts
      version: 2,
      migrate: () => ({ equipped: {}, savedLooks: [], viewMode: "photo" as ViewMode }),
```

- [ ] **Step 5: Show brand and price on catalog cards**

In `components/Catalog.tsx`, replace:

```tsx
                <span className="block truncate bg-white/70 px-1.5 py-1 text-[10px] font-medium tracking-wide text-neutral-700">{p.name}</span>
```

with:

```tsx
                <span className="block truncate bg-white/70 px-1.5 pt-1 text-[10px] font-medium tracking-wide text-neutral-700">{p.name}</span>
                <span className="block truncate bg-white/70 px-1.5 pb-1 text-[9px] tracking-wide text-neutral-500">
                  {p.brand}{p.price ? ` · ৳${p.price.toLocaleString("en-IN")}` : ""}
                </span>
```

- [ ] **Step 6: Point the Board at the new slots**

In `components/Board.tsx`, replace lines 4 to 8:

```tsx
import { useCatalog, SLOT_TINT, imgUrl, type CatSlot } from "@/lib/catalog";
import { usePhoto } from "@/lib/photostore";

const MAIN: CatSlot[] = ["dress", "top", "bottom", "outer"];
const EXTRA: CatSlot[] = ["shoes", "bag", "accessory"];
```

with:

```tsx
import { useCatalog, SLOT_TINT, imgUrl, TRYON_ORDER, EXTRAS, type CatSlot } from "@/lib/catalog";
import { usePhoto } from "@/lib/photostore";

const MAIN: CatSlot[] = TRYON_ORDER;
const EXTRA: CatSlot[] = EXTRAS;
```

(Task 18 rewrites the try-on part of this file; this step only keeps it compiling.)

- [ ] **Step 7: Run tests and typecheck**

Run: `npm test; npm run typecheck`
Expected: all tests PASS; typecheck clean.

- [ ] **Step 8: Check it in the browser**

Start the dev server (`npm run dev`, or the preview tool with a `.claude/launch.json` entry named `eos` running `npm run dev` on port 3000). Open the Board view. Expected: the Wardrobe panel shows the tabs Sarees, 3-piece, 2-piece, Kurtis, Tops, Bottoms, Ornas, Accessories; cards show brand and ৳ price; picking a saree then a kurti replaces the saree; Library shows the new pieces.

- [ ] **Step 9: Commit**

```bash
git add lib/catalog.ts lib/photostore.ts components/Catalog.tsx components/Board.tsx tests/catalog/search.test.ts
git commit -m "feat: switch the app to the Bangladeshi catalog and slots"
```

---

## Task 9: Weekly catalog workflow and old scripts

**Files:**
- Create: `.github/workflows/catalog.yml`
- Delete: `scripts/scrape.mjs`, `scripts/shopify.mjs`

- [ ] **Step 1: Create `.github/workflows/catalog.yml`**

```yaml
name: catalog
on:
  schedule:
    - cron: "0 21 * * 5" # Saturday 03:00 Dhaka
  workflow_dispatch:
permissions:
  contents: write
concurrency:
  group: catalog
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 90
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - name: Fetch feeds
        run: npm run catalog:fetch
      - name: Tag new pieces and rebuild catalog
        run: npm run catalog:tag
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          TAG_BUDGET: "300"
      - name: Commit
        run: |
          git config user.name "eos-bot"
          git config user.email "eos-bot@users.noreply.github.com"
          git add data/catalog public/catalog.json
          git diff --cached --quiet && exit 0
          git commit -m "catalog: weekly refresh"
          git pull --rebase --autostash
          git push
```

- [ ] **Step 2: Delete the old scrapers**

```bash
git rm scripts/scrape.mjs scripts/shopify.mjs
```

The workflow first runs after the branch is merged to `master`; GitHub reports YAML errors in the Actions tab on that push.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/catalog.yml
git commit -m "ci: weekly catalog refresh; remove old foreign-brand scrapers"
```

---

## Task 10: Tagger accuracy

**Files:**
- Create: `lib/build/tagEval.ts`, `scripts/catalog/eval.ts`
- Test: `tests/build/tagEval.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/build/tagEval.test.ts
import { describe, expect, it } from "vitest";
import { scoreTags, type GoldTag } from "@/lib/build/tagEval";
import type { Tag } from "@/lib/build/tags";

const tag = (over: Partial<Tag>): Tag => ({
  slot: "saree", colors: ["red"], fabric: "cotton", work: "none", formality: 3,
  occasions: ["eid"], tryon_image: 0, image_kind: "flat", tryon_ok: true, ...over,
});

describe("scoreTags", () => {
  it("scores slot, primary colour and occasions, ignoring unlabelled rows", () => {
    const gold: GoldTag[] = [
      { id: "a", slot: "saree", primary_color: "red", occasions: ["eid", "wedding"] },
      { id: "b", slot: "kurti", primary_color: "blue", occasions: ["office"] },
      { id: "c", slot: "", primary_color: "", occasions: [] },
    ];
    const pred = {
      a: tag({}),
      b: tag({ slot: "top", colors: ["green", "blue"], occasions: ["office", "casual"] }),
      c: tag({}),
    };
    const s = scoreTags(gold, pred);
    expect(s.n).toBe(2);
    expect(s.slotAccuracy).toBe(0.5);
    expect(s.colorAgreement).toBe(1);
    expect(s.occasionPrecision).toBeCloseTo(2 / 3);
    expect(s.occasionRecall).toBeCloseTo(2 / 3);
    expect(s.confusion.kurti.top).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/build/tagEval.test.ts`
Expected: FAIL, cannot resolve `@/lib/build/tagEval`.

- [ ] **Step 3: Create `lib/build/tagEval.ts`**

```ts
// lib/build/tagEval.ts — how often the vision tagger agrees with Fahim's hand labels.
import type { Slot } from "@/lib/catalog/slots";
import type { Occasion } from "@/lib/catalog/types";
import type { Tag } from "./tags";

export interface GoldTag { id: string; slot: Slot | "skip" | ""; primary_color: string; occasions: Occasion[] }

export interface TagScore {
  n: number;
  slotAccuracy: number;
  colorAgreement: number;
  occasionPrecision: number;
  occasionRecall: number;
  confusion: Record<string, Record<string, number>>;
}

export function scoreTags(gold: GoldTag[], pred: Record<string, Tag>): TagScore {
  const rows = gold.filter((g) => g.slot !== "" && pred[g.id]);
  let slotHits = 0, colorHits = 0, colorN = 0, occHits = 0, occPred = 0, occGold = 0;
  const confusion: Record<string, Record<string, number>> = {};
  for (const g of rows) {
    const p = pred[g.id];
    if (p.slot === g.slot) slotHits++;
    confusion[g.slot] ??= {};
    confusion[g.slot][p.slot] = (confusion[g.slot][p.slot] ?? 0) + 1;
    if (g.slot !== "skip" && g.primary_color) {
      colorN++;
      if (p.colors.includes(g.primary_color)) colorHits++;
    }
    occHits += p.occasions.filter((o) => g.occasions.includes(o)).length;
    occPred += p.occasions.length;
    occGold += g.occasions.length;
  }
  const div = (a: number, b: number) => (b ? a / b : 0);
  return {
    n: rows.length,
    slotAccuracy: div(slotHits, rows.length),
    colorAgreement: div(colorHits, colorN),
    occasionPrecision: div(occHits, occPred),
    occasionRecall: div(occHits, occGold),
    confusion,
  };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run tests/build/tagEval.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `scripts/catalog/eval.ts`**

```ts
// scripts/catalog/eval.ts — first run writes a labelling template; later runs score the tagger.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tagKey, type Tag } from "@/lib/build/tags";
import { scoreTags, type GoldTag } from "@/lib/build/tagEval";
import type { RawPiece } from "@/lib/build/feeds";

const GOLD = "data/labels/tags-gold.json";
const OUT = "public/bench/tagger.json";
const SAMPLE = 60;

const raws: RawPiece[] = JSON.parse(readFileSync("data/catalog/raw.json", "utf8"));
const cache: Record<string, Tag> = JSON.parse(readFileSync("data/catalog/tags-cache.json", "utf8"));
const pred: Record<string, Tag> = {};
for (const r of raws) if (cache[tagKey(r)]) pred[r.id] = cache[tagKey(r)];

if (!existsSync(GOLD)) {
  const order = (id: string) => createHash("sha1").update(id).digest("hex");
  const sample = raws.filter((r) => pred[r.id]).sort((a, b) => order(a.id).localeCompare(order(b.id))).slice(0, SAMPLE);
  mkdirSync("data/labels", { recursive: true });
  writeFileSync(GOLD, JSON.stringify(sample.map((r) => ({
    id: r.id, name: r.name, url: r.url, images: r.images.slice(0, 3),
    slot: "", primary_color: "", occasions: [],
  })), null, 2));
  console.log(`Wrote ${sample.length} rows to ${GOLD}. Fill slot, primary_color and occasions by hand, then run again.`);
  console.log("slot: saree | set3 | set2 | kurti | top | bottom | orna | accessory | skip");
  process.exit(0);
}

const gold: GoldTag[] = JSON.parse(readFileSync(GOLD, "utf8"));
const score = scoreTags(gold, pred);
mkdirSync("public/bench", { recursive: true });
writeFileSync(OUT, JSON.stringify({ ...score, scoredAt: new Date().toISOString() }, null, 2));
console.log(score);
```

- [ ] **Step 6: Generate the template**

Run: `npm run catalog:eval`
Expected: `Wrote 60 rows to data/labels/tags-gold.json`.

- [ ] **Step 7: Fahim labels the 60 rows**

Fahim opens each `url` and fills `slot`, `primary_color` (one name from the palette in `lib/build/tags.ts`) and `occasions`. Then run `npm run catalog:eval` again.
Expected: a score object, and `public/bench/tagger.json` written.

- [ ] **Step 8: Commit**

```bash
git add lib/build/tagEval.ts scripts/catalog/eval.ts tests/build/tagEval.test.ts data/labels public/bench/tagger.json
git commit -m "feat: tagger accuracy against hand labels"
```

---

## Task 11: Try-on types and chain

**Files:**
- Create: `lib/tryon/types.ts`, `lib/tryon/chain.ts`
- Test: `tests/tryon/chain.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/tryon/chain.test.ts
import { describe, expect, it, vi } from "vitest";
import { providerOrder, runChain, outOfCapacity } from "@/lib/tryon/chain";
import type { Provider, ProviderId, TryOnInput, TryOnResult } from "@/lib/tryon/types";

const input: TryOnInput = { person: "data:image/jpeg;base64,x", garment: "https://g", slot: "saree", description: "red saree" };
const fake = (id: ProviderId, r: Omit<TryOnResult, "provider">): Provider => ({
  id, run: vi.fn().mockResolvedValue({ ...r, provider: id } as TryOnResult),
});

describe("providerOrder", () => {
  it("full-length pieces start with OOTDiffusion", () => {
    expect(providerOrder("saree", false)).toEqual(["ootd", "idm"]);
    expect(providerOrder("kurti", true)).toEqual(["ootd", "idm", "fal"]);
  });
  it("tops start with IDM-VTON, bottoms only use OOTDiffusion", () => {
    expect(providerOrder("top", false)).toEqual(["idm", "ootd"]);
    expect(providerOrder("bottom", false)).toEqual(["ootd"]);
  });
});

describe("runChain", () => {
  it("stops at the first success", async () => {
    const a = fake("ootd", { ok: false, reason: "quota", detail: "q" });
    const b = fake("idm", { ok: true, image: "data:img" });
    const c = fake("fal", { ok: true, image: "data:other" });
    const { result, tried } = await runChain(input, { ootd: a, idm: b, fal: c }, ["ootd", "idm", "fal"]);
    expect(result).toMatchObject({ ok: true, provider: "idm" });
    expect(tried.map((t) => t.provider)).toEqual(["ootd", "idm"]);
    expect(c.run).not.toHaveBeenCalled();
  });
  it("skips excluded and missing providers", async () => {
    const b = fake("idm", { ok: true, image: "data:img" });
    const { result } = await runChain(input, { ootd: undefined, idm: b, fal: undefined }, ["ootd", "idm"], ["ootd"]);
    expect(result.provider).toBe("idm");
  });
  it("reports unavailable when nothing ran", async () => {
    const { result, tried } = await runChain(input, { ootd: undefined, idm: undefined, fal: undefined }, ["ootd"]);
    expect(result).toMatchObject({ ok: false, reason: "unavailable" });
    expect(tried).toEqual([]);
  });
});

describe("outOfCapacity", () => {
  it("is true when every failure is quota or unavailable and one is quota", () => {
    expect(outOfCapacity([
      { ok: false, provider: "ootd", reason: "quota", detail: "" },
      { ok: false, provider: "idm", reason: "unavailable", detail: "" },
    ])).toBe(true);
  });
  it("is false for real errors or no quota at all", () => {
    expect(outOfCapacity([{ ok: false, provider: "ootd", reason: "error", detail: "" }])).toBe(false);
    expect(outOfCapacity([{ ok: false, provider: "ootd", reason: "unavailable", detail: "" }])).toBe(false);
    expect(outOfCapacity([])).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/tryon/chain.test.ts`
Expected: FAIL, cannot resolve `@/lib/tryon/chain`.

- [ ] **Step 3: Create `lib/tryon/types.ts`**

```ts
// lib/tryon/types.ts — one interface for every try-on model.
import type { Slot } from "@/lib/catalog/slots";

export type ProviderId = "ootd" | "idm" | "fal";

export interface TryOnInput {
  /** The person photo as a data URL. */
  person: string;
  /** The garment image: a brand https URL or a data URL. */
  garment: string;
  slot: Slot;
  /** Short garment description, e.g. "maroon georgette saree". */
  description: string;
}

export type TryOnResult =
  | { ok: true; provider: ProviderId; image: string }
  | { ok: false; provider: ProviderId; reason: "quota" | "unavailable" | "error"; detail: string };

export interface Provider {
  id: ProviderId;
  run(input: TryOnInput): Promise<TryOnResult>;
}

export type Providers = Record<ProviderId, Provider | undefined>;
```

- [ ] **Step 4: Create `lib/tryon/chain.ts`**

```ts
// lib/tryon/chain.ts — which model to ask first, and falling through to the next.
import type { Slot } from "@/lib/catalog/slots";
import type { ProviderId, Providers, TryOnInput, TryOnResult } from "./types";

/** OOTDiffusion handles full-length pieces; IDM-VTON is upper-body only; fal is the paid last resort. */
export function providerOrder(slot: Slot, hasFal: boolean): ProviderId[] {
  const base: ProviderId[] = slot === "top" ? ["idm", "ootd"] : slot === "bottom" ? ["ootd"] : ["ootd", "idm"];
  return hasFal ? [...base, "fal"] : base;
}

export async function runChain(
  input: TryOnInput,
  providers: Providers,
  order: ProviderId[],
  exclude: ProviderId[] = [],
): Promise<{ result: TryOnResult; tried: TryOnResult[] }> {
  const tried: TryOnResult[] = [];
  for (const id of order) {
    const p = providers[id];
    if (!p || exclude.includes(id)) continue;
    const r = await p.run(input);
    tried.push(r);
    if (r.ok) return { result: r, tried };
  }
  const last = tried.at(-1);
  return { result: last ?? { ok: false, provider: order[0] ?? "ootd", reason: "unavailable", detail: "no provider available" }, tried };
}

/** Every model said "no GPU left" or was down, and at least one was a quota answer. */
export function outOfCapacity(tried: TryOnResult[]): boolean {
  return tried.some((r) => !r.ok && r.reason === "quota")
    && tried.every((r) => !r.ok && (r.reason === "quota" || r.reason === "unavailable"));
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npx vitest run tests/tryon/chain.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/tryon tests/tryon
git commit -m "feat: try-on provider chain"
```

---

## Task 12: Hugging Face providers

**Files:**
- Create: `lib/tryon/hf.ts`
- Test: `tests/tryon/hf.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/tryon/hf.test.ts
import { describe, expect, it, vi } from "vitest";
import { classifyError, firstImageUrl, makeProvider, ootdCategory } from "@/lib/tryon/hf";
import type { TryOnInput } from "@/lib/tryon/types";

const input: TryOnInput = { person: "data:image/jpeg;base64,x", garment: "https://g", slot: "saree", description: "red saree" };
const deps = () => ({
  loadImage: vi.fn().mockResolvedValue(new Blob(["x"])),
  fetchResult: vi.fn().mockResolvedValue("data:image/png;base64,R"),
});

describe("ootdCategory", () => {
  it("maps slots to OOTDiffusion categories", () => {
    expect(ootdCategory("saree")).toBe("Dress");
    expect(ootdCategory("set3")).toBe("Dress");
    expect(ootdCategory("kurti")).toBe("Upper-body");
    expect(ootdCategory("top")).toBe("Upper-body");
    expect(ootdCategory("bottom")).toBe("Lower-body");
  });
});

describe("classifyError", () => {
  it("recognises quota and downtime", () => {
    expect(classifyError(new Error("You have exceeded your GPU quota (60s requested vs. 0s left)."))).toBe("quota");
    expect(classifyError({ message: "ZeroGPU quota exceeded" })).toBe("quota");
    expect(classifyError(new Error("Space is sleeping"))).toBe("unavailable");
    expect(classifyError(new Error("try-on timed out"))).toBe("unavailable");
    expect(classifyError(new Error("CUDA error"))).toBe("error");
  });
});

describe("firstImageUrl", () => {
  it("finds the first url in Gradio output shapes", () => {
    expect(firstImageUrl([{ url: "https://a/1.png", path: "p" }, { url: "https://a/2.png" }])).toBe("https://a/1.png");
    expect(firstImageUrl([[{ image: { url: "https://a/g.png" }, caption: null }]])).toBe("https://a/g.png");
    expect(firstImageUrl(["https://a/s.png"])).toBe("https://a/s.png");
    expect(firstImageUrl([null, { caption: "x" }])).toBeNull();
  });
});

describe("makeProvider", () => {
  it("returns the fetched image on success", async () => {
    const d = deps();
    const p = makeProvider("ootd", async () => [[{ image: { url: "https://x.hf.space/file=o.png" } }]], d);
    await expect(p.run(input)).resolves.toEqual({ ok: true, provider: "ootd", image: "data:image/png;base64,R" });
    expect(d.fetchResult).toHaveBeenCalledWith("https://x.hf.space/file=o.png");
    expect(d.loadImage).toHaveBeenCalledTimes(2);
  });
  it("classifies thrown errors", async () => {
    const p = makeProvider("idm", async () => { throw new Error("exceeded your GPU quota"); }, deps());
    await expect(p.run(input)).resolves.toMatchObject({ ok: false, provider: "idm", reason: "quota" });
  });
  it("fails when the response has no image", async () => {
    const p = makeProvider("idm", async () => [null], deps());
    await expect(p.run(input)).resolves.toMatchObject({ ok: false, reason: "error" });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/tryon/hf.test.ts`
Expected: FAIL, cannot resolve `@/lib/tryon/hf`.

- [ ] **Step 3: Create `lib/tryon/hf.ts`**

```ts
// lib/tryon/hf.ts — free try-on models on Hugging Face ZeroGPU Spaces (APIs checked 2026-09-23).
// Runs in the browser (the visitor's own anonymous quota) and in Node (benchmark, with HF_TOKEN).
import { Client, handle_file } from "@gradio/client";
import type { Slot } from "@/lib/catalog/slots";
import type { Provider, ProviderId, TryOnInput } from "./types";

export const SPACES = { ootd: "levihsu/OOTDiffusion", idm: "yisol/IDM-VTON" } as const;

export interface HfDeps {
  /** Turn a data URL or https URL into a Blob the Space can receive. */
  loadImage: (src: string) => Promise<Blob>;
  /** Turn the Space's temporary result URL into a data URL. */
  fetchResult: (url: string) => Promise<string>;
  hfToken?: string;
  timeoutMs?: number;
}

type Call = (input: TryOnInput, person: Blob, garment: Blob) => Promise<unknown>;

export function ootdCategory(slot: Slot): "Dress" | "Upper-body" | "Lower-body" {
  if (slot === "top" || slot === "kurti") return "Upper-body";
  if (slot === "bottom") return "Lower-body";
  return "Dress";
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

export function classifyError(e: unknown): "quota" | "unavailable" | "error" {
  const m = errMsg(e);
  if (/quota|exceeded your gpu|zerogpu/i.test(m)) return "quota";
  if (/paused|sleeping|building|not found|503|timed out|timeout/i.test(m)) return "unavailable";
  return "error";
}

export function firstImageUrl(data: unknown): string | null {
  if (typeof data === "string") return /^https?:\/\//.test(data) ? data : null;
  if (Array.isArray(data)) {
    for (const d of data) {
      const u = firstImageUrl(d);
      if (u) return u;
    }
    return null;
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.url === "string") return o.url;
    for (const v of Object.values(o)) {
      const u = firstImageUrl(v);
      if (u) return u;
    }
  }
  return null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("try-on timed out")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export function makeProvider(id: ProviderId, call: Call, deps: HfDeps): Provider {
  return {
    id,
    async run(input) {
      try {
        const [person, garment] = await Promise.all([deps.loadImage(input.person), deps.loadImage(input.garment)]);
        const data = await withTimeout(call(input, person, garment), deps.timeoutMs ?? 120_000);
        const url = firstImageUrl(data);
        if (!url) return { ok: false, provider: id, reason: "error", detail: "no image in response" };
        return { ok: true, provider: id, image: await deps.fetchResult(url) };
      } catch (e) {
        return { ok: false, provider: id, reason: classifyError(e), detail: errMsg(e).slice(0, 200) };
      }
    },
  };
}

const connect = (space: string, deps: HfDeps) =>
  Client.connect(space, deps.hfToken ? { hf_token: deps.hfToken as `hf_${string}` } : {});

export function ootdProvider(deps: HfDeps): Provider {
  return makeProvider("ootd", async (input, person, garment) => {
    const app = await connect(SPACES.ootd, deps);
    const r = await app.predict("/process_dc", {
      vton_img: handle_file(person),
      garm_img: handle_file(garment),
      category: ootdCategory(input.slot),
      n_samples: 1,
      n_steps: 20,
      image_scale: 2,
      seed: -1,
    });
    return r.data;
  }, deps);
}

export function idmProvider(deps: HfDeps): Provider {
  return makeProvider("idm", async (input, person, garment) => {
    const app = await connect(SPACES.idm, deps);
    // Inputs, in order: human (image editor), garment, description, auto-mask, auto-crop, steps, seed.
    const r = await app.predict("/tryon", [
      { background: handle_file(person), layers: [], composite: null },
      handle_file(garment),
      input.description,
      true,
      false,
      30,
      42,
    ]);
    return r.data;
  }, deps);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run tests/tryon/hf.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/tryon/hf.ts tests/tryon/hf.test.ts
git commit -m "feat: OOTDiffusion and IDM-VTON providers on free Spaces"
```

---

## Task 13: Rate limiter, fal route and result proxy

**Files:**
- Create: `lib/ratelimit.ts`, `lib/tryon/falClient.ts`, `app/api/result/route.ts`
- Rewrite: `app/api/tryon/route.ts`
- Delete: `components/Photoreal.tsx`, `lib/describe.ts`
- Test: `tests/ratelimit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ratelimit.test.ts
import { describe, expect, it } from "vitest";
import { createLimiter } from "@/lib/ratelimit";

describe("createLimiter", () => {
  it("allows up to the limit per key within the window", () => {
    let t = 0;
    const allow = createLimiter(2, 1000, () => t);
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(false);
    expect(allow("b")).toBe(true);
    t = 1001;
    expect(allow("a")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/ratelimit.test.ts`
Expected: FAIL, cannot resolve `@/lib/ratelimit`.

- [ ] **Step 3: Create `lib/ratelimit.ts`**

```ts
// lib/ratelimit.ts — sliding-window limiter kept in memory. Per server instance, so it is a
// speed bump for one visitor rather than a hard guarantee; enough to protect free quotas.
export function createLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    return true;
  };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run tests/ratelimit.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `app/api/tryon/route.ts` as the fal-only route**

```ts
// app/api/tryon/route.ts — optional paid fallback (fal.ai FASHN), used only when FAL_KEY is set.
// Free try-on runs in the browser against Hugging Face Spaces; see lib/tryon/hf.ts.
import { NextRequest, NextResponse } from "next/server";
import { createLimiter } from "@/lib/ratelimit";
import { isWearable, SLOT_VALUES, type Slot } from "@/lib/catalog/slots";

export const runtime = "nodejs";
export const maxDuration = 60;

const limiter = createLimiter(10, 60 * 60 * 1000);
const category = (slot: Slot) => (slot === "top" || slot === "kurti" ? "tops" : slot === "bottom" ? "bottoms" : "one-pieces");

export async function GET() {
  return NextResponse.json({ fal: Boolean(process.env.FAL_KEY) });
}

export async function POST(req: NextRequest) {
  const key = process.env.FAL_KEY;
  if (!key) return NextResponse.json({ error: "no_key", message: "Paid try-on is not configured." }, { status: 503 });

  let body: { person?: string; garment?: string; slot?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const { person, garment, slot } = body;
  if (!person?.startsWith("data:image/") || !garment?.startsWith("https://") || !SLOT_VALUES.includes(slot as Slot) || !isWearable(slot as Slot)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!limiter(ip)) {
    return NextResponse.json({ error: "rate_limited", message: "Too many try-ons this hour. Please try later." }, { status: 429 });
  }

  try {
    const res = await fetch("https://fal.run/fal-ai/fashn/tryon/v1.6", {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model_image: person, garment_image: garment, category: category(slot as Slot), mode: "performance" }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      const message = /balance|locked|exhausted|credit|402/i.test(detail) ? "fal.ai balance is used up." : "Try-on failed. Please try again.";
      return NextResponse.json({ error: "provider_error", message, detail }, { status: 502 });
    }
    const j = await res.json();
    const url: string | undefined = j?.image?.url || j?.images?.[0]?.url;
    if (!url) return NextResponse.json({ error: "no_output" }, { status: 502 });
    const img = await fetch(url);
    const ct = img.headers.get("content-type") || "image/png";
    const b64 = Buffer.from(await img.arrayBuffer()).toString("base64");
    return NextResponse.json({ image: `data:${ct};base64,${b64}` });
  } catch (e) {
    return NextResponse.json({ error: "fetch_failed", detail: String(e).slice(0, 160) }, { status: 500 });
  }
}
```

- [ ] **Step 6: Create `lib/tryon/falClient.ts`**

```ts
// lib/tryon/falClient.ts — browser-side provider that asks our fal route.
import type { Provider } from "./types";

export function falProvider(fetchImpl: typeof fetch = fetch): Provider {
  return {
    id: "fal",
    async run(input) {
      try {
        const res = await fetchImpl("/api/tryon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person: input.person, garment: input.garment, slot: input.slot }),
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.image) return { ok: true, provider: "fal", image: d.image };
        const reason = res.status === 503 || res.status === 429 ? "unavailable" : /balance/i.test(d.message ?? "") ? "quota" : "error";
        return { ok: false, provider: "fal", reason, detail: d.message ?? `HTTP ${res.status}` };
      } catch (e) {
        return { ok: false, provider: "fal", reason: "error", detail: String(e).slice(0, 200) };
      }
    },
  };
}
```

- [ ] **Step 7: Create `app/api/result/route.ts`**

```ts
// GET /api/result?u=<https://*.hf.space/... image> — fetches a try-on result so the browser can
// read its pixels for the judge. Never cached: these images show a real person.
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return new Response("missing url", { status: 400 });
  let url: URL;
  try { url = new URL(u); } catch { return new Response("bad url", { status: 400 }); }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".hf.space")) return new Response("forbidden host", { status: 403 });
  try {
    const res = await fetch(url, { cache: "no-store" });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !(ct.startsWith("image/") || ct === "application/octet-stream")) return new Response("not an image", { status: 502 });
    return new Response(await res.arrayBuffer(), {
      headers: { "Content-Type": ct.startsWith("image/") ? ct : "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
```

- [ ] **Step 8: Remove the unmounted Photoreal panel**

```bash
git rm components/Photoreal.tsx lib/describe.ts
```

Run: `npm run typecheck`
Expected: clean. If anything still imports `describe` or `Photoreal`, the error names the file; remove that import.

- [ ] **Step 9: Commit**

```bash
git add lib/ratelimit.ts lib/tryon/falClient.ts app/api/tryon/route.ts app/api/result/route.ts tests/ratelimit.test.ts
git commit -m "feat: fal-only try-on route, result proxy, rate limiter; drop unmounted Photoreal"
```

---

## Task 14: Node image helpers

**Files:**
- Create: `lib/tryon/node.ts`

- [ ] **Step 1: Create `lib/tryon/node.ts`**

```ts
// lib/tryon/node.ts — image loading for the benchmark and smoke test (Node only).
import { readFileSync } from "node:fs";
import sharp from "sharp";
import type { HfDeps } from "./hf";

const UA = "EosBench/1.0 (+https://github.com/AhmedFahim13/eos)";

export async function fileToDataUrl(path: string, max = 1024): Promise<string> {
  const buf = await sharp(readFileSync(path)).rotate().resize({ width: max, height: max, fit: "inside" }).jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

export function nodeDeps(hfToken?: string): HfDeps {
  return {
    hfToken,
    async loadImage(src) {
      const res = await fetch(src, { headers: src.startsWith("data:") ? {} : { "User-Agent": UA } });
      if (!res.ok) throw new Error(`image ${res.status} ${src.slice(0, 80)}`);
      return res.blob();
    },
    async fetchResult(url) {
      const res = await fetch(url, { headers: hfToken ? { Authorization: `Bearer ${hfToken}` } : {} });
      if (!res.ok) throw new Error(`result ${res.status}`);
      const ct = res.headers.get("content-type")?.startsWith("image/") ? res.headers.get("content-type")! : "image/png";
      return `data:${ct};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    },
  };
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npm run typecheck`
Expected: clean.

```bash
git add lib/tryon/node.ts
git commit -m "feat: Node image helpers for benchmark and smoke test"
```

---

## Task 15: Real try-on smoke test

Needs `HF_TOKEN` and `public/samples/model.jpg` from Task 0, and `public/catalog.json` from Task 7.

**Files:**
- Create: `scripts/tryon-smoke.ts`

- [ ] **Step 1: Create `scripts/tryon-smoke.ts`**

```ts
// scripts/tryon-smoke.ts — one real try-on per provider, to check the Space APIs and time a run.
// Usage: npm run tryon:smoke -- [person.jpg] [pieceId]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { idmProvider, ootdProvider } from "@/lib/tryon/hf";
import { dataUrlToBuffer, fileToDataUrl, nodeDeps } from "@/lib/tryon/node";
import { SLOT_NOUN, type Piece } from "@/lib/catalog";

const [personPath = "public/samples/model.jpg", pieceId] = process.argv.slice(2);
const pieces: Piece[] = JSON.parse(readFileSync("public/catalog.json", "utf8"));
const piece = pieces.find((p) => p.id === pieceId) ?? pieces.find((p) => p.slot === "kurti") ?? pieces[0];
const person = await fileToDataUrl(personPath);
const deps = nodeDeps(process.env.HF_TOKEN);
const input = { person, garment: piece.image, slot: piece.slot, description: `${piece.colors[0]?.name ?? ""} ${SLOT_NOUN[piece.slot]}`.trim() };

console.log(`Piece: ${piece.id} (${piece.slot}) ${piece.name}`);
mkdirSync("data/smoke", { recursive: true });
for (const p of [ootdProvider(deps), idmProvider(deps)]) {
  const t0 = Date.now();
  const r = await p.run(input);
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.ok) {
    writeFileSync(`data/smoke/${p.id}.png`, dataUrlToBuffer(r.image));
    console.log(`${p.id}: ok in ${s}s → data/smoke/${p.id}.png`);
  } else {
    console.log(`${p.id}: ${r.reason} in ${s}s: ${r.detail}`);
  }
}
```

- [ ] **Step 2: Run it**

Run: `npm run tryon:smoke`
Expected: `ootd: ok in …s` and `idm: ok in …s`, and two images in `data/smoke/`. Open both and check the person is wearing the kurti.

If a provider fails with `error`, read `detail`. The likely causes are a changed input order on IDM-VTON (fetch `https://yisol-idm-vton.hf.space/config` and compare `dependencies[].inputs` for `api_name: "tryon"`) or a changed category list on OOTDiffusion (`https://levihsu-ootdiffusion.hf.space/gradio_api/info`). Fix `lib/tryon/hf.ts`, add a matching test, rerun.

- [ ] **Step 3: Record run times**

Write the two times in the commit message. They show how many try-ons fit in the 3.5-minute daily quota.

- [ ] **Step 4: Commit**

```bash
git add scripts/tryon-smoke.ts
git commit -m "chore: try-on smoke test (ootd Xs, idm Ys per run)"
```

---

## Task 16: Judge, colour science

**Files:**
- Create: `lib/judge/pixels.ts`, `lib/judge/color.ts`, `lib/judge/regions.ts`
- Create: `tests/helpers/pixels.ts`
- Test: `tests/judge/color.test.ts`

- [ ] **Step 1: Create the test helper `tests/helpers/pixels.ts`**

```ts
import type { Pixels } from "@/lib/judge/pixels";

export function makePixels(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/judge/color.test.ts
import { describe, expect, it } from "vitest";
import { deltaE, dominantLabs, hexToLab, srgbToLab } from "@/lib/judge/color";
import { makePixels } from "../helpers/pixels";

const FULL = { x0: 0, y0: 0, x1: 1, y1: 1 };

describe("srgbToLab", () => {
  it("matches reference values", () => {
    const w = srgbToLab(255, 255, 255);
    expect(w[0]).toBeCloseTo(100, 1);
    expect(Math.abs(w[1])).toBeLessThan(0.5);
    expect(srgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 5);
    const red = srgbToLab(255, 0, 0);
    expect(red[0]).toBeCloseTo(53.24, 0);
    expect(red[1]).toBeCloseTo(80.09, 0);
    expect(red[2]).toBeCloseTo(67.2, 0);
  });
  it("reads hex", () => {
    expect(deltaE(hexToLab("#ff0000"), srgbToLab(255, 0, 0))).toBeCloseTo(0, 6);
  });
});

describe("dominantLabs", () => {
  it("finds both halves of a two-colour image", () => {
    const px = makePixels(40, 40, (x) => (x < 20 ? [200, 20, 30] : [30, 60, 190]));
    const dom = dominantLabs(px, FULL, 3);
    const red = srgbToLab(200, 20, 30), blue = srgbToLab(30, 60, 190);
    expect(dom.some((d) => deltaE(d.lab, red) < 1)).toBe(true);
    expect(dom.some((d) => deltaE(d.lab, blue) < 1)).toBe(true);
    expect(dom.reduce((s, d) => s + d.share, 0)).toBeCloseTo(1, 5);
  });
  it("respects the box", () => {
    const px = makePixels(40, 40, (x) => (x < 20 ? [200, 20, 30] : [30, 60, 190]));
    const dom = dominantLabs(px, { x0: 0, y0: 0, x1: 0.4, y1: 1 }, 2);
    expect(dom[0].share).toBeCloseTo(1, 5);
    expect(deltaE(dom[0].lab, srgbToLab(200, 20, 30))).toBeLessThan(1);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run tests/judge/color.test.ts`
Expected: FAIL, cannot resolve `@/lib/judge/color`.

- [ ] **Step 4: Create `lib/judge/pixels.ts`**

```ts
// lib/judge/pixels.ts — decoded RGBA pixels, the same in the browser (canvas) and Node (sharp).
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}
```

- [ ] **Step 5: Create `lib/judge/regions.ts`**

```ts
// lib/judge/regions.ts — where to look in a standing, front-facing portrait, as fractions of the frame.
import type { Slot } from "@/lib/catalog/slots";
import { srgbToLab, type Lab } from "./color";
import type { Pixels } from "./pixels";

export interface Box { x0: number; y0: number; x1: number; y1: number }

export const HEAD: Box = { x0: 0.3, y0: 0.02, x1: 0.7, y1: 0.2 };

export function garmentBox(slot: Slot): Box {
  if (slot === "top") return { x0: 0.25, y0: 0.2, x1: 0.75, y1: 0.5 };
  if (slot === "bottom") return { x0: 0.28, y0: 0.52, x1: 0.72, y1: 0.9 };
  return { x0: 0.25, y0: 0.22, x1: 0.75, y1: 0.8 };
}

export function pixelBox(px: Pixels, box: Box) {
  const x0 = Math.floor(box.x0 * px.width), x1 = Math.max(x0 + 1, Math.floor(box.x1 * px.width));
  const y0 = Math.floor(box.y0 * px.height), y1 = Math.max(y0 + 1, Math.floor(box.y1 * px.height));
  return { x0, x1, y0, y1 };
}

/** Average RGB of each cell of a cols × rows grid laid over the box. */
function cellMeans(px: Pixels, box: Box, cols: number, rows: number): [number, number, number][] {
  const b = pixelBox(px, box);
  const out: [number, number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx0 = b.x0 + Math.floor((c * (b.x1 - b.x0)) / cols), cx1 = Math.max(cx0 + 1, b.x0 + Math.floor(((c + 1) * (b.x1 - b.x0)) / cols));
      const cy0 = b.y0 + Math.floor((r * (b.y1 - b.y0)) / rows), cy1 = Math.max(cy0 + 1, b.y0 + Math.floor(((r + 1) * (b.y1 - b.y0)) / rows));
      let R = 0, G = 0, B = 0, n = 0;
      for (let y = cy0; y < cy1; y++) {
        for (let x = cx0; x < cx1; x++) {
          const i = (y * px.width + x) * 4;
          R += px.data[i]; G += px.data[i + 1]; B += px.data[i + 2]; n++;
        }
      }
      out.push([R / n, G / n, B / n]);
    }
  }
  return out;
}

export function labGrid(px: Pixels, box: Box, cols: number, rows: number): Lab[] {
  return cellMeans(px, box, cols, rows).map(([r, g, b]) => srgbToLab(r, g, b));
}

export function grayGrid(px: Pixels, box: Box, cols: number, rows: number): number[] {
  return cellMeans(px, box, cols, rows).map(([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b);
}
```

- [ ] **Step 6: Create `lib/judge/color.ts`**

```ts
// lib/judge/color.ts — sRGB → CIELAB, colour distance, and the dominant colours of a region.
import type { Pixels } from "./pixels";
import { pixelBox, type Box } from "./regions";

export type Lab = [number, number, number];

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);

export function srgbToLab(r: number, g: number, b: number): Lab {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 distance. About 2 is barely visible; above 20 is clearly a different colour. */
export const deltaE = (a: Lab, b: Lab): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function hexToLab(hex: string): Lab {
  const n = parseInt(hex.replace("#", ""), 16);
  return srgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

function sampleLabs(px: Pixels, box: Box, maxSamples = 2000): Lab[] {
  const b = pixelBox(px, box);
  const area = (b.x1 - b.x0) * (b.y1 - b.y0);
  const step = Math.max(1, Math.floor(Math.sqrt(area / maxSamples)));
  const out: Lab[] = [];
  for (let y = b.y0; y < b.y1; y += step) {
    for (let x = b.x0; x < b.x1; x += step) {
      const i = (y * px.width + x) * 4;
      out.push(srgbToLab(px.data[i], px.data[i + 1], px.data[i + 2]));
    }
  }
  return out;
}

/** k-means in Lab with a deterministic start (lightness quantiles); largest cluster first. */
export function dominantLabs(px: Pixels, box: Box, k = 3, iters = 8): { lab: Lab; share: number }[] {
  const pts = sampleLabs(px, box);
  if (pts.length === 0) return [];
  const sorted = [...pts].sort((a, b) => a[0] - b[0]);
  let centers: Lab[] = Array.from({ length: k }, (_, i) => sorted[Math.min(sorted.length - 1, Math.floor(((i + 0.5) * sorted.length) / k))]);
  let assign: number[] = [];
  for (let it = 0; it < iters; it++) {
    assign = pts.map((p) => {
      let best = 0, bd = Infinity;
      centers.forEach((c, j) => { const d = deltaE(p, c); if (d < bd) { bd = d; best = j; } });
      return best;
    });
    centers = centers.map((c, j) => {
      let L = 0, A = 0, B = 0, n = 0;
      pts.forEach((p, i) => { if (assign[i] === j) { L += p[0]; A += p[1]; B += p[2]; n++; } });
      return n ? ([L / n, A / n, B / n] as Lab) : c;
    });
  }
  const counts = centers.map((_, j) => assign.filter((a) => a === j).length);
  return centers
    .map((lab, j) => ({ lab, share: counts[j] / pts.length }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
}
```

- [ ] **Step 7: Run the test to see it pass**

Run: `npx vitest run tests/judge/color.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 8: Commit**

```bash
git add lib/judge tests/judge tests/helpers
git commit -m "feat: judge colour science and portrait regions"
```

---

## Task 17: Judge, face hash and verdict

**Files:**
- Create: `lib/judge/hash.ts`, `lib/judge/judge.ts`, `lib/judge/thresholds.json`
- Test: `tests/judge/judge.test.ts`

- [ ] **Step 1: Create `lib/judge/thresholds.json`**

```json
{ "colorDeltaE": 20, "headSimilarity": 0.75, "minChange": 8 }
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/judge/judge.test.ts
import { describe, expect, it } from "vitest";
import { dHash, hashSimilarity } from "@/lib/judge/hash";
import { decide, judge, measure } from "@/lib/judge/judge";
import { HEAD } from "@/lib/judge/regions";
import { makePixels } from "../helpers/pixels";

const W = 90, H = 120;
const RED = [192, 40, 45] as [number, number, number];
const piece = { slot: "saree" as const, colors: [{ name: "red", hex: "#c0282d" }] };

// The "face" is a horizontal skin-tone gradient: falling left to right for one person, rising for another.
// dHash compares neighbouring cells, so the two give opposite bits everywhere.
const shade = (s: number): [number, number, number] => [s, Math.round(s * 0.8), Math.round(s * 0.7)];
const falling = (x: number) => 250 - (x - 27) * 6;
const rising = (x: number) => 40 + (x - 27) * 6;

const person = (torso: [number, number, number], face: (x: number) => number = falling) =>
  makePixels(W, H, (x, y) => {
    if (y < 0.2 * H && x > 0.3 * W && x < 0.7 * W) return shade(face(x));
    if (y > 0.22 * H && y < 0.8 * H && x > 0.25 * W && x < 0.75 * W) return torso;
    return [150, 150, 150];
  });

describe("hash", () => {
  it("is identical for identical regions and low for a changed one", () => {
    const a = person([255, 255, 255]);
    expect(hashSimilarity(dHash(a, HEAD), dHash(a, HEAD))).toBe(1);
    const b = person([255, 255, 255], rising);
    expect(hashSimilarity(dHash(a, HEAD), dHash(b, HEAD))).toBeLessThan(0.75);
  });
});

describe("judge", () => {
  const input = person([245, 245, 245]);
  it("passes a result that keeps the face and shows the garment colour", () => {
    const v = judge(input, person(RED), piece);
    expect(v).toMatchObject({ pass: true, color: true, person: true, changed: true });
  });
  it("fails colour when the garment came out blue", () => {
    const v = judge(input, person([40, 70, 190]), piece);
    expect(v.color).toBe(false);
    expect(v.pass).toBe(false);
  });
  it("fails 'changed' when the model returned the input", () => {
    const v = judge(input, input, { ...piece, colors: [{ name: "white", hex: "#f5f5f0" }] });
    expect(v.changed).toBe(false);
  });
  it("fails 'person' when the face changed", () => {
    const v = judge(input, person(RED, rising), piece);
    expect(v.person).toBe(false);
  });
  it("decide applies thresholds to stored metrics and scores higher for better results", () => {
    const good = measure(input, person(RED), piece);
    const bad = measure(input, person([40, 70, 190]), piece);
    expect(decide(good).score).toBeGreaterThan(decide(bad).score);
    expect(decide(bad, { colorDeltaE: 200, headSimilarity: 0, minChange: 0 }).pass).toBe(true);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run tests/judge/judge.test.ts`
Expected: FAIL, cannot resolve `@/lib/judge/hash`.

- [ ] **Step 4: Create `lib/judge/hash.ts`**

```ts
// lib/judge/hash.ts — difference hash of a region: a cheap "is this still the same face" check.
import type { Pixels } from "./pixels";
import { grayGrid, type Box } from "./regions";

export function dHash(px: Pixels, box: Box): boolean[] {
  const g = grayGrid(px, box, 9, 8);
  const bits: boolean[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) bits.push(g[r * 9 + c] > g[r * 9 + c + 1]);
  return bits;
}

export function hashSimilarity(a: boolean[], b: boolean[]): number {
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same / a.length;
}
```

- [ ] **Step 5: Create `lib/judge/judge.ts`**

```ts
// lib/judge/judge.ts — does a try-on result show the right garment, on the same person, actually changed?
// `measure` computes raw metrics once; `decide` applies thresholds, so calibration can re-decide stored runs.
import type { Piece } from "@/lib/catalog/types";
import { deltaE, dominantLabs, hexToLab } from "./color";
import { dHash, hashSimilarity } from "./hash";
import type { Pixels } from "./pixels";
import { garmentBox, HEAD, labGrid } from "./regions";
import thresholds from "./thresholds.json";

export interface Thresholds { colorDeltaE: number; headSimilarity: number; minChange: number }
export const THRESHOLDS: Thresholds = thresholds;

export interface Metrics { colorDeltaE: number; headSimilarity: number; change: number }

export interface Verdict {
  pass: boolean;
  color: boolean;
  person: boolean;
  changed: boolean;
  score: number;
  metrics: Metrics;
}

export function measure(input: Pixels, result: Pixels, piece: Pick<Piece, "slot" | "colors">): Metrics {
  const box = garmentBox(piece.slot);
  const target = hexToLab(piece.colors[0]?.hex ?? "#808080");
  const dom = dominantLabs(result, box, 3).filter((c) => c.share >= 0.15);
  const colorDeltaE = dom.length ? Math.min(...dom.map((c) => deltaE(c.lab, target))) : 100;
  const headSimilarity = hashSimilarity(dHash(input, HEAD), dHash(result, HEAD));
  const a = labGrid(input, box, 16, 20), b = labGrid(result, box, 16, 20);
  const change = a.reduce((s, l, i) => s + deltaE(l, b[i]), 0) / a.length;
  return { colorDeltaE, headSimilarity, change };
}

export function decide(m: Metrics, t: Thresholds = THRESHOLDS): Verdict {
  const color = m.colorDeltaE <= t.colorDeltaE;
  const person = m.headSimilarity >= t.headSimilarity;
  const changed = m.change >= t.minChange;
  const score = (1 - Math.min(m.colorDeltaE / 60, 1)) + m.headSimilarity + Math.min(m.change / 30, 1);
  return { pass: color && person && changed, color, person, changed, score, metrics: m };
}

export function judge(input: Pixels, result: Pixels, piece: Pick<Piece, "slot" | "colors">, t?: Thresholds): Verdict {
  return decide(measure(input, result, piece), t);
}
```

- [ ] **Step 6: Run the test to see it pass**

Run: `npx vitest run tests/judge/judge.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/judge tests/judge
git commit -m "feat: try-on judge (colour kept, same person, outfit changed)"
```

---

## Task 18: Browser judge, fit logic and the new Board

**Files:**
- Create: `lib/judge/browser.ts`, `lib/tryon/fit.ts`, `lib/tryon/live.ts`
- Rewrite: `components/Board.tsx`
- Test: `tests/tryon/fit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/tryon/fit.test.ts
import { describe, expect, it, vi } from "vitest";
import { describePiece, fitOne, type FitDeps } from "@/lib/tryon/fit";
import type { Piece } from "@/lib/catalog/types";
import type { Provider, ProviderId, TryOnResult } from "@/lib/tryon/types";
import type { Verdict } from "@/lib/judge/judge";

const piece: Piece = {
  id: "p", slot: "saree", name: "Red Saree", brand: "Kay Kraft", url: "u", price: 1, image: "https://g",
  colors: [{ name: "red", hex: "#c0282d" }], fabric: "georgette", work: "none", formality: 4,
  occasions: ["eid"], imageKind: "flat",
};

const prov = (id: ProviderId, ...results: Omit<TryOnResult, "provider">[]): Provider => {
  const run = vi.fn();
  results.forEach((r) => run.mockResolvedValueOnce({ ...r, provider: id }));
  return { id, run };
};
const verdict = (pass: boolean, score: number, over: Partial<Verdict> = {}): Verdict => ({
  pass, color: pass, person: true, changed: true, score, metrics: { colorDeltaE: 0, headSimilarity: 1, change: 10 }, ...over,
});
const deps = (ootd: Provider, idm: Provider, judge: FitDeps["judge"]): FitDeps => ({
  providers: { ootd, idm, fal: undefined }, orderFor: () => ["ootd", "idm"], judge,
});

describe("describePiece", () => {
  it("reads like a garment description", () => {
    expect(describePiece(piece)).toBe("red georgette saree");
    expect(describePiece({ ...piece, fabric: "unknown", colors: [] })).toBe("saree");
  });
});

describe("fitOne", () => {
  it("returns the first result when it passes", async () => {
    const d = deps(prov("ootd", { ok: true, image: "A" }), prov("idm"), vi.fn().mockResolvedValue(verdict(true, 3)));
    await expect(fitOne("P", piece, d)).resolves.toEqual({ kind: "ok", image: "A", provider: "ootd" });
  });
  it("retries on the next model and keeps a passing retry", async () => {
    const judge = vi.fn().mockResolvedValueOnce(verdict(false, 1)).mockResolvedValueOnce(verdict(true, 3));
    const d = deps(prov("ootd", { ok: true, image: "A" }), prov("idm", { ok: true, image: "B" }), judge);
    await expect(fitOne("P", piece, d)).resolves.toEqual({ kind: "ok", image: "B", provider: "idm" });
  });
  it("keeps the better of two failures, with a note", async () => {
    const judge = vi.fn().mockResolvedValueOnce(verdict(false, 2)).mockResolvedValueOnce(verdict(false, 1));
    const d = deps(prov("ootd", { ok: true, image: "A" }), prov("idm", { ok: true, image: "B" }), judge);
    const out = await fitOne("P", piece, d);
    expect(out).toMatchObject({ kind: "ok", image: "A" });
    expect(out.kind === "ok" && out.note).toMatch(/colours/);
  });
  it("keeps the first result with a note when no retry is possible", async () => {
    const d = deps(prov("ootd", { ok: true, image: "A" }), prov("idm", { ok: false, reason: "quota", detail: "" }), vi.fn().mockResolvedValue(verdict(false, 1)));
    const out = await fitOne("P", piece, d);
    expect(out).toMatchObject({ kind: "ok", image: "A" });
    expect(out.kind === "ok" && out.note).toBeTruthy();
  });
  it("reports quota when every model is out of GPU", async () => {
    const d = deps(prov("ootd", { ok: false, reason: "quota", detail: "" }), prov("idm", { ok: false, reason: "quota", detail: "" }), vi.fn());
    await expect(fitOne("P", piece, d)).resolves.toEqual({ kind: "quota" });
  });
  it("reports an error otherwise", async () => {
    const d = deps(prov("ootd", { ok: false, reason: "error", detail: "x" }), prov("idm", { ok: false, reason: "error", detail: "y" }), vi.fn());
    await expect(fitOne("P", piece, d)).resolves.toMatchObject({ kind: "error" });
  });
  it("treats a judge crash as a pass", async () => {
    const d = deps(prov("ootd", { ok: true, image: "A" }), prov("idm"), vi.fn().mockRejectedValue(new Error("decode")));
    await expect(fitOne("P", piece, d)).resolves.toEqual({ kind: "ok", image: "A", provider: "ootd" });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/tryon/fit.test.ts`
Expected: FAIL, cannot resolve `@/lib/tryon/fit`.

- [ ] **Step 3: Create `lib/tryon/fit.ts`**

```ts
// lib/tryon/fit.ts — dress one person in one piece: try, judge, retry once on another model,
// and if both miss, show the better one with a plain note instead of a silent bad image.
import { SLOT_NOUN, type Slot } from "@/lib/catalog/slots";
import type { Piece } from "@/lib/catalog/types";
import type { Verdict } from "@/lib/judge/judge";
import { outOfCapacity, runChain } from "./chain";
import type { ProviderId, Providers } from "./types";

export interface FitDeps {
  providers: Providers;
  orderFor: (slot: Slot) => ProviderId[];
  judge: (person: string, result: string, piece: Piece) => Promise<Verdict>;
}

export type FitOutcome =
  | { kind: "ok"; image: string; provider: ProviderId; note?: string }
  | { kind: "quota" }
  | { kind: "error"; message: string };

export function describePiece(p: Piece): string {
  return [p.colors[0]?.name, p.fabric !== "unknown" ? p.fabric : "", SLOT_NOUN[p.slot]].filter(Boolean).join(" ");
}

export function noteFor(v: Verdict): string {
  if (!v.color) return "The colours came out different from the real piece in this one.";
  if (!v.person) return "The face may look a little altered in this one.";
  if (!v.changed) return "The model barely changed the outfit; this piece may not suit try-on.";
  return "This one may not be fully accurate.";
}

async function safeJudge(deps: FitDeps, person: string, image: string, piece: Piece): Promise<Verdict | null> {
  try { return await deps.judge(person, image, piece); } catch { return null; }
}

export async function fitOne(person: string, piece: Piece, deps: FitDeps): Promise<FitOutcome> {
  const input = { person, garment: piece.image, slot: piece.slot, description: describePiece(piece) };
  const order = deps.orderFor(piece.slot);

  const first = await runChain(input, deps.providers, order);
  if (!first.result.ok) {
    return outOfCapacity(first.tried) ? { kind: "quota" } : { kind: "error", message: "Try-on failed. Please try again." };
  }
  const r1 = first.result;
  const v1 = await safeJudge(deps, person, r1.image, piece);
  if (!v1 || v1.pass) return { kind: "ok", image: r1.image, provider: r1.provider };

  const second = await runChain(input, deps.providers, order, first.tried.map((t) => t.provider));
  if (!second.result.ok) return { kind: "ok", image: r1.image, provider: r1.provider, note: noteFor(v1) };
  const r2 = second.result;
  const v2 = await safeJudge(deps, person, r2.image, piece);
  if (!v2 || v2.pass) return { kind: "ok", image: r2.image, provider: r2.provider };

  return v2.score > v1.score
    ? { kind: "ok", image: r2.image, provider: r2.provider, note: noteFor(v2) }
    : { kind: "ok", image: r1.image, provider: r1.provider, note: noteFor(v1) };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run tests/tryon/fit.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Create `lib/judge/browser.ts`**

```ts
// lib/judge/browser.ts — decode an image URL into Pixels with a canvas (browser only).
import type { Pixels } from "./pixels";

export async function loadPixels(src: string, max = 384): Promise<Pixels> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
}
```

- [ ] **Step 6: Create `lib/tryon/live.ts`**

```ts
// lib/tryon/live.ts — browser wiring: free Spaces called directly (visitor's own quota), fal only if configured.
import { judge } from "@/lib/judge/judge";
import { loadPixels } from "@/lib/judge/browser";
import { providerOrder } from "./chain";
import { falProvider } from "./falClient";
import type { FitDeps } from "./fit";
import { idmProvider, ootdProvider, type HfDeps } from "./hf";

let falAvailable: Promise<boolean> | null = null;
const hasFal = () =>
  (falAvailable ??= fetch("/api/tryon").then((r) => r.json()).then((d) => Boolean(d.fal)).catch(() => false));

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(b);
  });

const hf: HfDeps = {
  async loadImage(src) {
    const res = await fetch(src.startsWith("data:") ? src : `/api/img?u=${encodeURIComponent(src)}`);
    if (!res.ok) throw new Error(`image ${res.status}`);
    return res.blob();
  },
  async fetchResult(url) {
    const res = await fetch(`/api/result?u=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`result ${res.status}`);
    return blobToDataUrl(await res.blob());
  },
};

export async function liveDeps(): Promise<FitDeps> {
  const fal = await hasFal();
  return {
    providers: { ootd: ootdProvider(hf), idm: idmProvider(hf), fal: fal ? falProvider() : undefined },
    orderFor: (slot) => providerOrder(slot, fal),
    judge: async (person, result, piece) => judge(await loadPixels(person), await loadPixels(result), piece),
  };
}
```

- [ ] **Step 7: Rewrite `components/Board.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCatalog, SLOT_TINT, imgUrl, TRYON_ORDER, EXTRAS, type Piece } from "@/lib/catalog";
import { usePhoto } from "@/lib/photostore";

type TState = "idle" | "loading" | "done" | "error" | "quota";
interface GalleryItem { piece: string; slot: string; provider: string; image: string }

const toData = (b: Blob) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(b); });
const resize = (u: string, max = 1024) => new Promise<string>((r) => { const i = new Image(); i.onload = () => { const s = Math.min(1, max / Math.max(i.width, i.height)); const c = document.createElement("canvas"); c.width = i.width * s; c.height = i.height * s; c.getContext("2d")!.drawImage(i, 0, 0, c.width, c.height); r(c.toDataURL("image/jpeg", 0.9)); }; i.src = u; });

function Tile({ id, big }: { id: string; big?: boolean }) {
  const p = useCatalog((s) => s.byId[id]);
  if (!p) return null;
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative overflow-hidden rounded-2xl bg-white shadow-md" style={{ background: SLOT_TINT[p.slot] }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgUrl(p.image)} alt={p.name} loading="lazy" className={`w-full ${big ? "h-52" : "h-28"} object-contain p-1`} />
      <span className="block truncate px-2 text-[10px] tracking-wide text-neutral-600">{p.name}</span>
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="block truncate px-2 pb-1.5 text-[10px] text-neutral-500 underline">
        {p.price ? `৳${p.price.toLocaleString("en-IN")} · ` : ""}View at {p.brand} ↗
      </a>
    </motion.div>
  );
}

function QuotaGallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  useEffect(() => { fetch("/bench/gallery.json").then((r) => r.json()).then((d: GalleryItem[]) => setItems(d.slice(0, 6))).catch(() => setItems([])); }, []);
  return (
    <div className="space-y-2">
      <p className="text-sm text-neutral-600">Today&apos;s free try-on capacity is used up. It resets within a day.</p>
      {items.length > 0 && (<>
        <p className="text-xs text-neutral-500">Meanwhile, here is how the same models dress our benchmark models:</p>
        <div className="grid grid-cols-3 gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {items.map((g) => <img key={g.image} src={g.image} alt={`${g.slot} on a benchmark model`} className="aspect-[3/4] w-full rounded-lg object-cover" />)}
        </div>
        <a href="/bench" className="block text-center text-xs underline">See the full benchmark</a>
      </>)}
    </div>
  );
}

export function Board() {
  const { equipped, clear, saveLook } = usePhoto();
  const byId = useCatalog((s) => s.byId);
  const main = TRYON_ORDER.map((s) => equipped[s]).filter(Boolean) as string[];
  const extra = EXTRAS.map((s) => equipped[s]).filter(Boolean) as string[];
  const any = main.length + extra.length > 0;

  const [tstate, setT] = useState<TState>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [tmsg, setTmsg] = useState("");
  const [step, setStep] = useState("");

  async function tryOn(person: string) {
    // Dress the pieces one at a time in TRYON_ORDER, feeding each result into the next.
    const pieces = main.map((id) => byId[id]).filter((p): p is Piece => Boolean(p));
    if (pieces.length === 0) return;
    setResult(null); setNotes([]); setT("loading");
    try {
      const [{ liveDeps }, { fitOne }] = await Promise.all([import("@/lib/tryon/live"), import("@/lib/tryon/fit")]);
      const deps = await liveDeps();
      let current = person;
      const found: string[] = [];
      for (let i = 0; i < pieces.length; i++) {
        setStep(`Fitting ${pieces[i].name} (${i + 1}/${pieces.length})… about a minute`);
        const out = await fitOne(current, pieces[i], deps);
        if (out.kind === "quota") { setT("quota"); return; }
        if (out.kind === "error") { setTmsg(out.message); setT("error"); return; }
        if (out.note) found.push(out.note);
        current = out.image;
      }
      setResult(current); setNotes(found); setT("done");
    } catch {
      setTmsg("Something went wrong. Please try again."); setT("error");
    }
  }

  async function onFile(f: File) { tryOn(await resize(await toData(f))); }
  async function onSample() { const r = await fetch("/samples/model.jpg"); tryOn(await resize(await toData(await r.blob()))); }

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 pb-28 pt-24 md:pr-[22rem]">
      <div className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-3">
        {any ? (
          <div className="w-full rounded-3xl p-4 shadow-2xl backdrop-blur-xl" style={{ background: "var(--panel)" }}>
            <div className="grid grid-cols-2 gap-2"><AnimatePresence>{main.map((id) => (<Tile key={id} id={id} big />))}</AnimatePresence></div>
            {extra.length > 0 && (<div className="mt-2 grid grid-cols-3 gap-2"><AnimatePresence>{extra.map((id) => (<Tile key={id} id={id} />))}</AnimatePresence></div>)}
            {main.length > 0 && (<>
              <label className="mt-3 block cursor-pointer rounded-full py-2.5 text-center text-xs uppercase tracking-widest text-white" style={{ background: "var(--accent)" }}>
                ◈ Try on me
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              </label>
              <button onClick={onSample} className="mt-1.5 w-full text-center text-[11px] underline opacity-70" style={{ color: "var(--text)" }}>or try it on a sample model</button>
              <p className="mt-1.5 text-center text-[10px] opacity-50" style={{ color: "var(--text)" }}>
                Your photo goes straight from your browser to open try-on models on Hugging Face. Eos never stores it.
              </p>
            </>)}
            <div className="mt-2 flex gap-2">
              <button onClick={saveLook} className="flex-1 rounded-full py-2 text-xs uppercase tracking-widest" style={{ color: "var(--text)", border: "1px solid rgba(128,128,128,0.4)" }}>Save look</button>
              <button onClick={clear} className="rounded-full px-4 py-2 text-xs uppercase tracking-widest" style={{ color: "var(--text)", border: "1px solid rgba(128,128,128,0.4)" }}>Clear</button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl px-10 py-16 text-center shadow-xl backdrop-blur-xl" style={{ background: "var(--panel)", color: "var(--text)" }}>
            <p className="font-serif text-xl">Style a look</p>
            <p className="mt-1 text-xs opacity-60">Pick real pieces from Bangladeshi brands →</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {tstate !== "idle" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => tstate !== "loading" && setT("idle")} className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md">
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-4 text-neutral-800 shadow-2xl">
              <div className="mb-2 flex items-center justify-between"><h3 className="font-serif text-lg">Try on me</h3><button onClick={() => setT("idle")} aria-label="Close" className="text-neutral-400">×</button></div>
              {tstate === "loading" && <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-neutral-100 px-4 text-center"><span className="animate-pulse text-xs tracking-widest text-neutral-400">{step || "FITTING…"}</span></div>}
              {tstate === "done" && result && (<>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result} alt="You in the look" className="w-full rounded-xl" />
                {notes.map((n) => <p key={n} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{n}</p>)}
                <a href={result} download="eos-me.png" className="mt-3 block rounded-full bg-neutral-900 py-2 text-center text-xs uppercase tracking-widest text-white">Download</a>
              </>)}
              {tstate === "error" && <div className="rounded-xl bg-neutral-100 p-6 text-center text-sm text-neutral-500">{tmsg}</div>}
              {tstate === "quota" && <QuotaGallery />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 8: Add an empty gallery so the fallback has a file to read**

```bash
mkdir -p public/bench && echo "[]" > public/bench/gallery.json
```

- [ ] **Step 9: Run tests, typecheck, lint**

Run: `npm test; npm run typecheck; npm run lint`
Expected: all PASS and clean.

- [ ] **Step 10: Verify in the browser**

Start the dev server (preview entry `eos`, `npm run dev`, port 3000). Pick a kurti, then click "or try it on a sample model".
Expected: the step text shows, and after 30 to 120 seconds a photo of the sample model wearing the kurti appears. Check `read_network_requests`: calls go to `*.hf.space` directly and to `/api/result`, and none to `/api/tryon` POST. Check `read_console_messages` for errors. If the Space answers with a CORS error, record it: the fallback is to route the Space call through a server route, which puts the site back on one shared quota, so stop and raise it with Fahim before changing course.

- [ ] **Step 11: Commit**

```bash
git add lib/judge/browser.ts lib/tryon/fit.ts lib/tryon/live.ts components/Board.tsx public/bench/gallery.json tests/tryon/fit.test.ts
git commit -m "feat: judged try-on from the browser with retry, notes, sample model and quota fallback"
```

---

## Task 19: Stylist logic

**Files:**
- Create: `lib/stylist/rules.ts`, `lib/stylist/validate.ts`, `lib/stylist/prompt.ts`, `lib/stylist/suggest.ts`
- Test: `tests/stylist/stylist.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/stylist/stylist.test.ts
import { describe, expect, it, vi } from "vitest";
import { candidates, ruleSuggestions } from "@/lib/stylist/rules";
import { validateSuggestions } from "@/lib/stylist/validate";
import { suggest } from "@/lib/stylist/suggest";
import { QuotaError } from "@/lib/ai/gemini";
import type { Piece } from "@/lib/catalog/types";

const mk = (id: string, over: Partial<Piece> = {}): Piece => ({
  id, slot: "saree", name: id, brand: "B", url: "u", price: 3000, image: "i",
  colors: [{ name: "red", hex: "#c0282d" }], fabric: "silk", work: "embroidery", formality: 5,
  occasions: ["wedding"], imageKind: "flat", ...over,
});

const pieces = [
  mk("wed-saree"),
  mk("eid-kurti", { slot: "kurti", formality: 4, occasions: ["eid"], price: 1800 }),
  mk("eid-set3", { slot: "set3", formality: 4, occasions: ["eid"], price: 5200 }),
  mk("home-top", { slot: "top", formality: 1, occasions: ["casual"], price: 600 }),
  mk("gold-orna", { slot: "orna", occasions: ["eid", "wedding"], colors: [{ name: "gold", hex: "#c9a646" }] }),
];

describe("candidates", () => {
  // Only two pieces suit Eid, so the list widens to all wearables, occasion matches first.
  it("ranks wearables that suit the occasion first", () => {
    expect(candidates(pieces, { occasion: "eid" }, null).map((p) => p.id)).toEqual(["eid-kurti", "eid-set3", "wed-saree", "home-top"]);
  });
  it("applies the budget", () => {
    expect(candidates(pieces, { occasion: "eid", budget: 2000 }, null).map((p) => p.id)).toEqual(["eid-kurti", "home-top"]);
  });
  it("offers extras when completing a look", () => {
    expect(candidates(pieces, { occasion: "eid" }, pieces[1]).map((p) => p.id)).toEqual(["gold-orna"]);
  });
});

describe("ruleSuggestions", () => {
  it("returns three of different types with templated reasons", () => {
    const s = ruleSuggestions(candidates(pieces, { occasion: "eid" }, null), { occasion: "eid" });
    expect(s.map((x) => x.id)).toEqual(["eid-kurti", "eid-set3", "wed-saree"]);
    expect(s[0].reason).toBe("Eid-ready silk kurti with embroidery, ৳1,800.");
  });
});

describe("validateSuggestions", () => {
  const cands = pieces.slice(1, 3);
  it("keeps only known, unique ids with reasons", () => {
    const v = validateSuggestions({ suggestions: [
      { id: "eid-kurti", reason: "Light for Eid day." },
      { id: "eid-kurti", reason: "dup" },
      { id: "made-up", reason: "x" },
      { id: "eid-set3", reason: "" },
    ] }, cands);
    expect(v).toEqual([{ id: "eid-kurti", reason: "Light for Eid day." }]);
  });
  it("returns null when nothing is valid", () => {
    expect(validateSuggestions({ nope: 1 }, cands)).toBeNull();
    expect(validateSuggestions({ suggestions: [{ id: "x", reason: "y" }] }, cands)).toBeNull();
  });
});

describe("suggest", () => {
  it("uses the model when its answer is valid", async () => {
    const gen = vi.fn().mockResolvedValue({ suggestions: [{ id: "eid-set3", reason: "Festive but not heavy." }] });
    await expect(suggest(pieces, { occasion: "eid" }, gen)).resolves.toEqual({
      source: "ai", suggestions: [{ id: "eid-set3", reason: "Festive but not heavy." }],
    });
  });
  it("falls back to rules on quota or invalid answers", async () => {
    const quota = vi.fn().mockRejectedValue(new QuotaError("q"));
    expect((await suggest(pieces, { occasion: "eid" }, quota)).source).toBe("rules");
    const junk = vi.fn().mockResolvedValue({ suggestions: [{ id: "ghost", reason: "x" }] });
    expect((await suggest(pieces, { occasion: "eid" }, junk)).source).toBe("rules");
  });
  it("completes a look from the anchor piece", async () => {
    const gen = vi.fn().mockRejectedValue(new Error("off"));
    const r = await suggest(pieces, { occasion: "eid", anchorId: "eid-kurti" }, gen);
    expect(r.suggestions.map((s) => s.id)).toEqual(["gold-orna"]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/stylist/stylist.test.ts`
Expected: FAIL, cannot resolve `@/lib/stylist/rules`.

- [ ] **Step 3: Create `lib/stylist/rules.ts`**

```ts
// lib/stylist/rules.ts — narrow the catalog to ~30 candidates, and a rules-only answer for when AI is unavailable.
import { EXTRAS, isWearable, SLOT_NOUN } from "@/lib/catalog/slots";
import { OCCASION_LABEL, type Occasion, type Piece } from "@/lib/catalog/types";

export interface StyleRequest { occasion: Occasion; budget?: number | null; anchorId?: string | null }
export interface Suggestion { id: string; reason: string }

export const FORMALITY_TARGET: Record<Occasion, number> = {
  eid: 4, wedding: 5, gaye_holud: 4, puja: 4, office: 2, university: 2, casual: 1, party: 4,
};

export function ruleScore(p: Piece, req: StyleRequest, anchor: Piece | null): number {
  const occasion = p.occasions.includes(req.occasion) ? 2 : 0;
  const formality = 1 - Math.abs(p.formality - FORMALITY_TARGET[req.occasion]) / 4;
  const shared = anchor && p.colors.some((c) => anchor.colors.some((a) => a.name === c.name)) ? 0.5 : 0;
  return occasion + formality + shared;
}

export function candidates(pieces: Piece[], req: StyleRequest, anchor: Piece | null, limit = 30): Piece[] {
  const pool = pieces.filter((p) => (anchor ? EXTRAS.includes(p.slot) : isWearable(p.slot)));
  const affordable = pool.filter((p) => req.budget == null || (p.price != null && p.price <= req.budget));
  const matching = affordable.filter((p) => p.occasions.includes(req.occasion));
  const base = matching.length >= 3 || anchor ? matching : affordable;
  return base
    .map((p) => ({ p, s: ruleScore(p, req, anchor) }))
    .sort((a, b) => b.s - a.s || a.p.id.localeCompare(b.p.id))
    .slice(0, limit)
    .map((x) => x.p);
}

export function ruleSuggestions(cands: Piece[], req: StyleRequest, n = 3): Suggestion[] {
  const picked: Piece[] = [];
  for (const p of cands) if (picked.length < n && !picked.some((q) => q.slot === p.slot)) picked.push(p);
  for (const p of cands) if (picked.length < n && !picked.includes(p)) picked.push(p);
  return picked.map((p) => ({
    id: p.id,
    reason: `${OCCASION_LABEL[req.occasion]}-ready ${p.fabric !== "unknown" ? `${p.fabric} ` : ""}${SLOT_NOUN[p.slot]}${p.work !== "none" ? ` with ${p.work}` : ""}${p.price ? `, ৳${p.price.toLocaleString("en-IN")}` : ""}.`,
  }));
}
```

- [ ] **Step 4: Create `lib/stylist/validate.ts`**

```ts
// lib/stylist/validate.ts — never show a suggestion the model invented.
import type { Piece } from "@/lib/catalog/types";
import type { Suggestion } from "./rules";

export function validateSuggestions(raw: unknown, cands: Piece[], n = 3): Suggestion[] | null {
  const list = (raw as { suggestions?: unknown } | null)?.suggestions;
  if (!Array.isArray(list)) return null;
  const known = new Set(cands.map((p) => p.id));
  const out: Suggestion[] = [];
  for (const item of list) {
    const id = (item as { id?: unknown })?.id, reason = (item as { reason?: unknown })?.reason;
    if (typeof id !== "string" || typeof reason !== "string" || !reason.trim()) continue;
    if (!known.has(id) || out.some((s) => s.id === id)) continue;
    out.push({ id, reason: reason.trim().slice(0, 200) });
    if (out.length === n) break;
  }
  return out.length ? out : null;
}
```

- [ ] **Step 5: Create `lib/stylist/prompt.ts`**

```ts
// lib/stylist/prompt.ts — a compact candidate list and the instruction for the model.
import { SLOT_NOUN } from "@/lib/catalog/slots";
import { OCCASION_LABEL, type Piece } from "@/lib/catalog/types";
import type { StyleRequest } from "./rules";

export const SUGGEST_SCHEMA = {
  type: "OBJECT",
  properties: {
    suggestions: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { id: { type: "STRING" }, reason: { type: "STRING" } }, required: ["id", "reason"] },
    },
  },
  required: ["suggestions"],
};

const line = (p: Piece) =>
  `${p.id} | ${SLOT_NOUN[p.slot]} | ${p.name} | ${p.colors.map((c) => c.name).join("/")} | ${p.fabric} | ${p.work} | formality ${p.formality} | ${p.price ? `৳${p.price}` : "price n/a"}`;

export function stylistPrompt(cands: Piece[], req: StyleRequest, anchor: Piece | null): string {
  const task = anchor
    ? `She is wearing: ${line(anchor)}. Suggest up to 3 ornas or accessories from the list that complete this look for ${OCCASION_LABEL[req.occasion]}.`
    : `Suggest up to 3 pieces from the list for ${OCCASION_LABEL[req.occasion]}${req.budget ? `, each under ৳${req.budget}` : ""}. Prefer variety of type.`;
  return [
    "You are a stylist who knows Bangladeshi women's fashion and occasions well.",
    task,
    "Use only ids from the list. For each, give one short sentence (under 20 words) on why it suits the occasion. No prices in the reason.",
    "Candidates (id | type | name | colours | fabric | work | formality 1-5 | price):",
    ...cands.map(line),
  ].join("\n");
}
```

- [ ] **Step 6: Create `lib/stylist/suggest.ts`**

```ts
// lib/stylist/suggest.ts — one model call over the narrowed list; rules when the model is unavailable or wrong.
import type { Piece } from "@/lib/catalog/types";
import { stylistPrompt } from "./prompt";
import { candidates, ruleSuggestions, type StyleRequest, type Suggestion } from "./rules";
import { validateSuggestions } from "./validate";

export interface SuggestResult { suggestions: Suggestion[]; source: "ai" | "rules" }

export async function suggest(
  pieces: Piece[],
  req: StyleRequest,
  generate: (prompt: string) => Promise<unknown>,
): Promise<SuggestResult> {
  const anchor = req.anchorId ? pieces.find((p) => p.id === req.anchorId) ?? null : null;
  const cands = candidates(pieces, req, anchor);
  if (cands.length === 0) return { suggestions: [], source: "rules" };
  try {
    const valid = validateSuggestions(await generate(stylistPrompt(cands, req, anchor)), cands);
    if (valid) return { suggestions: valid, source: "ai" };
  } catch {
    // quota, network or parse error: fall through to rules
  }
  return { suggestions: ruleSuggestions(cands, req), source: "rules" };
}
```

- [ ] **Step 7: Run the test to see it pass**

Run: `npx vitest run tests/stylist/stylist.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 8: Commit**

```bash
git add lib/stylist tests/stylist
git commit -m "feat: occasion stylist logic with validated AI answers and rules fallback"
```

---

## Task 20: Stylist route and panel

**Files:**
- Create: `app/api/stylist/route.ts`, `components/Stylist.tsx`
- Modify: `components/AppShell.tsx`

- [ ] **Step 1: Create `app/api/stylist/route.ts`**

```ts
// POST /api/stylist { occasion, budget?, anchorId? } → { suggestions, source }
import { NextRequest, NextResponse } from "next/server";
import catalog from "@/public/catalog.json";
import { generateJSON } from "@/lib/ai/gemini";
import { createLimiter } from "@/lib/ratelimit";
import { OCCASIONS, type Occasion, type Piece } from "@/lib/catalog/types";
import { SUGGEST_SCHEMA } from "@/lib/stylist/prompt";
import { suggest } from "@/lib/stylist/suggest";

export const runtime = "nodejs";

const pieces = catalog as unknown as Piece[];
const limiter = createLimiter(20, 60 * 60 * 1000);

export async function POST(req: NextRequest) {
  let body: { occasion?: string; budget?: number | null; anchorId?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (!OCCASIONS.includes(body.occasion as Occasion)) return NextResponse.json({ error: "bad_occasion" }, { status: 400 });
  const budget = typeof body.budget === "number" && body.budget > 0 ? body.budget : null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const useAi = limiter(ip);
  const result = await suggest(
    pieces,
    { occasion: body.occasion as Occasion, budget, anchorId: body.anchorId ?? null },
    (prompt) => (useAi ? generateJSON({ parts: [{ text: prompt }], schema: SUGGEST_SCHEMA }) : Promise.reject(new Error("rate limited"))),
  );
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Create `components/Stylist.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useCatalog, imgUrl, TRYON_ORDER, OCCASIONS, OCCASION_LABEL, type Occasion } from "@/lib/catalog";
import { usePhoto } from "@/lib/photostore";

interface Result { suggestions: { id: string; reason: string }[]; source: "ai" | "rules" }

export function Stylist() {
  const [open, setOpen] = useState(false);
  const [occasion, setOccasion] = useState<Occasion>("eid");
  const [budget, setBudget] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [res, setRes] = useState<Result | null>(null);
  const byId = useCatalog((s) => s.byId);
  const { equipped, pick } = usePhoto();
  const outfitId = TRYON_ORDER.map((s) => equipped[s]).find(Boolean);
  const panel = { background: "var(--panel)", color: "var(--text)" } as const;

  async function ask(anchorId?: string) {
    setState("loading");
    try {
      const r = await fetch("/api/stylist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion, budget: budget ? Number(budget) : null, anchorId: anchorId ?? null }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setRes(await r.json());
      setState("done");
    } catch {
      setState("error");
    }
  }

  const wear = (id: string) => { const p = byId[id]; if (p && equipped[p.slot] !== id) pick(id); };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="pointer-events-auto absolute bottom-20 left-3 rounded-full px-4 py-2 text-xs uppercase tracking-widest shadow-lg backdrop-blur-xl md:left-6" style={panel}>
        ✦ Style me
      </button>
    );
  }

  return (
    <aside className="pointer-events-auto absolute bottom-20 left-3 w-72 rounded-2xl p-3 shadow-xl backdrop-blur-xl md:left-6" style={panel}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-serif text-lg">Style me</h2>
        <button onClick={() => setOpen(false)} aria-label="Close" className="opacity-50">×</button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1 text-[11px]">
        {OCCASIONS.map((o) => (
          <button key={o} onClick={() => setOccasion(o)} className="rounded-full px-2.5 py-1" style={{ background: occasion === o ? "var(--accent)" : "transparent", color: occasion === o ? "#fff" : "var(--text)", border: "1px solid rgba(128,128,128,0.3)" }}>
            {OCCASION_LABEL[o]}
          </button>
        ))}
      </div>
      <div className="mb-2 flex gap-2">
        <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} placeholder="Budget ৳ (optional)" className="min-w-0 flex-1 rounded-full px-3 py-1.5 text-xs outline-none" style={{ background: "rgba(128,128,128,0.12)", color: "var(--text)" }} />
        <button onClick={() => ask()} disabled={state === "loading"} className="rounded-full px-3 py-1.5 text-xs text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>Suggest</button>
      </div>
      {outfitId && (
        <button onClick={() => ask(outfitId)} disabled={state === "loading"} className="mb-2 w-full rounded-full py-1.5 text-[11px] underline opacity-80">Complete my look with an orna or accessory</button>
      )}
      {state === "loading" && <p className="py-4 text-center text-xs opacity-60">Thinking…</p>}
      {state === "error" && <p className="py-4 text-center text-xs opacity-60">Couldn&apos;t get suggestions. Please try again.</p>}
      {state === "done" && res && (
        <div className="max-h-[40vh] space-y-2 overflow-y-auto">
          {res.suggestions.length === 0 && <p className="py-2 text-center text-xs opacity-60">Nothing matches. Try another occasion or budget.</p>}
          {res.suggestions.map((s) => {
            const p = byId[s.id];
            if (!p) return null;
            return (
              <div key={s.id} className="flex gap-2 rounded-xl p-1.5" style={{ background: "rgba(128,128,128,0.08)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl(p.image)} alt={p.name} className="h-16 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">{p.name}</p>
                  <p className="text-[10px] opacity-70">{s.reason}</p>
                  <button onClick={() => wear(p.id)} className="mt-0.5 text-[10px] underline">Wear it</button>
                </div>
              </div>
            );
          })}
          <p className="text-[9px] opacity-50">{res.source === "ai" ? "Suggested by AI from the live catalog." : "Suggested by simple rules (the AI is resting)."}</p>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Mount it in `components/AppShell.tsx`**

Add the import:

```tsx
import { Stylist } from "./Stylist";
```

Change:

```tsx
      {viewMode === "photo" && (<><Board /><Catalog /></>)}
```

to:

```tsx
      {viewMode === "photo" && (<><Board /><Catalog /><Stylist /></>)}
```

- [ ] **Step 4: Typecheck, lint, test**

Run: `npm run typecheck; npm run lint; npm test`
Expected: clean, all PASS.

- [ ] **Step 5: Verify in the browser**

With the dev server running and `GEMINI_API_KEY` in `.env.local`: open "Style me", pick Eid, press Suggest.
Expected: three cards with reasons and "Suggested by AI". Press "Wear it" on one: it appears on the Board. Then remove the key from `.env.local`, restart, and ask again. Expected: suggestions still appear, marked "simple rules".

- [ ] **Step 6: Commit**

```bash
git add app/api/stylist/route.ts components/Stylist.tsx components/AppShell.tsx
git commit -m "feat: occasion stylist panel and route"
```

---

## Task 21: Benchmark selection and aggregation

**Files:**
- Create: `lib/bench/select.ts`, `lib/bench/aggregate.ts`, `lib/bench/agreement.ts`
- Test: `tests/bench/bench.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/bench/bench.test.ts
import { describe, expect, it } from "vitest";
import { selectBenchPieces, planRuns } from "@/lib/bench/select";
import { aggregate, type BenchRow } from "@/lib/bench/aggregate";
import { agreement, searchThresholds } from "@/lib/bench/agreement";
import type { Piece } from "@/lib/catalog/types";
import type { Slot } from "@/lib/catalog/slots";

const mk = (id: string, slot: Slot): Piece => ({
  id, slot, name: id, brand: "B", url: "u", price: 1, image: "i", colors: [{ name: "red", hex: "#c0282d" }],
  fabric: "cotton", work: "none", formality: 3, occasions: [], imageKind: "flat",
});

describe("selectBenchPieces", () => {
  const pieces = ["saree", "set3", "set2", "kurti", "top", "bottom", "orna"].flatMap((s) =>
    [1, 2, 3].map((i) => mk(`${s}-${i}`, s as Slot)));
  it("takes two per wearable slot, deterministically, no extras", () => {
    const a = selectBenchPieces(pieces, 2);
    expect(a).toHaveLength(12);
    expect(a.some((p) => p.slot === "orna")).toBe(false);
    expect(selectBenchPieces([...pieces].reverse(), 2).map((p) => p.id).sort()).toEqual(a.map((p) => p.id).sort());
  });
  it("plans person × piece × provider, bottoms on one model", () => {
    const sel = selectBenchPieces(pieces, 2);
    const runs = planRuns(["p01", "p02"], sel);
    expect(runs).toHaveLength(2 * (10 * 2 + 2 * 1));
    expect(runs[0]).toEqual({ key: expect.stringContaining("p01|"), person: "p01", piece: expect.any(String), provider: expect.any(String) });
  });
});

const row = (provider: "ootd" | "idm", slot: Slot, ok: boolean, colorDeltaE = 5): BenchRow => ({
  key: Math.random().toString(), person: "p", piece: "x", slot, provider, ok, seconds: 1,
  ...(ok ? { metrics: { colorDeltaE, headSimilarity: 0.9, change: 20 }, image: "/i.jpg" } : { reason: "error", detail: "d" }),
});

describe("aggregate", () => {
  it("counts generation and pass rates per provider and slot", () => {
    const t = aggregate([row("ootd", "saree", true), row("ootd", "saree", true, 50), row("ootd", "saree", false), row("idm", "top", true)]);
    const s = t.find((x) => x.provider === "ootd" && x.slot === "saree")!;
    expect(s).toMatchObject({ attempts: 3, generated: 2, passed: 1 });
    expect(s.passRate).toBeCloseTo(0.5);
    expect(s.generationRate).toBeCloseTo(2 / 3);
  });
});

describe("agreement", () => {
  const labelled = [
    { metrics: { colorDeltaE: 5, headSimilarity: 0.9, change: 20 }, good: true },
    { metrics: { colorDeltaE: 35, headSimilarity: 0.9, change: 20 }, good: false },
    { metrics: { colorDeltaE: 25, headSimilarity: 0.9, change: 20 }, good: true },
  ];
  it("measures how often the judge matches people", () => {
    expect(agreement(labelled, { colorDeltaE: 20, headSimilarity: 0.75, minChange: 8 })).toBeCloseTo(2 / 3);
  });
  it("finds thresholds that agree better", () => {
    const t = searchThresholds(labelled);
    expect(agreement(labelled, t)).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/bench/bench.test.ts`
Expected: FAIL, cannot resolve `@/lib/bench/select`.

- [ ] **Step 3: Create `lib/bench/select.ts`**

```ts
// lib/bench/select.ts — which pieces and runs make up the benchmark (fixed once chosen).
import { createHash } from "node:crypto";
import { TRYON_ORDER } from "@/lib/catalog/slots";
import type { Piece } from "@/lib/catalog/types";
import { providerOrder } from "@/lib/tryon/chain";
import type { ProviderId } from "@/lib/tryon/types";

const h = (s: string) => createHash("sha1").update(s).digest("hex");

export function selectBenchPieces(pieces: Piece[], perSlot = 2): Piece[] {
  return TRYON_ORDER.flatMap((slot) =>
    pieces.filter((p) => p.slot === slot).sort((a, b) => h(a.id).localeCompare(h(b.id))).slice(0, perSlot));
}

export interface PlannedRun { key: string; person: string; piece: string; provider: ProviderId }

export function planRuns(people: string[], pieces: Piece[]): PlannedRun[] {
  return people.flatMap((person) => pieces.flatMap((p) =>
    providerOrder(p.slot, false).map((provider) => ({ key: `${person}|${p.id}|${provider}`, person, piece: p.id, provider }))));
}
```

- [ ] **Step 4: Create `lib/bench/aggregate.ts`**

```ts
// lib/bench/aggregate.ts — pass rates per model and garment type, re-decided with current thresholds.
import type { Slot } from "@/lib/catalog/slots";
import { decide, THRESHOLDS, type Metrics, type Thresholds } from "@/lib/judge/judge";
import type { ProviderId } from "@/lib/tryon/types";

export interface BenchRow {
  key: string;
  person: string;
  piece: string;
  slot: Slot;
  provider: ProviderId;
  ok: boolean;
  seconds: number;
  metrics?: Metrics;
  image?: string;
  reason?: string;
  detail?: string;
}

export interface Cell {
  provider: ProviderId;
  slot: Slot;
  attempts: number;
  generated: number;
  passed: number;
  generationRate: number;
  passRate: number;
}

export function aggregate(rows: BenchRow[], t: Thresholds = THRESHOLDS): Cell[] {
  const cells = new Map<string, Cell>();
  for (const r of rows) {
    const k = `${r.provider}|${r.slot}`;
    const c = cells.get(k) ?? { provider: r.provider, slot: r.slot, attempts: 0, generated: 0, passed: 0, generationRate: 0, passRate: 0 };
    c.attempts++;
    if (r.ok && r.metrics) {
      c.generated++;
      if (decide(r.metrics, t).pass) c.passed++;
    }
    cells.set(k, c);
  }
  return [...cells.values()].map((c) => ({
    ...c,
    generationRate: c.attempts ? c.generated / c.attempts : 0,
    passRate: c.generated ? c.passed / c.generated : 0,
  }));
}
```

- [ ] **Step 5: Create `lib/bench/agreement.ts`**

```ts
// lib/bench/agreement.ts — does the judge agree with a person, and which thresholds agree best.
import { decide, THRESHOLDS, type Metrics, type Thresholds } from "@/lib/judge/judge";

export interface Labelled { metrics: Metrics; good: boolean }

export function agreement(rows: Labelled[], t: Thresholds): number {
  if (rows.length === 0) return 0;
  return rows.filter((r) => decide(r.metrics, t).pass === r.good).length / rows.length;
}

export function searchThresholds(rows: Labelled[]): Thresholds {
  let best = THRESHOLDS, bestA = -1;
  for (let c = 10; c <= 40; c += 2) {
    for (let h = 50; h <= 95; h += 5) {
      for (let m = 0; m <= 20; m += 2) {
        const t = { colorDeltaE: c, headSimilarity: h / 100, minChange: m };
        const a = agreement(rows, t);
        if (a > bestA) { best = t; bestA = a; }
      }
    }
  }
  return best;
}
```

- [ ] **Step 6: Run the test to see it pass**

Run: `npx vitest run tests/bench/bench.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/bench tests/bench
git commit -m "feat: benchmark selection, aggregation and judge agreement"
```

---

## Task 22: Benchmark runner and daily workflow

Needs `HF_TOKEN` and the five person photos from Task 0.

**Files:**
- Create: `lib/judge/node.ts`, `scripts/bench/run.ts`, `data/bench/people.json`, `.github/workflows/bench.yml`

- [ ] **Step 1: Create `data/bench/people.json`** (Fahim fills the real source, licence and credit)

```json
[
  { "id": "p01", "file": "data/bench/people/p01.jpg", "source": "https://unsplash.com/photos/REPLACE", "license": "Unsplash License", "credit": "REPLACE" },
  { "id": "p02", "file": "data/bench/people/p02.jpg", "source": "https://unsplash.com/photos/REPLACE", "license": "Unsplash License", "credit": "REPLACE" },
  { "id": "p03", "file": "data/bench/people/p03.jpg", "source": "https://unsplash.com/photos/REPLACE", "license": "Unsplash License", "credit": "REPLACE" },
  { "id": "p04", "file": "data/bench/people/p04.jpg", "source": "https://unsplash.com/photos/REPLACE", "license": "Unsplash License", "credit": "REPLACE" },
  { "id": "p05", "file": "data/bench/people/p05.jpg", "source": "https://unsplash.com/photos/REPLACE", "license": "Unsplash License", "credit": "REPLACE" }
]
```

The runner refuses to start while any `REPLACE` remains, so no photo is used without its licence recorded.

- [ ] **Step 2: Create `lib/judge/node.ts`**

```ts
// lib/judge/node.ts — decode an image into Pixels with sharp (Node only).
import sharp from "sharp";
import type { Pixels } from "./pixels";

export async function loadPixelsNode(input: Buffer | string, max = 384): Promise<Pixels> {
  const { data, info } = await sharp(input).rotate().resize({ width: max, height: max, fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}
```

- [ ] **Step 3: Create `scripts/bench/run.ts`**

```ts
// scripts/bench/run.ts — resumable benchmark: up to BENCH_MAX_RUNS try-ons per invocation, stops on quota.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import type { Piece } from "@/lib/catalog/types";
import { planRuns, selectBenchPieces } from "@/lib/bench/select";
import type { BenchRow } from "@/lib/bench/aggregate";
import { decide, measure } from "@/lib/judge/judge";
import { loadPixelsNode } from "@/lib/judge/node";
import { describePiece } from "@/lib/tryon/fit";
import { idmProvider, ootdProvider } from "@/lib/tryon/hf";
import { dataUrlToBuffer, fileToDataUrl, nodeDeps } from "@/lib/tryon/node";

const PEOPLE = "data/bench/people.json";
const PIECES = "data/bench/pieces.json";
const RUNS = "data/bench/runs.json";
const IMG_DIR = "public/bench/img";
const GALLERY = "public/bench/gallery.json";
const MAX = Number(process.env.BENCH_MAX_RUNS ?? 12);

const people: { id: string; file: string; license: string; credit: string }[] = JSON.parse(readFileSync(PEOPLE, "utf8"));
if (people.some((p) => /REPLACE/.test(JSON.stringify(p)) || !existsSync(p.file))) {
  console.error("Fill data/bench/people.json (source, licence, credit) and add the photos first.");
  process.exit(1);
}

if (!existsSync(PIECES)) {
  const catalog: Piece[] = JSON.parse(readFileSync("public/catalog.json", "utf8"));
  writeFileSync(PIECES, JSON.stringify(selectBenchPieces(catalog, 2), null, 2));
}
const pieces: Piece[] = JSON.parse(readFileSync(PIECES, "utf8"));
const byId = Object.fromEntries(pieces.map((p) => [p.id, p]));
const rows: BenchRow[] = existsSync(RUNS) ? JSON.parse(readFileSync(RUNS, "utf8")) : [];
const done = new Set(rows.map((r) => r.key));
const todo = planRuns(people.map((p) => p.id), pieces).filter((r) => !done.has(r.key));
console.log(`${rows.length} done, ${todo.length} to go, running up to ${MAX}`);

const deps = nodeDeps(process.env.HF_TOKEN);
const providers = { ootd: ootdProvider(deps), idm: idmProvider(deps) };
const personData: Record<string, string> = {};
mkdirSync(IMG_DIR, { recursive: true });

let ran = 0;
for (const plan of todo.slice(0, MAX)) {
  const piece = byId[plan.piece];
  const person = people.find((p) => p.id === plan.person)!;
  personData[person.id] ??= await fileToDataUrl(person.file);
  const provider = providers[plan.provider as "ootd" | "idm"];
  const t0 = Date.now();
  const r = await provider.run({ person: personData[person.id], garment: piece.image, slot: piece.slot, description: describePiece(piece) });
  const seconds = (Date.now() - t0) / 1000;
  if (!r.ok && (r.reason === "quota" || r.reason === "unavailable")) {
    console.warn(`${plan.key}: ${r.reason}; stopping for today.`);
    break;
  }
  const base = { key: plan.key, person: plan.person, piece: piece.id, slot: piece.slot, provider: plan.provider, seconds };
  if (r.ok) {
    const buf = dataUrlToBuffer(r.image);
    const file = `${IMG_DIR}/${plan.key.replace(/[^a-z0-9]+/gi, "-")}.jpg`;
    await sharp(buf).resize({ width: 512, height: 512, fit: "inside" }).jpeg({ quality: 78 }).toFile(file);
    const metrics = measure(await loadPixelsNode(dataUrlToBuffer(personData[person.id])), await loadPixelsNode(buf), piece);
    rows.push({ ...base, ok: true, metrics, image: file.replace(/^public/, "") });
    console.log(`${plan.key}: ok in ${seconds.toFixed(0)}s, pass=${decide(metrics).pass}`);
  } else {
    rows.push({ ...base, ok: false, reason: r.reason, detail: r.detail });
    console.log(`${plan.key}: ${r.reason}: ${r.detail}`);
  }
  writeFileSync(RUNS, JSON.stringify(rows, null, 1));
  ran++;
}

const gallery = rows.filter((r) => r.ok && r.metrics && decide(r.metrics).pass)
  .map((r) => ({ piece: r.piece, slot: r.slot, provider: r.provider, image: r.image! }));
writeFileSync(GALLERY, JSON.stringify(gallery));
console.log(`Ran ${ran}. ${rows.length} of ${rows.length + todo.length - ran} complete. Gallery: ${gallery.length}.`);
```

- [ ] **Step 4: Run two locally**

Run: `$env:BENCH_MAX_RUNS=2; npm run bench:run` (PowerShell)
Expected: two lines `…: ok in Ns, pass=…`, images in `public/bench/img/`, and `data/bench/runs.json` with 2 rows. Open the images.

- [ ] **Step 5: Create `.github/workflows/bench.yml`**

```yaml
name: bench
on:
  schedule:
    - cron: "30 22 * * *" # 04:30 Dhaka, after the quota resets
  workflow_dispatch:
permissions:
  contents: write
concurrency:
  group: bench
  cancel-in-progress: false
jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - name: Run today's share of the benchmark
        run: npm run bench:run
        env:
          HF_TOKEN: ${{ secrets.HF_TOKEN }}
          BENCH_MAX_RUNS: "12"
      - name: Rebuild report
        run: npm run bench:report
      - name: Commit
        run: |
          git config user.name "eos-bot"
          git config user.email "eos-bot@users.noreply.github.com"
          git add data/bench public/bench docs/bench.md
          git diff --cached --quiet && exit 0
          git commit -m "bench: daily runs"
          git pull --rebase --autostash
          git push
```

- [ ] **Step 6: Commit**

```bash
git add lib/judge/node.ts scripts/bench/run.ts data/bench .github/workflows/bench.yml public/bench
git commit -m "feat: resumable try-on benchmark with daily workflow"
```

---

## Task 23: Calibration, report and the /bench page

**Files:**
- Create: `scripts/bench/calibrate.ts`, `scripts/bench/report.ts`, `app/bench/page.tsx`, `public/bench/results.json`

- [ ] **Step 1: Create `scripts/bench/calibrate.ts`**

```ts
// scripts/bench/calibrate.ts — `--template` writes a rating sheet; otherwise fit thresholds on half
// of Fahim's ratings and report agreement on the other half.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { BenchRow } from "@/lib/bench/aggregate";
import { agreement, searchThresholds, type Labelled } from "@/lib/bench/agreement";
import { THRESHOLDS } from "@/lib/judge/judge";

const RUNS = "data/bench/runs.json";
const SHEET = "data/bench/ratings.csv";
const rows: BenchRow[] = JSON.parse(readFileSync(RUNS, "utf8"));
const generated = rows.filter((r) => r.ok && r.image && r.metrics);

if (process.argv.includes("--template")) {
  const have = existsSync(SHEET) ? readFileSync(SHEET, "utf8") : "image,good\n";
  const listed = new Set(have.split("\n").slice(1).map((l) => l.split(",")[0]));
  const add = generated.filter((r) => !listed.has(r.image!)).map((r) => `${r.image},`).join("\n");
  writeFileSync(SHEET, have.trimEnd() + (add ? `\n${add}` : "") + "\n");
  console.log(`${SHEET}: put 1 (looks right) or 0 (wrong garment, wrong colour, altered face, or unchanged) after each image path. Images are under public/.`);
  process.exit(0);
}

const ratings = new Map(readFileSync(SHEET, "utf8").split("\n").slice(1)
  .map((l) => l.trim().split(",")).filter(([img, g]) => img && (g === "0" || g === "1")).map(([img, g]) => [img, g === "1"]));
const labelled: Labelled[] = generated.filter((r) => ratings.has(r.image!)).map((r) => ({ metrics: r.metrics!, good: ratings.get(r.image!)! }));
if (labelled.length < 20) { console.error(`Only ${labelled.length} rated; rate at least 20.`); process.exit(1); }

const train = labelled.filter((_, i) => i % 2 === 0), test = labelled.filter((_, i) => i % 2 === 1);
const fitted = searchThresholds(train);
const result = {
  n: labelled.length,
  before: agreement(labelled, THRESHOLDS),
  train: agreement(train, fitted),
  test: agreement(test, fitted),
  thresholds: fitted,
  calibratedAt: new Date().toISOString(),
};
writeFileSync("lib/judge/thresholds.json", JSON.stringify(fitted, null, 2) + "\n");
writeFileSync("data/bench/calibration.json", JSON.stringify(result, null, 2));
console.log(result);
```

- [ ] **Step 2: Create `scripts/bench/report.ts`**

```ts
// scripts/bench/report.ts — results.json for the /bench page and docs/bench.md for the repo.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { aggregate, type BenchRow } from "@/lib/bench/aggregate";
import { SLOT_NOUN } from "@/lib/catalog/slots";

const read = <T>(p: string, fallback: T): T => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const rows: BenchRow[] = read("data/bench/runs.json", []);
const table = aggregate(rows);
const judge = read<{ n: number; test: number } | null>("data/bench/calibration.json", null);
const tagger = read<{ n: number; slotAccuracy: number; colorAgreement: number } | null>("public/bench/tagger.json", null);
const results = { generatedAt: new Date().toISOString(), runs: rows.length, table, judge, tagger };
writeFileSync("public/bench/results.json", JSON.stringify(results, null, 2));

const pct = (x: number) => `${Math.round(x * 100)}%`;
const md = [
  "# How open try-on models handle Bangladeshi clothing",
  "",
  `Runs so far: ${rows.length}. Updated ${results.generatedAt.slice(0, 10)}. Live page: /bench.`,
  "",
  "| model | garment | attempts | generated | judged right |",
  "|---|---|---|---|---|",
  ...table.map((c) => `| ${c.provider === "ootd" ? "OOTDiffusion" : "IDM-VTON"} | ${SLOT_NOUN[c.slot]} | ${c.attempts} | ${pct(c.generationRate)} | ${pct(c.passRate)} |`),
  "",
  "## Method",
  "",
  "Five openly licensed photos of South Asian women (sources and licences in `data/bench/people.json`) × two pieces per garment type from the live catalog × each model that accepts that type. Each output is scored by the same judge that runs in the app: garment colour kept (CIELAB ΔE against the tagged colour), same person (difference hash of the head region), outfit changed (mean ΔE across the garment region).",
  "",
  judge ? `The judge agreed with a human rating on ${pct(judge.test)} of held-out outputs (${judge.n} rated in total).` : "Judge agreement with human ratings: not calibrated yet.",
  tagger ? `The catalog tagger chose the right garment type for ${pct(tagger.slotAccuracy)} of ${tagger.n} hand-labelled pieces, and the right main colour for ${pct(tagger.colorAgreement)}.` : "Tagger accuracy: not scored yet.",
  "",
  "## Limits",
  "",
  "Small sample: treat differences under about 15 points as noise. Regions are fixed fractions of a portrait, so crops and poses outside the norm are judged less reliably. Garment colours come from the vision tagger, not a measurement.",
  "",
].join("\n");
writeFileSync("docs/bench.md", md);
console.log(`Report: ${rows.length} runs, ${table.length} cells.`);
```

- [ ] **Step 3: Generate the first report**

Run: `npm run bench:report`
Expected: `public/bench/results.json` and `docs/bench.md` written, with the two runs from Task 22.

- [ ] **Step 4: Create `app/bench/page.tsx`**

```tsx
// /bench — the Bangladeshi try-on benchmark, rendered from committed results.
import results from "@/public/bench/results.json";
import gallery from "@/public/bench/gallery.json";
import { SLOT_NOUN, type Slot } from "@/lib/catalog/slots";

export const metadata = { title: "Eos · Bangladeshi try-on benchmark" };

interface Cell { provider: string; slot: Slot; attempts: number; generated: number; passed: number; generationRate: number; passRate: number }
interface Results { generatedAt: string | null; runs: number; table: Cell[]; judge: { n: number; test: number } | null; tagger: { n: number; slotAccuracy: number; colorAgreement: number } | null }
interface GalleryItem { piece: string; slot: Slot; provider: string; image: string }

const pct = (x: number) => `${Math.round(x * 100)}%`;
const model = (p: string) => (p === "ootd" ? "OOTDiffusion" : p === "idm" ? "IDM-VTON" : p);

export default function BenchPage() {
  const r = results as unknown as Results;
  const g = (gallery as unknown as GalleryItem[]).slice(0, 24);
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-neutral-800">
      <a href="/" className="text-xs underline">← Eos</a>
      <h1 className="mt-4 font-serif text-3xl">How open try-on models handle Bangladeshi clothing</h1>
      <p className="mt-3 text-sm text-neutral-600">
        Open virtual try-on models are trained mostly on western tops and dresses. Nobody had measured them on sarees,
        salwar kameez or kurtis. Eos runs the same automatic judge used in the app on every output: is the garment&apos;s
        colour kept, is it the same person, did the outfit actually change.
      </p>
      {r.table.length === 0 ? (
        <p className="mt-8 rounded-xl bg-neutral-100 p-6 text-sm">The benchmark is running a few try-ons a day on free GPUs. Results appear here as they complete.</p>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <thead><tr className="border-b text-xs uppercase tracking-wider text-neutral-500"><th className="py-2">Model</th><th>Garment</th><th>Attempts</th><th>Generated</th><th>Judged right</th></tr></thead>
          <tbody>
            {r.table.map((c) => (
              <tr key={`${c.provider}-${c.slot}`} className="border-b border-neutral-100">
                <td className="py-2">{model(c.provider)}</td><td>{SLOT_NOUN[c.slot]}</td><td>{c.attempts}</td><td>{pct(c.generationRate)}</td><td className="font-medium">{pct(c.passRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ul className="mt-6 space-y-1 text-xs text-neutral-500">
        <li>{r.runs} runs{r.generatedAt ? `, updated ${r.generatedAt.slice(0, 10)}` : ""}.</li>
        <li>{r.judge ? `The judge agreed with a human rating on ${pct(r.judge.test)} of held-out outputs (${r.judge.n} rated).` : "Judge agreement with human ratings: not calibrated yet."}</li>
        <li>{r.tagger ? `Catalog tagger: right garment type ${pct(r.tagger.slotAccuracy)}, right main colour ${pct(r.tagger.colorAgreement)} (${r.tagger.n} hand-labelled pieces).` : "Tagger accuracy: not scored yet."}</li>
      </ul>
      {g.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {g.map((x) => <img key={x.image} src={x.image} alt={`${SLOT_NOUN[x.slot]} by ${model(x.provider)}`} className="aspect-[3/4] w-full rounded-lg object-cover" />)}
        </div>
      )}
      <p className="mt-8 text-xs text-neutral-500">Method, limits and raw data: <a className="underline" href="https://github.com/AhmedFahim13/eos/blob/master/docs/bench.md">docs/bench.md</a>.</p>
    </main>
  );
}
```

- [ ] **Step 5: Check the page renders**

With the dev server running, open `/bench`.
Expected: the title, the table with the runs so far (or the "running" note), and any passing images. `read_console_messages` shows no errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/bench/calibrate.ts scripts/bench/report.ts app/bench/page.tsx public/bench/results.json docs/bench.md
git commit -m "feat: benchmark report, judge calibration and /bench page"
```

- [ ] **Step 7: Later, once the daily workflow has finished (about ten days)**

Run `npm run bench:calibrate -- --template`, Fahim rates `data/bench/ratings.csv`, then run `npm run bench:calibrate` and `npm run bench:report`, and commit `lib/judge/thresholds.json`, `data/bench/calibration.json`, `public/bench/results.json`, `docs/bench.md` with the message `bench: calibrate judge on N human ratings`.

---

## Task 24: README, env example and final checks

**Files:**
- Rewrite: `README.md`
- Create: `.env.example`
- Delete: `AGENTS.md`, `CLAUDE.md`

- [ ] **Step 1: Create `.env.example`**

```
# Catalog tagging and the stylist (Google AI Studio, free tier)
GEMINI_API_KEY=
# Optional model override; defaults to gemini-flash-lite-latest
GEMINI_TEXT_MODEL=
# Benchmark and smoke test only (Hugging Face read token)
HF_TOKEN=
# Optional paid fallback for try-on (fal.ai)
FAL_KEY=
```

- [ ] **Step 2: Rewrite `README.md`**

```markdown
# Eos

See yourself in a piece before you buy it. Eos lets you pick real pieces from Bangladeshi brands
(sarees, three-piece and two-piece sets, kurtis, tops, bottoms), upload a photo, and see yourself
wearing them. It costs nothing to run.

Live: https://eos-93xe.vercel.app · Benchmark: https://eos-93xe.vercel.app/bench

## How it works

1. **Catalog.** Every week a GitHub Action reads the public product feeds of Yellow, Twelve,
   Dorjibari and Kay Kraft, and a vision model (Gemini Flash-Lite, free tier) tags each new piece
   once: garment type, colours, fabric, work, formality, occasions, and which photo suits try-on.
   Tags are cached, so a piece is never tagged twice. Every piece links back to the brand.
2. **Try-on.** Your browser sends your photo and the piece straight to open try-on models on
   Hugging Face (OOTDiffusion for full-length pieces, IDM-VTON for tops). Each visitor uses their
   own free GPU allowance, and Eos never sees or stores the photo.
3. **Judge.** Every result is checked before you see it: is the garment's colour kept, is it
   still you, did the outfit actually change. A miss is retried once on the other model; if both
   miss, you get the better one with a plain note instead of a silently wrong picture.
4. **Benchmark.** The same judge scores a fixed set of benchmark models and pieces every day.
   The result, how well open try-on models handle Bangladeshi clothing, is at `/bench`.
5. **Stylist.** Pick an occasion (Eid, wedding, gaye holud, office…) and an optional budget; one
   model call picks three pieces from a rule-narrowed shortlist and says why. If the free quota
   runs out, rules answer instead, and the panel says so.

## Decisions

- **AI where it pays, cached everywhere else.** Tagging happens once per piece, offline. The
  stylist makes one call per request over about 30 candidates, never the whole catalog.
- **Try-on from the browser.** A server calling Hugging Face with one token would give the whole
  site about 3.5 GPU minutes a day. Calling from the browser gives every visitor their own.
- **Measure, then show.** The judge's thresholds are fitted to human ratings and its agreement
  is published next to the benchmark, as is the tagger's accuracy.
- **Rejected:** calling an LLM on every click (burns the free quota in an afternoon); running
  models in the browser (a 1–2 GB download, weak on phones and on Bangladeshi occasions).
- **Not built:** menswear, brands without a public feed (Aarong, Le Reve, Sailor), turning a photo
  of your own clothes into a wardrobe item.

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
directly from the visitor's browser to Hugging Face and are never stored by Eos. Benchmark photos
are openly licensed; sources and credits are in `data/bench/people.json`.

The 3D atelier (moods, procedural garments, prints) is still in the app under the 3D tab.
```

- [ ] **Step 3: Remove scaffold leftovers**

```bash
git rm AGENTS.md CLAUDE.md
```

- [ ] **Step 4: Full check**

Run: `npm test; npm run typecheck; npm run lint; npm run build`
Expected: all tests PASS, typecheck and lint clean, build succeeds.

- [ ] **Step 5: End-to-end in the browser**

Dev server running. Check, in order: the catalog loads with Bangladeshi pieces; picking a saree then a kurti swaps them; "try it on a sample model" returns a judged image; "Style me" returns suggestions and "Wear it" equips one; `/bench` renders; the 3D tab still works; mobile width (375 px) has no horizontal scroll. Take a screenshot of a finished try-on for the pull request.

- [ ] **Step 6: Commit**

```bash
git add README.md .env.example
git commit -m "docs: README around the product, decisions and privacy; env example"
```

- [ ] **Step 7: Ask Fahim before pushing**

Pushing publishes the branch. Ask, then `git push -u origin ai-layer` and open a pull request into `master` with the screenshot. The weekly catalog and daily benchmark workflows only run from `master`, so they start after merge.

---

## Self-review notes

- **Spec coverage:** catalog pipeline (Tasks 3 to 7, 9), slots and UI (2, 8), try-on engine (11 to 15, 18), judge (16 to 18), benchmark (21 to 23), stylist (19, 20), publishing (23, 24), tagger accuracy (10), privacy note (18, 24). Revisions in spec section 9 are applied: Kolors absent, browser-side Spaces, 110-run benchmark, benchmark-example fallback, Photoreal removed.
- **Deviation from spec 4.3:** the per-IP limit protects only the fal route and the stylist, since free try-on now spends each visitor's own quota.
- **Benchmark size:** 5 people × (10 full-length and top pieces × 2 models + 2 bottoms × 1 model) = 110 runs.
