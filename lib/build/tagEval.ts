// lib/build/tagEval.ts — how often the vision tagger agrees with reference labels (data/labels/tags-gold.json).
import type { Slot } from "@/lib/catalog/slots";
import type { Occasion } from "@/lib/catalog/types";
import type { Tag } from "./tags";

export interface GoldTag { id: string; slot: Slot | "skip" | ""; primary_color: string; occasions: Occasion[] }

/** Shades a shopper would call the same colour; names inside one family are a matter of taste. */
export const COLOR_FAMILY: Record<string, string> = Object.fromEntries(Object.entries({
  light: ["white", "ivory", "cream", "beige"], yellow: ["yellow", "mustard", "gold"], orange: ["orange", "peach", "coral"],
  red: ["red", "maroon"], pink: ["pink", "magenta"], purple: ["purple", "lavender"], blue: ["blue", "navy", "sky"],
  green: ["green", "olive", "mint", "teal"], brown: ["brown"], grey: ["grey", "silver"], black: ["black"],
}).flatMap(([family, names]) => names.map((n) => [n, family])));

export interface TagScore {
  n: number;
  slotAccuracy: number;
  /** Exact shade name: the reference colour is among the tagged colours. */
  colorAgreement: number;
  /** Same colour family: a tagged colour is in the reference colour's family. */
  colorFamilyAgreement: number;
  occasionPrecision: number;
  occasionRecall: number;
  confusion: Record<string, Record<string, number>>;
}

export function scoreTags(gold: GoldTag[], pred: Record<string, Tag>): TagScore {
  const rows = gold.filter((g) => g.slot !== "" && pred[g.id]);
  let slotHits = 0, colorHits = 0, familyHits = 0, colorN = 0, occHits = 0, occPred = 0, occGold = 0;
  const confusion: Record<string, Record<string, number>> = {};
  for (const g of rows) {
    const p = pred[g.id];
    if (p.slot === g.slot) slotHits++;
    confusion[g.slot] ??= {};
    confusion[g.slot][p.slot] = (confusion[g.slot][p.slot] ?? 0) + 1;
    if (g.slot !== "skip" && g.primary_color) {
      colorN++;
      if (p.colors.includes(g.primary_color)) colorHits++;
      if (p.colors.some((c) => COLOR_FAMILY[c] === COLOR_FAMILY[g.primary_color])) familyHits++;
    }
    occHits += p.occasions.filter((o) => g.occasions.includes(o)).length;
    occPred += p.occasions.length;
    occGold += g.occasions.length;
  }
  const div = (a: number, b: number) => (b ? a / b : 0);
  return {
    n: rows.length,
    slotAccuracy: div(slotHits, rows.length),
    colorAgreement: div(colorHits, colorN),
    colorFamilyAgreement: div(familyHits, colorN),
    occasionPrecision: div(occHits, occPred),
    occasionRecall: div(occHits, occGold),
    confusion,
  };
}
