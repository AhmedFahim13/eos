// lib/judge/judge.ts — does a try-on result show the right garment, on the same person, actually changed?
// `measure` computes raw metrics once; `decide` applies thresholds, so calibration can re-decide stored runs.
import type { Piece } from "@/lib/catalog/types";
import { colorCoverage, deltaE, hexToLab } from "./color";
import { dHash, hashSimilarity } from "./hash";
import type { Pixels } from "./pixels";
import { garmentBox, HEAD, labGrid } from "./regions";
import thresholds from "./thresholds.json";

export interface Thresholds { minCoverage: number; headSimilarity: number; minChange: number }
export const THRESHOLDS: Thresholds = thresholds;

export interface Metrics { colorCoverage: number; headSimilarity: number; change: number }

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
  const targets = piece.colors.map((c) => hexToLab(c.hex));
  // A piece with no tagged colours (the archive) cannot be colour-checked, so it passes that check.
  const coverage = targets.length ? colorCoverage(result, box, targets) : 1;
  const headSimilarity = hashSimilarity(dHash(input, HEAD), dHash(result, HEAD));
  const a = labGrid(input, box, 16, 20), b = labGrid(result, box, 16, 20);
  const change = a.reduce((s, l, i) => s + deltaE(l, b[i]), 0) / a.length;
  return { colorCoverage: coverage, headSimilarity, change };
}

export function decide(m: Metrics, t: Thresholds = THRESHOLDS): Verdict {
  const color = m.colorCoverage >= t.minCoverage;
  const person = m.headSimilarity >= t.headSimilarity;
  const changed = m.change >= t.minChange;
  const score = Math.min(m.colorCoverage / 0.3, 1) + m.headSimilarity + Math.min(m.change / 30, 1);
  return { pass: color && person && changed, color, person, changed, score, metrics: m };
}

export function judge(input: Pixels, result: Pixels, piece: Pick<Piece, "slot" | "colors">, t?: Thresholds): Verdict {
  return decide(measure(input, result, piece), t);
}
