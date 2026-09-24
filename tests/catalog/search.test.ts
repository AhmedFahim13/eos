// tests/catalog/search.test.ts
import { describe, expect, it } from "vitest";
import { searchPieces, type Piece } from "@/lib/catalog";

const piece = (over: Partial<Piece>): Piece => ({
  id: "a", slot: "saree", name: "Cotton Saree", brand: "Kay Kraft", url: "u", price: 4500, image: "i",
  colors: [{ name: "magenta", hex: "#b8246f" }], fabric: "cotton", work: "print", formality: 3,
  occasions: ["eid"], imageKind: "flat", styles: [], ...over,
});

describe("searchPieces", () => {
  const all = [piece({}), piece({ id: "b", name: "Georgette Kurti", slot: "kurti", brand: "Yellow" })];
  it("filters by slot", () => {
    expect(searchPieces(all, "kurti", "").map((p) => p.id)).toEqual(["b"]);
  });
  it("matches name, brand or colour", () => {
    expect(searchPieces(all, "saree", "kay").map((p) => p.id)).toEqual(["a"]);
    expect(searchPieces(all, "saree", "magenta").map((p) => p.id)).toEqual(["a"]);
    expect(searchPieces(all, "saree", "silk")).toEqual([]);
  });
});
