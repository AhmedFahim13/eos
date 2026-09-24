// scripts/catalog/eval.ts — first run writes a labelling template; later runs score the tagger.
// Two label sets: `tune` (data/labels/tags-gold.json), used while improving the tagger, and `test`
// (data/labels/tags-test.json), a disjoint sample labelled before any tuning and the only one published.
// Usage: npm run catalog:eval -- [tune|test]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tagKey, type Tag } from "@/lib/build/tags";
import { applyRules } from "@/lib/build/rules";
import { scoreTags, type GoldTag } from "@/lib/build/tagEval";
import type { RawPiece } from "@/lib/build/feeds";

const SET = process.argv[2] === "test" ? "test" : "tune";
const FILES = { tune: "data/labels/tags-gold.json", test: "data/labels/tags-test.json" };
const GOLD = FILES[SET];
const OUT = "public/bench/tagger.json";
const SAMPLE = 60;

const raws: RawPiece[] = JSON.parse(readFileSync("data/catalog/raw.json", "utf8"));
const cache: Record<string, Tag> = JSON.parse(readFileSync("data/catalog/tags-cache.json", "utf8"));
const pred: Record<string, Tag> = {};
const colorCache = existsSync("data/catalog/colors-cache.json") ? JSON.parse(readFileSync("data/catalog/colors-cache.json", "utf8")) : {};
for (const r of raws) if (cache[tagKey(r)]) pred[r.id] = applyRules(r, cache[tagKey(r)], colorCache[tagKey(r)] ?? null);

if (!existsSync(GOLD)) {
  const salt = SET === "test" ? "test:" : "";
  const order = (id: string) => createHash("sha1").update(salt + id).digest("hex");
  const exclude = SET === "test" && existsSync(FILES.tune)
    ? new Set((JSON.parse(readFileSync(FILES.tune, "utf8")) as { id: string }[]).map((g) => g.id))
    : new Set<string>();
  const sample = raws.filter((r) => pred[r.id] && !exclude.has(r.id)).sort((a, b) => order(a.id).localeCompare(order(b.id))).slice(0, SAMPLE);
  mkdirSync("data/labels", { recursive: true });
  writeFileSync(GOLD, JSON.stringify(sample.map((r) => ({
    id: r.id, name: r.name, url: r.url, images: r.images.slice(0, 3),
    slot: "", primary_color: "", occasions: [],
  })), null, 2));
  console.log(`Wrote ${sample.length} rows to ${GOLD}. Fill slot, primary_color and occasions, then run again.`);
  console.log("slot: saree | set3 | set2 | kurti | top | bottom | orna | accessory | skip");
  process.exit(0);
}

const gold: GoldTag[] = JSON.parse(readFileSync(GOLD, "utf8"));
const score = scoreTags(gold, pred);
if (SET === "test") {
  mkdirSync("public/bench", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ ...score, set: "held-out test", scoredAt: new Date().toISOString() }, null, 2));
}
console.log(SET, score);
