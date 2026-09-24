// scripts/catalog/colors.ts — focused colour read for each tagged piece, once, cached by the same key as tags.
// COLOR_ONLY=gold limits the run to the reference-labelled pieces (for measuring before spending quota).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { generateJSON, QuotaError } from "@/lib/ai/gemini";
import { COLOR_SCHEMA, colorPrompt, normalizeColorRead, type ColorRead } from "@/lib/build/colorPass";
import { tagKey, type Tag } from "@/lib/build/tags";
import { SLOT_NOUN, type Slot } from "@/lib/catalog/slots";
import type { RawPiece } from "@/lib/build/feeds";

if (!process.env.GEMINI_API_KEY) {
  console.log("GEMINI_API_KEY is not set; skipping colour reads.");
  process.exit(1);
}

const CACHE = "data/catalog/colors-cache.json";
const BUDGET = Number(process.env.COLOR_BUDGET ?? 300);
const DELAY_MS = Number(process.env.TAG_DELAY_MS ?? 4500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const raws: RawPiece[] = JSON.parse(readFileSync("data/catalog/raw.json", "utf8"));
const tags: Record<string, Tag> = JSON.parse(readFileSync("data/catalog/tags-cache.json", "utf8"));
const cache: Record<string, ColorRead> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const only = process.env.COLOR_ONLY === "gold"
  ? new Set((JSON.parse(readFileSync("data/labels/tags-gold.json", "utf8")) as { id: string }[]).map((g) => g.id))
  : null;

const todo = raws.filter((r) => {
  const t = tags[tagKey(r)];
  return t && t.slot !== "skip" && !(tagKey(r) in cache) && (!only || only.has(r.id));
}).slice(0, BUDGET);
console.log(`colour reads: ${Object.keys(cache).length} cached, reading ${todo.length}`);

let done = 0;
for (const r of todo) {
  const t = tags[tagKey(r)];
  try {
    const res = await fetch(r.images[t.tryon_image] ?? r.images[0], { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`image ${res.status}`);
    const img = await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 640, height: 640, fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
    const raw = await generateJSON<unknown>({
      parts: [{ text: colorPrompt(r.name, SLOT_NOUN[t.slot as Slot]) }, { inline_data: { mime_type: "image/jpeg", data: img.toString("base64") } }],
      schema: COLOR_SCHEMA,
    });
    const read = normalizeColorRead(raw);
    if (read) cache[tagKey(r)] = read;
  } catch (e) {
    if (e instanceof QuotaError) { console.warn("Gemini quota reached; stopping for today."); break; }
    console.warn(`  ${r.id}: ${String(e).slice(0, 120)}`);
  }
  if (++done % 20 === 0) { writeFileSync(CACHE, JSON.stringify(cache)); console.log(`  ${done}/${todo.length}`); }
  await sleep(DELAY_MS);
}
writeFileSync(CACHE, JSON.stringify(cache));
console.log(`done: ${Object.keys(cache).length} cached`);
