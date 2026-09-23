// lib/build/tagEval.ts — how often the vision tagger agrees with reference labels (data/labels/tags-gold.json).
import type { Slot } from "@/lib/catalog/slots";
import type { Occasion } from "@/lib/catalog/types";
import type { Tag } from "./tags";

export interface GoldTag { id: string; slot: Slot | "skip" | ""; primary_color: string; occasions: Occasion[] }

export interface TagScore {
  n: number;
  slotAccuracy: number;
  colorAgreement: number;
  occasionPrecision: number;
  occasionRecall: number;
  confusion: Record<string, Record<string, number>>;
}

export function scoreTags(gold: GoldTag[], pred: Record<string, Tag>): TagScore {
  const rows = gold.filter((g) => g.slot !== "" && pred[g.id]);
  let slotHits = 0, colorHits = 0, colorN = 0, occHits = 0, occPred = 0, occGold = 0;
  const confusion: Record<string, Record<string, number>> = {};
  for (const g of rows) {
    const p = pred[g.id];
    if (p.slot === g.slot) slotHits++;
    confusion[g.slot] ??= {};
    confusion[g.slot][p.slot] = (confusion[g.slot][p.slot] ?? 0) + 1;
    if (g.slot !== "skip" && g.primary_color) {
      colorN++;
      if (p.colors.includes(g.primary_color)) colorHits++;
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
    occasionPrecision: div(occHits, occPred),
    occasionRecall: div(occHits, occGold),
    confusion,
  };
}
