// lib/judge/hash.ts — difference hash of a region: a cheap "is this still the same face" check.
import type { Pixels } from "./pixels";
import { grayGrid, type Box } from "./regions";

export function dHash(px: Pixels, box: Box): boolean[] {
  const g = grayGrid(px, box, 9, 8);
  const bits: boolean[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) bits.push(g[r * 9 + c] > g[r * 9 + c + 1]);
  return bits;
}

export function hashSimilarity(a: boolean[], b: boolean[]): number {
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same / a.length;
}
