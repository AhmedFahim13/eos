// tests/build/colorPass.test.ts
import { describe, expect, it } from "vitest";
import { mergeColors, normalizeColorRead } from "@/lib/build/colorPass";

describe("normalizeColorRead", () => {
  it("keeps palette colours and drops the rest", () => {
    expect(normalizeColorRead({ primary: "brown", secondary: ["maroon", "brown", "plaid", "gold", "red"], styles: ["Embroidery", "Sheer"] }))
      .toEqual({ primary: "brown", secondary: ["maroon", "gold"], styles: ["Embroidery"] });
  });
  it("rejects an unknown primary", () => {
    expect(normalizeColorRead({ primary: "taupe", secondary: [] })).toBeNull();
    expect(normalizeColorRead(null)).toBeNull();
  });
});

describe("mergeColors", () => {
  it("puts the brand colour first, then the focused read, capped at three", () => {
    expect(mergeColors("olive", { primary: "green", secondary: ["white"] }, ["teal", "black"])).toEqual(["olive", "green", "teal"]);
  });
  it("works without a brand colour or a read", () => {
    expect(mergeColors(null, { primary: "brown", secondary: [] }, ["maroon", "orange"])).toEqual(["brown", "maroon", "orange"]);
    expect(mergeColors(null, null, ["maroon"])).toEqual(["maroon"]);
  });
});
