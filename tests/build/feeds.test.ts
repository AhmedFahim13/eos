// tests/build/feeds.test.ts
import { describe, expect, it } from "vitest";
import { parseShopify, parseWoo, isWomens, pageLength, feedUrl, type FeedSource } from "@/lib/build/feeds";

const yellow: FeedSource = { brand: "Yellow", domain: "yellowclothing.net", kind: "shopify" };
const kay: FeedSource = { brand: "Kay Kraft", domain: "www.kaykraft.com", kind: "woo" };

const shopifyPage = {
  products: [
    { id: 11, title: "Printed Cotton Kurti", handle: "printed-kurti", product_type: "Womens Wear", tags: ["Kurti", "Eid"], variants: [{ price: "1890.00" }], images: [{ src: "https://cdn.shopify.com/a.jpg" }, { src: "https://cdn.shopify.com/b.jpg" }] },
    { id: 12, title: "No Image Tee", handle: "x", product_type: "Womens Wear", tags: [], variants: [{ price: "500" }], images: [] },
  ],
};

const wooPage = [
  { id: 7, name: "Magenta Cotton Printed Saree", permalink: "https://www.kaykraft.com/product/magenta/", prices: { price: "450000", currency_minor_unit: 2 }, images: [{ src: "https://www.kaykraft.com/m.jpg" }], categories: [{ name: "Saree" }], tags: [{ name: "Cotton" }] },
];

describe("parseShopify", () => {
  it("maps a product and drops ones without images", () => {
    const rows = parseShopify(yellow, shopifyPage);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "yellow-11", brand: "Yellow", name: "Printed Cotton Kurti",
      url: "https://yellowclothing.net/products/printed-kurti", price: 1890,
      images: ["https://cdn.shopify.com/a.jpg", "https://cdn.shopify.com/b.jpg"],
      hints: "Womens Wear | Kurti | Eid",
    });
  });
  it("accepts tags as a comma string", () => {
    const rows = parseShopify(yellow, { products: [{ ...shopifyPage.products[0], tags: "Kurti, Eid" }] });
    expect(rows[0].hints).toBe("Womens Wear | Kurti | Eid");
  });
});

describe("parseWoo", () => {
  it("maps a product and converts minor units", () => {
    const [row] = parseWoo(kay, wooPage);
    expect(row.id).toBe("kay-kraft-7");
    expect(row.price).toBe(4500);
    expect(row.url).toBe("https://www.kaykraft.com/product/magenta/");
    expect(row.hints).toBe("Saree | Cotton");
  });
  it("decodes HTML entities in names", () => {
    const [row] = parseWoo(kay, [{ ...wooPage[0], name: "LUBNAN WOMEN&#8217;S KURTI" }]);
    expect(row.name).toBe("LUBNAN WOMEN’S KURTI");
  });
});

describe("isWomens", () => {
  const base = { id: "x", brand: "b", url: "u", price: null, images: ["i"] };
  it("keeps women's wear", () => {
    expect(isWomens({ ...base, name: "Printed Cotton Kurti", hints: "Womens Wear" })).toBe(true);
    expect(isWomens({ ...base, name: "Womens Off White 3-Piece Set", hints: "Womens 3Pcs" })).toBe(true);
    expect(isWomens({ ...base, name: "Magenta Saree", hints: "Saree" })).toBe(true);
  });
  it("drops men's, kids' and underwear", () => {
    expect(isWomens({ ...base, name: "Regular Fit Panjabi", hints: "Mens Wear" })).toBe(false);
    expect(isWomens({ ...base, name: "Girls' Dress (6-8 Years)", hints: "Kids Wear" })).toBe(false);
    expect(isWomens({ ...base, name: "Semi Fit Solid Boxer", hints: "Underwear" })).toBe(false);
  });
});

describe("paging", () => {
  it("builds feed URLs", () => {
    expect(feedUrl(yellow, 2)).toBe("https://yellowclothing.net/products.json?limit=250&page=2");
    expect(feedUrl(kay, 3)).toBe("https://www.kaykraft.com/wp-json/wc/store/v1/products?per_page=100&page=3");
  });
  it("counts raw page length before filtering", () => {
    expect(pageLength(yellow, shopifyPage)).toBe(2);
    expect(pageLength(kay, wooPage)).toBe(1);
    expect(pageLength(kay, { code: "error" })).toBe(0);
  });
});
