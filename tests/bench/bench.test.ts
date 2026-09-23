// tests/bench/bench.test.ts
import { describe, expect, it } from "vitest";
import { selectBenchPieces, planRuns, benchReady } from "@/lib/bench/select";
import { aggregate, type BenchRow } from "@/lib/bench/aggregate";
import { agreement, searchThresholds } from "@/lib/bench/agreement";
import type { Piece } from "@/lib/catalog/types";
import type { Slot } from "@/lib/catalog/slots";

const mk = (id: string, slot: Slot): Piece => ({
  id, slot, name: id, brand: "B", url: "u", price: 1, image: "i", colors: [{ name: "red", hex: "#c0282d" }],
  fabric: "cotton", work: "none", formality: 3, occasions: [], imageKind: "flat",
});

describe("selectBenchPieces", () => {
  const pieces = ["saree", "set3", "set2", "kurti", "top", "bottom", "orna"].flatMap((s) =>
    [1, 2, 3].map((i) => mk(`${s}-${i}`, s as Slot)));
  it("takes two per wearable slot, deterministically, no extras", () => {
    const a = selectBenchPieces(pieces, 2);
    expect(a).toHaveLength(12);
    expect(a.some((p) => p.slot === "orna")).toBe(false);
    expect(selectBenchPieces([...pieces].reverse(), 2).map((p) => p.id).sort()).toEqual(a.map((p) => p.id).sort());
  });
  it("plans person × piece × provider, bottoms on one model", () => {
    const sel = selectBenchPieces(pieces, 2);
    const runs = planRuns(["p01", "p02"], sel);
    expect(runs).toHaveLength(2 * (10 * 2 + 2 * 1));
    expect(runs[0]).toEqual({ key: expect.stringContaining("p01|"), person: "p01", piece: expect.any(String), provider: expect.any(String) });
  });
});

describe("benchReady", () => {
  const pieces = ["saree", "set3", "set2", "kurti", "top", "bottom", "orna"].flatMap((s) =>
    [1, 2, 3].map((i) => mk(`${s}-${i}`, s as Slot)));
  it("is true when every wearable slot has 2 pieces", () => {
    expect(benchReady(selectBenchPieces(pieces, 2))).toBe(true);
  });
  it("is false when a slot is missing", () => {
    const missingBottom = pieces.filter((p) => p.slot !== "bottom");
    expect(benchReady(selectBenchPieces(missingBottom, 2))).toBe(false);
  });
  it("is false when empty", () => {
    expect(benchReady([])).toBe(false);
  });
});

const row = (provider: "ootd" | "idm", slot: Slot, ok: boolean, colorCoverage = 0.5): BenchRow => ({
  key: Math.random().toString(), person: "p", piece: "x", slot, provider, ok, seconds: 1,
  ...(ok ? { metrics: { colorCoverage, headSimilarity: 0.9, change: 20 }, image: "/i.jpg" } : { reason: "error", detail: "d" }),
});

describe("aggregate", () => {
  it("counts generation and pass rates per provider and slot", () => {
    const t = aggregate([row("ootd", "saree", true), row("ootd", "saree", true, 0.02), row("ootd", "saree", false), row("idm", "top", true)]);
    const s = t.find((x) => x.provider === "ootd" && x.slot === "saree")!;
    expect(s).toMatchObject({ attempts: 3, generated: 2, passed: 1 });
    expect(s.passRate).toBeCloseTo(0.5);
    expect(s.generationRate).toBeCloseTo(2 / 3);
  });
});

describe("agreement", () => {
  const labelled = [
    { metrics: { colorCoverage: 0.5, headSimilarity: 0.9, change: 20 }, good: true },
    { metrics: { colorCoverage: 0.02, headSimilarity: 0.9, change: 20 }, good: false },
    { metrics: { colorCoverage: 0.05, headSimilarity: 0.9, change: 20 }, good: true },
  ];
  it("measures how often the judge matches people", () => {
    expect(agreement(labelled, { minCoverage: 0.1, headSimilarity: 0.75, minChange: 8 })).toBeCloseTo(2 / 3);
  });
  it("finds thresholds that agree better", () => {
    const t = searchThresholds(labelled);
    expect(agreement(labelled, t)).toBe(1);
  });
});
