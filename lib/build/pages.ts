// lib/build/pages.ts — shops without a product API still publish their products for search engines: a
// product sitemap and, on each product page, schema.org Product data (JSON-LD) or OpenGraph tags. We read
// only what robots.txt allows, one page a second.
import type { RawPiece } from "./feeds";

export interface PageSource {
  brand: string;
  domain: string;
  /** Sitemap paths to read; entries may be sitemap indexes. */
  sitemaps: string[];
  /** Only product URLs matching this are fetched. */
  productPath: RegExp;
}

export const PAGE_SOURCES: PageSource[] = [
  { brand: "Tangail Saree Kutir", domain: "tskbd.com", sitemaps: ["/product-sitemap.xml"], productPath: /\/product\// },
  { brand: "Dhaka Mart", domain: "dhakamart.fashion", sitemaps: ["/sitemap.xml"], productPath: /\/product\// },
  { brand: "Le Reve", domain: "www.lerevecraze.com", sitemaps: ["/product-sitemap.xml", "/product-sitemap2.xml", "/product-sitemap3.xml"], productPath: /\/product\// },
  { brand: "Horitoki", domain: "horitoki.com", sitemaps: ["/sitemap.xml"], productPath: /\/product\// },
];

export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

const decode = (s: string) =>
  s.replace(/&#8217;|&rsquo;/g, "’").replace(/&#8211;|&ndash;/g, "–").replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function meta(html: string, prop: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re);
  return m ? decode(m[1] ?? m[2]) : undefined;
}

type Json = Record<string, unknown>;
const types = (x: Json) => ([] as unknown[]).concat(x["@type"] ?? []).map(String);

function jsonLd(html: string): Json[] {
  const out: Json[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].trim());
      for (const x of ([] as unknown[]).concat(j)) {
        const o = x as Json;
        out.push(o, ...((o["@graph"] as Json[] | undefined) ?? []));
      }
    } catch { /* malformed block: skip */ }
  }
  return out;
}

const firstImage = (v: unknown): string | undefined => {
  const x = ([] as unknown[]).concat(v ?? [])[0];
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && typeof (x as Json).url === "string") return (x as Json).url as string;
  return undefined;
};

const absolute = (src: string, url: string) => {
  try { return new URL(src.replace(/([^:])\/\/+/g, "$1/"), url).toString(); } catch { return src; }
};

/** A product page → RawPiece, from schema.org Product data, else OpenGraph tags; null if neither names a product image. */
export function parseProductPage(src: PageSource, url: string, html: string): RawPiece | null {
  const blocks = jsonLd(html);
  const product = blocks.find((b) => types(b).includes("Product"));
  const crumbs = blocks.find((b) => types(b).includes("BreadcrumbList"));
  const crumbText = ((crumbs?.itemListElement as Json[] | undefined) ?? [])
    .map((i) => String(i.name ?? (i.item as Json | undefined)?.name ?? "")).filter(Boolean);

  const offers = ([] as unknown[]).concat(product?.offers ?? [])[0] as Json | undefined;
  const name = decode(String(product?.name ?? meta(html, "og:title") ?? "")).replace(/\s*[|–-]\s*(Tangail Saree Kutir|Dhaka Mart|Le Reve|Horitoki).*$/i, "");
  const image = firstImage(product?.image) ?? meta(html, "og:image");
  if (!name || !image || /logo/i.test(image)) return null;

  const priceRaw = offers?.price ?? offers?.lowPrice ?? meta(html, "product:price:amount") ?? meta(html, "og:price:amount");
  const price = Number(String(priceRaw ?? "").replace(/,/g, ""));
  const category = [product?.category, ...crumbText, meta(html, "product:category"), meta(html, "article:section")]
    .filter((x): x is string => typeof x === "string" && x.length > 0).map(decode);
  const path = new URL(url).pathname.replace(/\/$/, "");
  return {
    id: `${slug(src.brand)}-${slug(path.split("/").pop() ?? path)}`,
    brand: src.brand,
    name,
    url,
    price: Number.isFinite(price) && price > 0 ? price : null,
    images: [absolute(image, url)],
    hints: [...new Set(category)].join(" | "),
  };
}
