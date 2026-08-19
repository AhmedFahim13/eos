// Scrape trendy women's Shopify brands via the standard /products.json, merge
// into lib/pieces.json. One parser, many brands. Run: node scripts/shopify.mjs
import { readFileSync, writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BRANDS = [
  "princesspolly.com", "www.whitefoxboutique.com", "www.ohpolly.com", "hellomolly.com",
  "www.showpo.com", "petalandpup.com", "www.beginningboutique.com", "edikted.com",
  "www.motelrocks.com", "lucyinthesky.com", "www.vergegirl.com", "www.selfieleslie.com",
  "meshki.us", "www.nakedwardrobe.com", "us.thefashionbible.com", "www.cupshe.com",
];

function slotOf(s) {
  s = s.toLowerCase();
  if (/dress|gown|frock/.test(s)) return "dress";
  if (/skirt|pant|trouser|jean|short|legging|culotte|flare/.test(s)) return "bottom";
  if (/jacket|coat|blazer|cardigan|kimono|cape|parka|puffer/.test(s)) return "outer";
  if (/shoe|heel|boot|sandal|sneaker|mule|loafer|pump\b|flats?/.test(s)) return "shoes";
  if (/\bbag|purse|tote|clutch|backpack|satchel/.test(s)) return "bag";
  if (/scarf|\bhat\b|belt|sunglass|jewel|necklace|earring|ring\b|bracelet|hair|glove|beanie/.test(s)) return "accessory";
  if (/top|shirt|blouse|tee|bodysuit|cami|crop|knit|sweater|tank|bralette|corset|bustier|tunic|halter|blazer/.test(s)) return "top";
  return null;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const pieces = [];
const seen = new Set();

async function brand(domain) {
  let n = 0;
  for (let page = 1; page <= 3; page++) {
    try {
      const res = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, { headers: { "User-Agent": UA } });
      if (!res.ok) break;
      const j = await res.json();
      const products = j.products || [];
      if (products.length === 0) break;
      for (const p of products) {
        const slot = slotOf(`${p.product_type} ${p.title} ${(p.tags || []).join(" ")}`);
        if (!slot) continue;
        const img = p.images?.[0]?.src;
        if (!img) continue;
        const id = `sh-${slug(domain)}-${p.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        pieces.push({ id, slot, name: p.title.slice(0, 60), brand: p.vendor || domain, color: "", image: img });
        n++;
      }
      await sleep(150);
    } catch { break; }
  }
  return n;
}

for (const d of BRANDS) {
  const n = await brand(d);
  console.log(`  ${d}: +${n}`);
  await sleep(200);
}

// merge with existing Uniqlo catalog
const existing = JSON.parse(readFileSync(new URL("../lib/pieces.json", import.meta.url)));
const merged = [...existing, ...pieces];
const bySlot = {};
for (const p of merged) bySlot[p.slot] = (bySlot[p.slot] || 0) + 1;
console.log(`\nnew shopify: ${pieces.length} | TOTAL: ${merged.length}`, JSON.stringify(bySlot));
writeFileSync(new URL("../lib/pieces.json", import.meta.url), JSON.stringify(merged));
writeFileSync(new URL("../catalog.json", import.meta.url), JSON.stringify(merged));
