// scripts/catalog/tag.ts — tag each new piece once with a vision model, then rebuild public/catalog.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { generateJSON, QuotaError } from "@/lib/ai/gemini";
import { TAG_SCHEMA, buildCatalog, normalizeTag, selectUntagged, tagKey, tagPrompt, type Tag } from "@/lib/build/tags";
import type { RawPiece } from "@/lib/build/feeds";

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set; skipping tagging.");
  process.exit(1);
}

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

const colorCache = existsSync("data/catalog/colors-cache.json") ? JSON.parse(readFileSync("data/catalog/colors-cache.json", "utf8")) : {};
const pieces = buildCatalog(raws, cache, colorCache);
if (pieces.length < MIN_PIECES) {
  console.error(`Only ${pieces.length} usable pieces; keeping the previous ${OUT}.`);
  process.exit(1);
}
writeFileSync(OUT, JSON.stringify(pieces));
const bySlot: Record<string, number> = {};
for (const p of pieces) bySlot[p.slot] = (bySlot[p.slot] ?? 0) + 1;
console.log(`Wrote ${pieces.length} pieces to ${OUT}`, bySlot);
