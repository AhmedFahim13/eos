// tests/build/rules.test.ts
import { describe, expect, it } from "vitest";
import { applyRules, colorFromText, slotFromText } from "@/lib/build/rules";
import type { Tag } from "@/lib/build/tags";

describe("slotFromText", () => {
  it("trusts the brand's piece count over what the photo shows", () => {
    expect(slotFromText("Smart Fit Printed Two-Piece Lawn with Chiffon Dupatta", "")).toBe("set2");
    expect(slotFromText("Womens Blue Print 2-Piece Set", "Womens 2 Pcs")).toBe("set2");
    expect(slotFromText("Smart Fit Embroidered Three-Piece Ethnic Set", "")).toBe("set3");
    expect(slotFromText("Womens Green Three Piece Set", "Womens 3Pcs")).toBe("set3");
  });
  it("reads single garments", () => {
    expect(slotFromText("Magenta Cotton Printed Saree", "Saree")).toBe("saree");
    expect(slotFromText("Relaxed Fit Embroidered Jacquard Cotton Lawn Kurta", "")).toBe("kurti");
    expect(slotFromText("Women’s Green Cotton Tunic", "Womens Tunic")).toBe("kurti");
    expect(slotFromText("Tribal-Printed Long Shirt - Mystika", "")).toBe("kurti");
    expect(slotFromText("Relaxed Fit Palazzo", "")).toBe("bottom");
    expect(slotFromText("Women’s Light Grey Denim Pant", "")).toBe("bottom");
    expect(slotFromText("Polyester Blazer with Shiny Fabric Embellishment - Bling", "")).toBe("top");
    expect(slotFromText("Regular Fit Cap Sleeve T-Shirt with Sequin Front Yoke", "")).toBe("top");
  });
  it("reads a salwar kameez set as a set, three-piece when it names a dupatta", () => {
    expect(slotFromText("Maroon Linen Printed Salwar Kameez Set", "")).toBe("set2");
    expect(slotFromText("Cotton Salwar Kameez with Dupatta", "")).toBe("set3");
  });
  it("treats a named top-and-bottom pair as a two-piece", () => {
    expect(slotFromText("White Georgette Printed Top with Skirt", "")).toBe("set2");
  });
  it("leaves unclear names to the vision model", () => {
    expect(slotFromText("Digital Printed Long Dress - Mystika", "Womens Wear")).toBeNull();
    expect(slotFromText("Relaxed Fit Semi-Formal Kaftan Ethnic Set", "")).toBeNull();
  });
});

describe("colorFromText", () => {
  it("maps brand colour words to the palette", () => {
    expect(colorFromText("Womens Green Skirt", "")).toBe("green");
    expect(colorFromText("Relaxed Fit Embroidered Fashion Top", "Womens Wear | DK OLIVE GREEN")).toBe("olive");
    expect(colorFromText("Smart Fit Printed Two-Piece Lawn", "Lawn | OFF WHITE")).toBe("ivory");
    expect(colorFromText("Womens Maroon Ethnic Gown", "")).toBe("maroon");
    expect(colorFromText("Women’s Light Grey Denim Pant", "")).toBe("grey");
  });
  it("returns null when the text names no colour or several", () => {
    expect(colorFromText("Relaxed Fit Palazzo", "Womens Wear")).toBeNull();
    expect(colorFromText("Red and Black Printed Kurti", "")).toBeNull();
  });
});

describe("applyRules", () => {
  const tag: Tag = {
    slot: "set3", colors: ["white", "black"], fabric: "lawn", work: "print", formality: 2,
    occasions: ["casual"], tryon_image: 0, image_kind: "on_model", tryon_ok: true,
  };
  it("overrides the slot and puts the brand colour first", () => {
    const t = applyRules({ name: "Smart Fit Printed Two-Piece Lawn", hints: "OFF WHITE" }, tag);
    expect(t.slot).toBe("set2");
    expect(t.colors).toEqual(["ivory", "white", "black"]);
  });
  it("keeps the model's answer when the text says nothing", () => {
    expect(applyRules({ name: "Plain Long Dress", hints: "" }, tag)).toEqual({ ...tag, styles: [] });
  });
  it("adds style tags from the brand text and the vision read", () => {
    const t = applyRules({ name: "Dhakai Jamdani Saree", hints: "" }, { ...tag, slot: "saree" }, { primary: "red", secondary: [], styles: ["Zari"] });
    expect(t.styles).toEqual(["Jamdani", "Zari"]);
  });
  it("never un-skips a piece the model rejected", () => {
    expect(applyRules({ name: "Boxer Two-Piece Pack", hints: "" }, { ...tag, slot: "skip" }).slot).toBe("skip");
  });
});
