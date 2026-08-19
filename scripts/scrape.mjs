// scripts/scrape.mjs — build a real women's-fashion catalog from brand product
// APIs. Images are hotlinked from brand CDNs (no hosting). Run: node scripts/scrape.mjs
import { writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// search term -> our slot
const TERMS = {
  dress: ["dress"],
  top: ["blouse", "shirt", "t-shirt", "sweater", "cardigan", "knit top", "tank top", "tunic", "polo shirt"],
  bottom: ["skirt", "pants", "trousers", "jeans", "shorts", "leggings", "culottes"],
  outer: ["coat", "jacket", "blazer", "parka", "vest"],
  bag: ["bag", "tote bag", "shoulder bag"],
  accessory: ["scarf", "hat", "belt", "socks", "gloves", "cap", "beanie"],
  shoes: ["shoes", "sandals"],
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pieces = [];
const seen = new Set();

async function uniqlo(term, slot) {
  const url = `https://www.uniqlo.com/us/api/commerce/v5/en/products?q=${encodeURIComponent(term)}&offset=0&limit=40&httpFailure=true`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return 0;
    const j = await res.json();
    const items = j?.result?.items || [];
    let n = 0;
    for (const it of items) {
      const gender = (it.genderCategory || "").toUpperCase();
      if (gender && gender !== "WOMEN" && gender !== "UNISEX") continue;
      const colorMap = it.images?.main || {};
      const colors = Array.isArray(it.colors) ? it.colors : [];
      const codeName = Object.fromEntries(colors.map((c) => [c.code || c.displayCode, (c.name || "").toLowerCase()]));
      let variants = 0;
      for (const [code, obj] of Object.entries(colorMap)) {
        const img = obj?.image || obj?.url;
        if (!img || variants >= 3) continue;
        const id = `uq-${it.productId || it.priceGroup || slug(it.name)}-${code}`;
        if (seen.has(id)) continue;
        seen.add(id);
        pieces.push({
          id,
          slot,
          name: it.name,
          brand: "Uniqlo",
          color: codeName[code] || "",
          image: img,
        });
        variants++;
        n++;
      }
    }
    return n;
  } catch {
    return 0;
  }
}

for (const [slot, terms] of Object.entries(TERMS)) {
  for (const term of terms) {
    const n = await uniqlo(term, slot);
    console.log(`  ${slot}/${term}: +${n}`);
    await sleep(300);
  }
}

// stats
const bySlot = {};
for (const p of pieces) bySlot[p.slot] = (bySlot[p.slot] || 0) + 1;
console.log("\nTOTAL:", pieces.length, JSON.stringify(bySlot));

writeFileSync(new URL("../lib/pieces.json", import.meta.url), JSON.stringify(pieces));
console.log("wrote lib/pieces.json");
