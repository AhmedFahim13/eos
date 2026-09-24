// tests/build/tagEval.test.ts
import { describe, expect, it } from "vitest";
import { scoreTags, type GoldTag } from "@/lib/build/tagEval";
import type { Tag } from "@/lib/build/tags";

const tag = (over: Partial<Tag>): Tag => ({
  slot: "saree", colors: ["red"], fabric: "cotton", work: "none", formality: 3,
  occasions: ["eid"], tryon_image: 0, image_kind: "flat", tryon_ok: true, ...over,
});

describe("scoreTags", () => {
  it("scores slot, primary colour and occasions, ignoring unlabelled rows", () => {
    const gold: GoldTag[] = [
      { id: "a", slot: "saree", primary_color: "red", occasions: ["eid", "wedding"] },
      { id: "b", slot: "kurti", primary_color: "blue", occasions: ["office"] },
      { id: "c", slot: "", primary_color: "", occasions: [] },
    ];
    const pred = {
      a: tag({}),
      b: tag({ slot: "top", colors: ["green", "blue"], occasions: ["office", "casual"] }),
      c: tag({}),
    };
    const s = scoreTags(gold, pred);
    expect(s.n).toBe(2);
    expect(s.slotAccuracy).toBe(0.5);
    expect(s.colorAgreement).toBe(1);
    expect(s.colorFamilyAgreement).toBe(1);
    expect(s.occasionPrecision).toBeCloseTo(2 / 3);
    expect(s.occasionRecall).toBeCloseTo(2 / 3);
    expect(s.confusion.kurti.top).toBe(1);
  });
});
