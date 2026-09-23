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
