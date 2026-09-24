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

// A result where the garment covers only chest to hips (y 0.22–0.5): what an upper-body model makes of a saree.
const topOnly = (torso: [number, number, number]) =>
  makePixels(W, H, (x, y) => {
    if (y < 0.2 * H && x > 0.3 * W && x < 0.7 * W) return shade(falling(x));
    if (y > 0.22 * H && y < 0.5 * H && x > 0.25 * W && x < 0.75 * W) return torso;
    return [150, 150, 150];
  });

describe("full length", () => {
  const input = makePixels(W, H, (x, y) => (y < 0.2 * H && x > 0.3 * W && x < 0.7 * W ? shade(falling(x)) : [150, 150, 150]));
  it("passes a saree that reaches the legs", () => {
    expect(judge(input, person(RED), piece).fullLength).toBe(true);
  });
  it("fails a saree that came out as a top", () => {
    const v = judge(input, topOnly(RED), piece);
    expect(v.fullLength).toBe(false);
    expect(v.pass).toBe(false);
  });
  it("fails a saree whose legs changed but show none of its colour (turned into a short dress)", () => {
    const shortDress = makePixels(W, H, (x, y) => {
      if (y < 0.2 * H && x > 0.3 * W && x < 0.7 * W) return shade(falling(x));
      if (y > 0.22 * H && y < 0.5 * H && x > 0.25 * W && x < 0.75 * W) return RED;
      if (y >= 0.5 * H) return [205, 160, 130];
      return [150, 150, 150];
    });
    expect(judge(input, shortDress, piece).fullLength).toBe(false);
  });
  it("lets a set pass on a clearly changed bottom of another colour", () => {
    const setPiece = { slot: "set2" as const, colors: [{ name: "red", hex: "#c0282d" }] };
    const redTopWhiteBottom = makePixels(W, H, (x, y) => {
      if (y < 0.2 * H && x > 0.3 * W && x < 0.7 * W) return shade(falling(x));
      if (y > 0.22 * H && y < 0.5 * H && x > 0.25 * W && x < 0.75 * W) return RED;
      if (y >= 0.5 * H && x > 0.3 * W && x < 0.7 * W) return [250, 250, 250];
      return [150, 150, 150];
    });
    expect(judge(input, redTopWhiteBottom, setPiece).fullLength).toBe(true);
  });
  it("does not apply to tops or kurtis", () => {
    expect(judge(input, topOnly(RED), { slot: "top", colors: piece.colors }).fullLength).toBe(true);
  });
  it("leaves older metrics without leg data undecided on it", () => {
    expect(decide({ colorCoverage: 1, headSimilarity: 1, change: 20 }).fullLength).toBe(true);
  });
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
  it("skips the colour check for a piece with no tagged colours", () => {
    const v = judge(input, person([40, 70, 190]), { slot: "saree", colors: [] });
    expect(v.color).toBe(true);
  });
  it("fails 'changed' when the model returned the input", () => {
    const v = judge(input, input, { ...piece, colors: [{ name: "white", hex: "#f5f5f0" }] });
    expect(v.changed).toBe(false);
  });
  it("fails 'person' when the face changed", () => {
    const v = judge(input, person(RED, rising), piece);
    expect(v.person).toBe(false);
  });
  it("passes when the garment matches a non-first tagged colour", () => {
    const twoTone = { slot: "saree" as const, colors: [{ name: "blue", hex: "#2f5fb3" }, { name: "red", hex: "#c0282d" }] };
    const v = judge(input, person(RED), twoTone);
    expect(v).toMatchObject({ pass: true, color: true });
  });
  it("decide applies thresholds to stored metrics and scores higher for better results", () => {
    const good = measure(input, person(RED), piece);
    const bad = measure(input, person([40, 70, 190]), piece);
    expect(decide(good).score).toBeGreaterThan(decide(bad).score);
    expect(decide(bad, { minCoverage: 0, headSimilarity: 0, minChange: 0 }).pass).toBe(true);
  });
});

describe("judge on a kurti rendered hip-length", () => {
  // garmentBox("kurti") is the upper box (y 0.2-0.5); the model renders the kurti only
  // down to hip length and puts something else below, which the old full-length box would see.
  const kurtiPiece = { slot: "kurti" as const, colors: [{ name: "red", hex: "#c0282d" }] };
  const hipLengthKurti = (torso: [number, number, number], below: [number, number, number]) =>
    makePixels(W, H, (x, y) => {
      if (y < 0.2 * H && x > 0.3 * W && x < 0.7 * W) return shade(falling(x));
      if (y >= 0.2 * H && y < 0.5 * H && x > 0.25 * W && x < 0.75 * W) return torso;
      if (y >= 0.5 * H && y < 0.8 * H && x > 0.25 * W && x < 0.75 * W) return below;
      return [150, 150, 150];
    });
  const input = person([245, 245, 245]);
  it("passes colour when the tagged colour only fills the upper (hip-length) box", () => {
    const v = judge(input, hipLengthKurti(RED, [30, 60, 190]), kurtiPiece);
    expect(v.color).toBe(true);
  });
});
