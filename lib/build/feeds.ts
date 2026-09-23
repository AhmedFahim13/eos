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
