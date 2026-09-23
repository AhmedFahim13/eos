// lib/judge/judge.ts — does a try-on result show the right garment, on the same person, actually changed?
// `measure` computes raw metrics once; `decide` applies thresholds, so calibration can re-decide stored runs.
import type { Piece } from "@/lib/catalog/types";
import { deltaE, dominantLabs, hexToLab } from "./color";
import { dHash, hashSimilarity } from "./hash";
import type { Pixels } from "./pixels";
import { garmentBox, HEAD, labGrid } from "./regions";
import thresholds from "./thresholds.json";

export interface Thresholds { colorDeltaE: number; headSimilarity: number; minChange: number }
export const THRESHOLDS: Thresholds = thresholds;

export interface Metrics { colorDeltaE: number; headSimilarity: number; change: number }

export interface Verdict {
  pass: boolean;
  color: boolean;
  person: boolean;
  changed: boolean;
  score: number;
  metrics: Metrics;
}

export function measure(input: Pixels, result: Pixels, piece: Pick<Piece, "slot" | "colors">): Metrics {
  const box = garmentBox(piece.slot);
  const targets = piece.colors.length ? piece.colors.map((c) => hexToLab(c.hex)) : [hexToLab("#808080")];
  const dom = dominantLabs(result, box, 3).filter((c) => c.share >= 0.15);
  const colorDeltaE = dom.length ? Math.min(...dom.flatMap((c) => targets.map((t) => deltaE(c.lab, t)))) : 100;
  const headSimilarity = hashSimilarity(dHash(input, HEAD), dHash(result, HEAD));
  const a = labGrid(input, box, 16, 20), b = labGrid(result, box, 16, 20);
  const change = a.reduce((s, l, i) => s + deltaE(l, b[i]), 0) / a.length;
  return { colorDeltaE, headSimilarity, change };
}

export function decide(m: Metrics, t: Thresholds = THRESHOLDS): Verdict {
  const color = m.colorDeltaE <= t.colorDeltaE;
  const person = m.headSimilarity >= t.headSimilarity;
  const changed = m.change >= t.minChange;
  const score = (1 - Math.min(m.colorDeltaE / 60, 1)) + m.headSimilarity + Math.min(m.change / 30, 1);
  return { pass: color && person && changed, color, person, changed, score, metrics: m };
}

export function judge(input: Pixels, result: Pixels, piece: Pick<Piece, "slot" | "colors">, t?: Thresholds): Verdict {
  return decide(measure(input, result, piece), t);
}
