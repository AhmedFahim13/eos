// tests/catalog/slots.test.ts
import { describe, expect, it } from "vitest";
import { displaced, TRYON_ORDER, isWearable } from "@/lib/catalog/slots";

describe("displaced", () => {
  it("an outfit clears every other wearable but keeps extras", () => {
    const d = displaced("saree");
    expect(d).toEqual(expect.arrayContaining(["set3", "set2", "kurti", "top", "bottom"]));
    expect(d).not.toContain("saree");
    expect(d).not.toContain("orna");
  });
  it("kurti and top replace each other and any outfit", () => {
    expect(displaced("kurti").sort()).toEqual(["saree", "set2", "set3", "top"]);
    expect(displaced("top").sort()).toEqual(["kurti", "saree", "set2", "set3"]);
  });
  it("a bottom only clears outfits", () => {
    expect(displaced("bottom").sort()).toEqual(["saree", "set2", "set3"]);
  });
  it("extras clear nothing", () => {
    expect(displaced("orna")).toEqual([]);
    expect(displaced("accessory")).toEqual([]);
  });
});

describe("try-on order", () => {
  it("puts the bottom before what goes over it", () => {
    expect(TRYON_ORDER.indexOf("bottom")).toBeLessThan(TRYON_ORDER.indexOf("kurti"));
  });
  it("does not try on extras", () => {
    expect(isWearable("orna")).toBe(false);
    expect(isWearable("saree")).toBe(true);
  });
});
