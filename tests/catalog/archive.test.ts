// tests/catalog/archive.test.ts
import { describe, expect, it } from "vitest";
import { toArchivePiece } from "@/lib/catalog/archive";

const base = { id: "uq-1", name: "AIRism Dress", brand: "Uniqlo", image: "https://img/1.jpg" };

describe("toArchivePiece", () => {
  it("maps western slots onto the current ones", () => {
    expect(toArchivePiece({ ...base, slot: "dress" })?.slot).toBe("set2");
    expect(toArchivePiece({ ...base, slot: "outer" })?.slot).toBe("top");
    expect(toArchivePiece({ ...base, slot: "shoes" })?.slot).toBe("accessory");
  });
  it("prefixes ids so they never collide with the live catalogue, and carries no colours", () => {
    const p = toArchivePiece({ ...base, slot: "top" })!;
    expect(p.id).toBe("archive-uq-1");
    expect(p.colors).toEqual([]);
  });
  it("drops unknown slots and pieces without an image", () => {
    expect(toArchivePiece({ ...base, slot: "hat" })).toBeNull();
    expect(toArchivePiece({ ...base, slot: "top", image: "" })).toBeNull();
  });
});
