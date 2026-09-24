// tests/build/styles.test.ts
import { describe, expect, it } from "vitest";
import { mergeStyles, stylesFromText } from "@/lib/build/styles";

describe("stylesFromText", () => {
  it("reads weaves, crafts and fabrics the brand names", () => {
    expect(stylesFromText("Dhakai Jamdani Half Silk Saree", "Saree")).toEqual(["Jamdani", "Half silk", "Silk"]);
    expect(stylesFromText("Mirpur Katan Saree with Zari Border", "")).toEqual(["Katan", "Zari"]);
    expect(stylesFromText("Kantha Stitch Cotton Saree", "")).toEqual(["Kantha", "Cotton"]);
  });
  it("reads cuts and bottoms", () => {
    expect(stylesFromText("Women’s Premium Black Anarkali Kurti", "")).toEqual(["Anarkali"]);
    expect(stylesFromText("Relaxed Fit Printed Palazzo", "")).toEqual(["Palazzo"]);
    expect(stylesFromText("Smart Fit Digitally Printed One Piece Lawn Kurta", "")).toEqual(["Digital print", "Lawn"]);
  });
  it("does not match inside other words", () => {
    expect(stylesFromText("Instant Comfort Tee", "")).toEqual([]);
    expect(stylesFromText("Silky Touch Top", "")).toEqual([]);
  });
});

describe("mergeStyles", () => {
  it("keeps text tags and only allowed visual tags, without duplicates", () => {
    expect(mergeStyles(["Jamdani", "Cotton"], ["Embroidery", "Jamdani", "Sheer"])).toEqual(["Jamdani", "Cotton", "Embroidery"]);
  });
});
