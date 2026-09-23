// lib/judge/color.ts — sRGB → CIELAB, colour distance, and the dominant colours of a region.
import type { Pixels } from "./pixels";
import { pixelBox, type Box } from "./regions";

export type Lab = [number, number, number];

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);

export function srgbToLab(r: number, g: number, b: number): Lab {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 distance. About 2 is barely visible; above 20 is clearly a different colour. */
export const deltaE = (a: Lab, b: Lab): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function hexToLab(hex: string): Lab {
  const n = parseInt(hex.replace("#", ""), 16);
  return srgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

function sampleLabs(px: Pixels, box: Box, maxSamples = 2000): Lab[] {
  const b = pixelBox(px, box);
  const area = (b.x1 - b.x0) * (b.y1 - b.y0);
  const step = Math.max(1, Math.floor(Math.sqrt(area / maxSamples)));
  const out: Lab[] = [];
  for (let y = b.y0; y < b.y1; y += step) {
    for (let x = b.x0; x < b.x1; x += step) {
      const i = (y * px.width + x) * 4;
      out.push(srgbToLab(px.data[i], px.data[i + 1], px.data[i + 2]));
    }
  }
  return out;
}

/** k-means in Lab with a deterministic start (lightness quantiles); largest cluster first. */
export function dominantLabs(px: Pixels, box: Box, k = 3, iters = 8): { lab: Lab; share: number }[] {
  const pts = sampleLabs(px, box);
  if (pts.length === 0) return [];
  const sorted = [...pts].sort((a, b) => a[0] - b[0]);
  let centers: Lab[] = Array.from({ length: k }, (_, i) => sorted[Math.min(sorted.length - 1, Math.floor(((i + 0.5) * sorted.length) / k))]);
  let assign: number[] = [];
  for (let it = 0; it < iters; it++) {
    assign = pts.map((p) => {
      let best = 0, bd = Infinity;
      centers.forEach((c, j) => { const d = deltaE(p, c); if (d < bd) { bd = d; best = j; } });
      return best;
    });
    centers = centers.map((c, j) => {
      let L = 0, A = 0, B = 0, n = 0;
      pts.forEach((p, i) => { if (assign[i] === j) { L += p[0]; A += p[1]; B += p[2]; n++; } });
      return n ? ([L / n, A / n, B / n] as Lab) : c;
    });
  }
  const counts = centers.map((_, j) => assign.filter((a) => a === j).length);
  return centers
    .map((lab, j) => ({ lab, share: counts[j] / pts.length }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
}
