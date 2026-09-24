// scripts/catalog/pages.ts — read product pages of shops without a product API (lib/build/pages.ts).
// Each product URL is fetched once and cached in data/catalog/pages-cache.json; reruns only fetch new URLs.
// PAGES_BUDGET caps fetches per run. Respects robots.txt: checked by hand for each source (2026-09-24).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PAGE_SOURCES, parseProductPage, sitemapLocs } from "@/lib/build/pages";
import type { RawPiece } from "@/lib/build/feeds";

const UA = "EosCatalogBot/1.0 (+https://github.com/AhmedFahim13/eos)";
const CACHE = "data/catalog/pages-cache.json";
const BUDGET = Number(process.env.PAGES_BUDGET ?? 1500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

const cache: Record<string, RawPiece | null> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
let fetched = 0;

for (const src of PAGE_SOURCES) {
  const urls = new Set<string>();
  const queue = src.sitemaps.map((p) => `https://${src.domain}${p}`);
  const seenMaps = new Set<string>();
  while (queue.length) {
    const sm = queue.shift()!;
    if (seenMaps.has(sm)) continue;
    seenMaps.add(sm);
    const xml = await get(sm);
    await sleep(1000);
    if (!xml) continue;
    for (const loc of sitemapLocs(xml)) {
      if (/\.xml(\?|$)/.test(loc)) { if (/product/i.test(loc)) queue.push(loc); }
      else if (src.productPath.test(new URL(loc).pathname)) urls.add(loc);
    }
  }
  const todo = [...urls].filter((u) => !(u in cache));
  let added = 0;
  for (const url of todo) {
    if (fetched >= BUDGET) break;
    const html = await get(url);
    fetched++;
    cache[url] = html ? parseProductPage(src, url, html) : null;
    if (cache[url]) added++;
    if (fetched % 50 === 0) { writeFileSync(CACHE, JSON.stringify(cache)); console.log(`  ${fetched} pages fetched`); }
    await sleep(1000);
  }
  console.log(`${src.brand}: ${urls.size} product URLs, ${todo.length} new, ${added} parsed this run`);
}
mkdirSync("data/catalog", { recursive: true });
writeFileSync(CACHE, JSON.stringify(cache));
console.log(`pages cache: ${Object.values(cache).filter(Boolean).length} products`);
