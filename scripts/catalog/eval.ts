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
