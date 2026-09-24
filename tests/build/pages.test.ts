// tests/build/pages.test.ts
import { describe, expect, it } from "vitest";
import { parseProductPage, sitemapLocs, type PageSource } from "@/lib/build/pages";

const tsk: PageSource = { brand: "Tangail Saree Kutir", domain: "tskbd.com", sitemaps: [], productPath: /\/product\// };

describe("sitemapLocs", () => {
  it("reads loc entries and unescapes ampersands", () => {
    const xml = `<urlset><url><loc>https://tskbd.com/product/a/</loc></url><url><loc> https://tskbd.com/product/b?x=1&amp;y=2 </loc></url></urlset>`;
    expect(sitemapLocs(xml)).toEqual(["https://tskbd.com/product/a/", "https://tskbd.com/product/b?x=1&y=2"]);
  });
});

describe("parseProductPage", () => {
  it("prefers schema.org Product data and breadcrumbs", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","name":"Home"},{"@type":"ListItem","name":"Saree"},{"@type":"ListItem","name":"Jamdani Saree"}]},
        {"@type":"Product","name":"Kadai Saree (01339-4)","image":"https://tskbd.com/wp-content/uploads/k.jpg","offers":{"@type":"Offer","price":"2500.00"}}]}</script>
      </head></html>`;
    expect(parseProductPage(tsk, "https://tskbd.com/product/kadai-saree-01339-4/", html)).toEqual({
      id: "tangail-saree-kutir-kadai-saree-01339-4", brand: "Tangail Saree Kutir", name: "Kadai Saree (01339-4)",
      url: "https://tskbd.com/product/kadai-saree-01339-4/", price: 2500,
      images: ["https://tskbd.com/wp-content/uploads/k.jpg"], hints: "Home | Saree | Jamdani Saree",
    });
  });
  it("falls back to OpenGraph tags and strips the shop name from titles", () => {
    const html = `<meta property="og:title" content="Katan Silk Saree | Tangail Saree Kutir"><meta property="og:image" content="/img/katan.jpg"><meta property="product:price:amount" content="8,500">`;
    const p = parseProductPage(tsk, "https://tskbd.com/product/katan/", html)!;
    expect(p.name).toBe("Katan Silk Saree");
    expect(p.images).toEqual(["https://tskbd.com/img/katan.jpg"]);
    expect(p.price).toBe(8500);
  });
  it("ignores pages without a product image, and site logos", () => {
    expect(parseProductPage(tsk, "https://tskbd.com/product/x/", `<meta property="og:title" content="X">`)).toBeNull();
    expect(parseProductPage(tsk, "https://tskbd.com/product/x/", `<meta property="og:title" content="X"><meta property="og:image" content="https://tskbd.com/logo.png">`)).toBeNull();
  });
  it("tolerates malformed JSON-LD and cleans doubled slashes in image paths", () => {
    const html = `<script type="application/ld+json">{bad json</script><script type="application/ld+json">{"@type":"Product","name":"Silk Saree","image":["https://dhakamart.fashion//posadmin/images/a.jpg"],"category":"SAREE","offers":[{"price":"7500"}]}</script>`;
    const p = parseProductPage({ ...tsk, brand: "Dhaka Mart" }, "https://dhakamart.fashion/product/silk-saree", html)!;
    expect(p.images).toEqual(["https://dhakamart.fashion/posadmin/images/a.jpg"]);
    expect(p.hints).toBe("SAREE");
    expect(p.price).toBe(7500);
  });
});
