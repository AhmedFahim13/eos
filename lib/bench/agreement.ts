// lib/bench/agreement.ts — does the judge agree with a person, and which thresholds agree best.
import { decide, THRESHOLDS, type Metrics, type Thresholds } from "@/lib/judge/judge";

export interface Labelled { metrics: Metrics; good: boolean }

export function agreement(rows: Labelled[], t: Thresholds): number {
  if (rows.length === 0) return 0;
  return rows.filter((r) => decide(r.metrics, t).pass === r.good).length / rows.length;
}

export function searchThresholds(rows: Labelled[]): Thresholds {
  let best = THRESHOLDS, bestA = -1;
  for (let c = 10; c <= 40; c += 2) {
    for (let h = 50; h <= 95; h += 5) {
      for (let m = 0; m <= 20; m += 2) {
        const t = { colorDeltaE: c, headSimilarity: h / 100, minChange: m };
        const a = agreement(rows, t);
        if (a > bestA) { best = t; bestA = a; }
      }
    }
  }
  return best;
}
