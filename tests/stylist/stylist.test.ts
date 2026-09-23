// tests/stylist/stylist.test.ts
import { describe, expect, it, vi } from "vitest";
import { candidates, ruleSuggestions } from "@/lib/stylist/rules";
import { validateSuggestions } from "@/lib/stylist/validate";
import { suggest } from "@/lib/stylist/suggest";
import { QuotaError } from "@/lib/ai/gemini";
import type { Piece } from "@/lib/catalog/types";

const mk = (id: string, over: Partial<Piece> = {}): Piece => ({
  id, slot: "saree", name: id, brand: "B", url: "u", price: 3000, image: "i",
  colors: [{ name: "red", hex: "#c0282d" }], fabric: "silk", work: "embroidery", formality: 5,
  occasions: ["wedding"], imageKind: "flat", ...over,
});

const pieces = [
  mk("wed-saree"),
  mk("eid-kurti", { slot: "kurti", formality: 4, occasions: ["eid"], price: 1800 }),
  mk("eid-set3", { slot: "set3", formality: 4, occasions: ["eid"], price: 5200 }),
  mk("home-top", { slot: "top", formality: 1, occasions: ["casual"], price: 600 }),
  mk("gold-orna", { slot: "orna", occasions: ["eid", "wedding"], colors: [{ name: "gold", hex: "#c9a646" }] }),
];

describe("candidates", () => {
  // Only two pieces suit Eid, so the list widens to all wearables, occasion matches first.
  it("ranks wearables that suit the occasion first", () => {
    expect(candidates(pieces, { occasion: "eid" }, null).map((p) => p.id)).toEqual(["eid-kurti", "eid-set3", "wed-saree", "home-top"]);
  });
  it("applies the budget", () => {
    expect(candidates(pieces, { occasion: "eid", budget: 2000 }, null).map((p) => p.id)).toEqual(["eid-kurti", "home-top"]);
  });
  it("offers extras when completing a look", () => {
    expect(candidates(pieces, { occasion: "eid" }, pieces[1]).map((p) => p.id)).toEqual(["gold-orna"]);
  });
});

describe("ruleSuggestions", () => {
  it("returns three of different types with templated reasons", () => {
    const s = ruleSuggestions(candidates(pieces, { occasion: "eid" }, null), { occasion: "eid" });
    expect(s.map((x) => x.id)).toEqual(["eid-kurti", "eid-set3", "wed-saree"]);
    expect(s[0].reason).toBe("Eid-ready silk kurti with embroidery, ৳1,800.");
  });
});

describe("validateSuggestions", () => {
  const cands = pieces.slice(1, 3);
  it("keeps only known, unique ids with reasons", () => {
    const v = validateSuggestions({ suggestions: [
      { id: "eid-kurti", reason: "Light for Eid day." },
      { id: "eid-kurti", reason: "dup" },
      { id: "made-up", reason: "x" },
      { id: "eid-set3", reason: "" },
    ] }, cands);
    expect(v).toEqual([{ id: "eid-kurti", reason: "Light for Eid day." }]);
  });
  it("returns null when nothing is valid", () => {
    expect(validateSuggestions({ nope: 1 }, cands)).toBeNull();
    expect(validateSuggestions({ suggestions: [{ id: "x", reason: "y" }] }, cands)).toBeNull();
  });
});

describe("suggest", () => {
  it("uses the model when its answer is valid", async () => {
    const gen = vi.fn().mockResolvedValue({ suggestions: [{ id: "eid-set3", reason: "Festive but not heavy." }] });
    await expect(suggest(pieces, { occasion: "eid" }, gen)).resolves.toEqual({
      source: "ai", suggestions: [{ id: "eid-set3", reason: "Festive but not heavy." }],
    });
  });
  it("falls back to rules on quota or invalid answers", async () => {
    const quota = vi.fn().mockRejectedValue(new QuotaError("q"));
    expect((await suggest(pieces, { occasion: "eid" }, quota)).source).toBe("rules");
    const junk = vi.fn().mockResolvedValue({ suggestions: [{ id: "ghost", reason: "x" }] });
    expect((await suggest(pieces, { occasion: "eid" }, junk)).source).toBe("rules");
  });
  it("completes a look from the anchor piece", async () => {
    const gen = vi.fn().mockRejectedValue(new Error("off"));
    const r = await suggest(pieces, { occasion: "eid", anchorId: "eid-kurti" }, gen);
    expect(r.suggestions.map((s) => s.id)).toEqual(["gold-orna"]);
  });
});
