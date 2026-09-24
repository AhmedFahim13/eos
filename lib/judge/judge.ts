// lib/judge/judge.ts — does a try-on result show the right garment, on the same person, actually changed?
// `measure` computes raw metrics once; `decide` applies thresholds, so calibration can re-decide stored runs.
import type { Piece } from "@/lib/catalog/types";
import { colorCoverage, deltaE, hexToLab } from "./color";
import { dHash, hashSimilarity } from "./hash";
import type { Pixels } from "./pixels";
import { garmentBox, HEAD, labGrid, LOWER_LEGS } from "./regions";
import type { Slot } from "@/lib/catalog/slots";
import thresholds from "./thresholds.json";

export interface Thresholds { minCoverage: number; headSimilarity: number; minChange: number }
export const THRESHOLDS: Thresholds = thresholds;

export interface Metrics {
  colorCoverage: number;
  headSimilarity: number;
  change: number;
  /** Full-length pieces only: tagged colour share and change on the lower legs. */
  lowerCoverage?: number | null;
  lowerChange?: number;
  /** A saree covers the legs in its own colours, so only colour on the lower legs counts. */
  lowerNeedsColour?: boolean;
}

/** Pieces that must reach the lower legs: a result showing them as a top is wrong, not just imperfect. */
export const FULL_LENGTH: Slot[] = ["saree", "set3", "set2"];

export interface Verdict {
  pass: boolean;
  color: boolean;
  person: boolean;
  changed: boolean;
  /** False when a full-length piece came out stopping above the knees. */
  fullLength: boolean;
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
  if (!FULL_LENGTH.includes(piece.slot)) return { colorCoverage: coverage, headSimilarity, change };
  const la = labGrid(input, LOWER_LEGS, 8, 6), lb = labGrid(result, LOWER_LEGS, 8, 6);
  const lowerChange = la.reduce((s, l, i) => s + deltaE(l, lb[i]), 0) / la.length;
  const lowerCoverage = targets.length ? colorCoverage(result, LOWER_LEGS, targets) : null;
  return { colorCoverage: coverage, headSimilarity, change, lowerCoverage, lowerChange, lowerNeedsColour: piece.slot === "saree" && lowerCoverage !== null };
}

export function decide(m: Metrics, t: Thresholds = THRESHOLDS): Verdict {
  const color = m.colorCoverage >= t.minCoverage;
  const person = m.headSimilarity >= t.headSimilarity;
  const changed = m.change >= t.minChange;
  // Full length. A saree: its colour must show on the lower legs (legs merely changing is not enough; a
  // model that turns it into a short dress also changes them). A set: its colour shows there, or the lower
  // body clearly changed, since a set's bottom may differ in colour. Older metrics without leg data pass.
  const colourBelow = m.lowerCoverage != null && m.lowerCoverage >= t.minCoverage;
  const fullLength = m.lowerChange === undefined
    || colourBelow
    || (!m.lowerNeedsColour && m.lowerChange >= (m.lowerCoverage == null ? t.minChange : 2 * t.minChange));
  const score = Math.min(m.colorCoverage / 0.3, 1) + m.headSimilarity + Math.min(m.change / 30, 1);
  return { pass: color && person && changed && fullLength, color, person, changed, fullLength, score, metrics: m };
}

export function judge(input: Pixels, result: Pixels, piece: Pick<Piece, "slot" | "colors">, t?: Thresholds): Verdict {
  return decide(measure(input, result, piece), t);
}
