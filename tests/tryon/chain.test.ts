// tests/tryon/chain.test.ts
import { describe, expect, it, vi } from "vitest";
import { providerOrder, runChain, outOfCapacity } from "@/lib/tryon/chain";
import type { Provider, ProviderId, TryOnInput, TryOnResult } from "@/lib/tryon/types";

const input: TryOnInput = { person: "data:image/jpeg;base64,x", garment: "https://g", slot: "saree", description: "red saree" };
const fake = (id: ProviderId, r: Omit<TryOnResult, "provider">): Provider => ({
  id, run: vi.fn().mockResolvedValue({ ...r, provider: id } as TryOnResult),
});

describe("providerOrder", () => {
  it("full-length pieces start with OOTDiffusion", () => {
    expect(providerOrder("saree", false)).toEqual(["ootd", "idm"]);
    expect(providerOrder("kurti", true)).toEqual(["ootd", "idm", "fal"]);
  });
  it("tops start with IDM-VTON, bottoms only use OOTDiffusion", () => {
    expect(providerOrder("top", false)).toEqual(["idm", "ootd"]);
    expect(providerOrder("bottom", false)).toEqual(["ootd"]);
  });
});

describe("runChain", () => {
  it("stops at the first success", async () => {
    const a = fake("ootd", { ok: false, reason: "quota", detail: "q" });
    const b = fake("idm", { ok: true, image: "data:img" });
    const c = fake("fal", { ok: true, image: "data:other" });
    const { result, tried } = await runChain(input, { ootd: a, idm: b, fal: c }, ["ootd", "idm", "fal"]);
    expect(result).toMatchObject({ ok: true, provider: "idm" });
    expect(tried.map((t) => t.provider)).toEqual(["ootd", "idm"]);
    expect(c.run).not.toHaveBeenCalled();
  });
  it("skips excluded and missing providers", async () => {
    const b = fake("idm", { ok: true, image: "data:img" });
    const { result } = await runChain(input, { ootd: undefined, idm: b, fal: undefined }, ["ootd", "idm"], ["ootd"]);
    expect(result.provider).toBe("idm");
  });
  it("reports unavailable when nothing ran", async () => {
    const { result, tried } = await runChain(input, { ootd: undefined, idm: undefined, fal: undefined }, ["ootd"]);
    expect(result).toMatchObject({ ok: false, reason: "unavailable" });
    expect(tried).toEqual([]);
  });
});

describe("outOfCapacity", () => {
  it("is true when every failure is quota or unavailable and one is quota", () => {
    expect(outOfCapacity([
      { ok: false, provider: "ootd", reason: "quota", detail: "" },
      { ok: false, provider: "idm", reason: "unavailable", detail: "" },
    ])).toBe(true);
  });
  it("is false for real errors or no quota at all", () => {
    expect(outOfCapacity([{ ok: false, provider: "ootd", reason: "error", detail: "" }])).toBe(false);
    expect(outOfCapacity([{ ok: false, provider: "ootd", reason: "unavailable", detail: "" }])).toBe(false);
    expect(outOfCapacity([])).toBe(false);
  });
});
