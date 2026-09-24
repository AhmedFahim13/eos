// tests/tryon/fit.test.ts
import { describe, expect, it, vi } from "vitest";
import { describePiece, fitOne, type FitDeps } from "@/lib/tryon/fit";
import type { Piece } from "@/lib/catalog/types";
import type { Provider, ProviderId, TryOnResult } from "@/lib/tryon/types";
import type { Verdict } from "@/lib/judge/judge";

const piece: Piece = {
  id: "p", slot: "saree", name: "Red Saree", brand: "Kay Kraft", url: "u", price: 1, image: "https://g",
  colors: [{ name: "red", hex: "#c0282d" }], fabric: "georgette", work: "none", formality: 4,
  occasions: ["eid"], imageKind: "flat", styles: [],
};

// Plain `Omit<TryOnResult, "provider">` doesn't distribute over the union (TryOnResult's
// discriminated variants collapse to their common keys before "provider" is subtracted), so it
// drops `reason`/`detail`/`image`. This conditional type distributes over T instead (same
// pattern as tests/tryon/chain.test.ts).
type WithoutProvider<T> = T extends { provider: ProviderId } ? Omit<T, "provider"> : never;

const prov = (id: ProviderId, ...results: WithoutProvider<TryOnResult>[]): Provider => {
  const run = vi.fn();
  results.forEach((r) => run.mockResolvedValueOnce({ ...r, provider: id }));
  return { id, run };
};
const verdict = (pass: boolean, score: number, over: Partial<Verdict> = {}): Verdict => ({
  pass, color: pass, person: true, changed: true, score, metrics: { colorCoverage: 1, headSimilarity: 1, change: 10 }, ...over,
});
const deps = (ootd: Provider, idm: Provider, judge: FitDeps["judge"]): FitDeps => ({
  providers: { ootd, idm, fal: undefined }, orderFor: () => ["ootd", "idm"], judge,
});

describe("describePiece", () => {
  it("reads like a garment description", () => {
    expect(describePiece(piece)).toBe("red georgette saree");
    expect(describePiece({ ...piece, fabric: "unknown", colors: [] })).toBe("saree");
  });
});

describe("fitOne", () => {
  it("returns the first result when it passes", async () => {
    const d = deps(prov("ootd", { ok: true, image: "A" }), prov("idm"), vi.fn().mockResolvedValue(verdict(true, 3)));
    await expect(fitOne("P", piece, d)).resolves.toEqual({ kind: "ok", image: "A", provider: "ootd" });
  });
  it("retries on the next model and keeps a passing retry", async () => {
    const judge = vi.fn().mockResolvedValueOnce(verdict(false, 1)).mockResolvedValueOnce(verdict(true, 3));
    const d = deps(prov("ootd", { ok: true, image: "A" }), prov("idm", { ok: true, image: "B" }), judge);
    await expect(fitOne("P", piece, d)).resolves.toEqual({ kind: "ok", image: "B", provider: "idm" });
  });
  it("keeps the better of two failures, with a note", async () => {
    const judge = vi.fn().mockResolvedValueOnce(verdict(false, 2)).mockResolvedValueOnce(verdict(false, 1));
    const d = deps(prov("ootd", { ok: true, image: "A" }), prov("idm", { ok: true, image: "B" }), judge);
    const out = await fitOne("P", piece, d);
    expect(out).toMatchObject({ kind: "ok", image: "A" });
    expect(out.kind === "ok" && out.note).toMatch(/colours/);
  });
  it("keeps the first result with a note when no retry is possible", async () => {
    const d = deps(prov("ootd", { ok: true, image: "A" }), prov("idm", { ok: false, reason: "quota", detail: "" }), vi.fn().mockResolvedValue(verdict(false, 1)));
    const out = await fitOne("P", piece, d);
    expect(out).toMatchObject({ kind: "ok", image: "A" });
    expect(out.kind === "ok" && out.note).toBeTruthy();
  });
  it("reports quota when every model is out of GPU", async () => {
    const d = deps(prov("ootd", { ok: false, reason: "quota", detail: "" }), prov("idm", { ok: false, reason: "quota", detail: "" }), vi.fn());
    await expect(fitOne("P", piece, d)).resolves.toEqual({ kind: "quota" });
  });
  it("reports an error otherwise", async () => {
    const d = deps(prov("ootd", { ok: false, reason: "error", detail: "x" }), prov("idm", { ok: false, reason: "error", detail: "y" }), vi.fn());
    await expect(fitOne("P", piece, d)).resolves.toMatchObject({ kind: "error" });
  });
  it("treats a judge crash as a pass", async () => {
    const d = deps(prov("ootd", { ok: true, image: "A" }), prov("idm"), vi.fn().mockRejectedValue(new Error("decode")));
    await expect(fitOne("P", piece, d)).resolves.toEqual({ kind: "ok", image: "A", provider: "ootd" });
  });
});
