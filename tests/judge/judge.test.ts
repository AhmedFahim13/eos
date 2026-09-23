// tests/judge/judge.test.ts
import { describe, expect, it } from "vitest";
import { dHash, hashSimilarity } from "@/lib/judge/hash";
import { decide, judge, measure } from "@/lib/judge/judge";
import { HEAD } from "@/lib/judge/regions";
import { makePixels } from "../helpers/pixels";

const W = 90, H = 120;
const RED = [192, 40, 45] as [number, number, number];
const piece = { slot: "saree" as const, colors: [{ name: "red", hex: "#c0282d" }] };

// The "face" is a horizontal skin-tone gradient: falling left to right for one person, rising for another.
// dHash compares neighbouring cells, so the two give opposite bits everywhere.
const shade = (s: number): [number, number, number] => [s, Math.round(s * 0.8), Math.round(s * 0.7)];
const falling = (x: number) => 250 - (x - 27) * 6;
const rising = (x: number) => 40 + (x - 27) * 6;

const person = (torso: [number, number, number], face: (x: number) => number = falling) =>
  makePixels(W, H, (x, y) => {
    if (y < 0.2 * H && x > 0.3 * W && x < 0.7 * W) return shade(face(x));
    if (y > 0.22 * H && y < 0.8 * H && x > 0.25 * W && x < 0.75 * W) return torso;
    return [150, 150, 150];
  });

describe("hash", () => {
  it("is identical for identical regions and low for a changed one", () => {
    const a = person([255, 255, 255]);
    expect(hashSimilarity(dHash(a, HEAD), dHash(a, HEAD))).toBe(1);
    const b = person([255, 255, 255], rising);
    expect(hashSimilarity(dHash(a, HEAD), dHash(b, HEAD))).toBeLessThan(0.75);
  });
});

describe("judge", () => {
  const input = person([245, 245, 245]);
  it("passes a result that keeps the face and shows the garment colour", () => {
    const v = judge(input, person(RED), piece);
    expect(v).toMatchObject({ pass: true, color: true, person: true, changed: true });
  });
  it("fails colour when the garment came out blue", () => {
    const v = judge(input, person([40, 70, 190]), piece);
    expect(v.color).toBe(false);
    expect(v.pass).toBe(false);
  });
  it("fails 'changed' when the model returned the input", () => {
    const v = judge(input, input, { ...piece, colors: [{ name: "white", hex: "#f5f5f0" }] });
    expect(v.changed).toBe(false);
  });
  it("fails 'person' when the face changed", () => {
    const v = judge(input, person(RED, rising), piece);
    expect(v.person).toBe(false);
  });
  it("decide applies thresholds to stored metrics and scores higher for better results", () => {
    const good = measure(input, person(RED), piece);
    const bad = measure(input, person([40, 70, 190]), piece);
    expect(decide(good).score).toBeGreaterThan(decide(bad).score);
    expect(decide(bad, { colorDeltaE: 200, headSimilarity: 0, minChange: 0 }).pass).toBe(true);
  });
});
