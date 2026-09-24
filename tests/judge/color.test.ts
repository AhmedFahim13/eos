// tests/judge/color.test.ts
import { describe, expect, it } from "vitest";
import { colorCoverage, deltaE, dominantLabs, hexToLab, srgbToLab } from "@/lib/judge/color";
import { makePixels } from "../helpers/pixels";

const FULL = { x0: 0, y0: 0, x1: 1, y1: 1 };

describe("srgbToLab", () => {
  it("matches reference values", () => {
    const w = srgbToLab(255, 255, 255);
    expect(w[0]).toBeCloseTo(100, 1);
    expect(Math.abs(w[1])).toBeLessThan(0.5);
    expect(srgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 5);
    const red = srgbToLab(255, 0, 0);
    expect(red[0]).toBeCloseTo(53.24, 0);
    expect(red[1]).toBeCloseTo(80.09, 0);
    expect(red[2]).toBeCloseTo(67.2, 0);
  });
  it("reads hex", () => {
    expect(deltaE(hexToLab("#ff0000"), srgbToLab(255, 0, 0))).toBeCloseTo(0, 6);
  });
});

describe("dominantLabs", () => {
  it("finds both halves of a two-colour image", () => {
    const px = makePixels(40, 40, (x) => (x < 20 ? [200, 20, 30] : [30, 60, 190]));
    const dom = dominantLabs(px, FULL, 3);
    const red = srgbToLab(200, 20, 30), blue = srgbToLab(30, 60, 190);
    expect(dom.some((d) => deltaE(d.lab, red) < 1)).toBe(true);
    expect(dom.some((d) => deltaE(d.lab, blue) < 1)).toBe(true);
    expect(dom.reduce((s, d) => s + d.share, 0)).toBeCloseTo(1, 5);
  });
  it("respects the box", () => {
    const px = makePixels(40, 40, (x) => (x < 20 ? [200, 20, 30] : [30, 60, 190]));
    const dom = dominantLabs(px, { x0: 0, y0: 0, x1: 0.4, y1: 1 }, 2);
    expect(dom[0].share).toBeCloseTo(1, 5);
    expect(deltaE(dom[0].lab, srgbToLab(200, 20, 30))).toBeLessThan(1);
  });
});

describe("colorCoverage", () => {
  const RED = srgbToLab(200, 20, 30);
  it("is ~1 when the whole box matches a target", () => {
    const px = makePixels(40, 40, () => [200, 20, 30]);
    expect(colorCoverage(px, FULL, [RED])).toBeCloseTo(1, 1);
  });
  it("is ~0.5 when half the box matches", () => {
    const px = makePixels(40, 40, (x) => (x < 20 ? [200, 20, 30] : [30, 60, 190]));
    expect(colorCoverage(px, FULL, [RED])).toBeCloseTo(0.5, 1);
  });
  it("is 0 when no pixel is near the target", () => {
    const px = makePixels(40, 40, () => [30, 60, 190]);
    expect(colorCoverage(px, FULL, [RED])).toBe(0);
  });
  it("is 0 when there are no targets", () => {
    const px = makePixels(40, 40, () => [200, 20, 30]);
    expect(colorCoverage(px, FULL, [])).toBe(0);
  });
});
