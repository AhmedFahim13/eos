// tests/build/tags.test.ts
import { describe, expect, it } from "vitest";
import { normalizeTag, toPiece, tagKey, selectUntagged, buildCatalog, PALETTE, type Tag } from "@/lib/build/tags";
import type { RawPiece } from "@/lib/build/feeds";

const raw: RawPiece = {
  id: "yellow-11", brand: "Yellow", name: "Printed Cotton Kurti", url: "https://y/p", price: 1890,
  images: ["https://i/0.jpg", "https://i/1.jpg"], hints: "Womens Wear",
};

const good = {
  slot: "kurti", colors: ["maroon", "gold", "not-a-colour"], fabric: "cotton", work: "print",
  formality: 3.6, occasions: ["eid", "office", "moon"], tryon_image: 5, image_kind: "flat", tryon_ok: true,
};

describe("normalizeTag", () => {
  it("keeps allowed values, clamps numbers and drops unknowns", () => {
    const t = normalizeTag(good, 2)!;
    expect(t.colors).toEqual(["maroon", "gold"]);
    expect(t.formality).toBe(4);
    expect(t.occasions).toEqual(["eid", "office"]);
    expect(t.tryon_image).toBe(1);
  });
  it("rejects an unknown slot", () => {
    expect(normalizeTag({ ...good, slot: "dress" }, 2)).toBeNull();
  });
  it("rejects a wearable with no valid colour", () => {
    expect(normalizeTag({ ...good, colors: ["plaid"] }, 2)).toBeNull();
  });
  it("accepts skip without colours", () => {
    expect(normalizeTag({ slot: "skip", colors: [] }, 1)?.slot).toBe("skip");
  });
});

describe("toPiece", () => {
  it("builds a piece using the chosen image and palette hex", () => {
    const p = toPiece(raw, normalizeTag(good, 2)!)!;
    expect(p.image).toBe("https://i/1.jpg");
    expect(p.colors[0]).toEqual({ name: "maroon", hex: PALETTE.maroon });
    expect(p.imageKind).toBe("flat");
  });
  it("drops skipped pieces and wearables without a usable try-on image", () => {
    expect(toPiece(raw, normalizeTag({ slot: "skip", colors: [] }, 2)!)).toBeNull();
    expect(toPiece(raw, normalizeTag({ ...good, tryon_ok: false }, 2)!)).toBeNull();
  });
  it("keeps extras even without a try-on image", () => {
    expect(toPiece(raw, normalizeTag({ ...good, slot: "orna", tryon_ok: false }, 2)!)?.slot).toBe("orna");
  });
});

describe("cache", () => {
  it("keys change when images change", () => {
    expect(tagKey(raw)).not.toBe(tagKey({ ...raw, images: ["https://i/9.jpg"] }));
    expect(tagKey(raw)).toBe(tagKey({ ...raw }));
  });
  it("selects only untagged pieces, up to the budget", () => {
    const b = { ...raw, id: "b" }, c = { ...raw, id: "c" };
    const cache: Record<string, Tag> = { [tagKey(raw)]: normalizeTag(good, 2)! };
    expect(selectUntagged([raw, b, c], cache, 1).map((r) => r.id)).toEqual(["b"]);
  });
  it("builds the catalog from cached tags only", () => {
    const b = { ...raw, id: "b" };
    const cache: Record<string, Tag> = { [tagKey(raw)]: normalizeTag(good, 2)! };
    expect(buildCatalog([raw, b], cache).map((p) => p.id)).toEqual(["yellow-11"]);
  });
});
