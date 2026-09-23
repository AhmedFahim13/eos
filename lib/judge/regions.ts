// lib/judge/regions.ts — where to look in a standing, front-facing portrait, as fractions of the frame.
import type { Slot } from "@/lib/catalog/slots";
import { srgbToLab, type Lab } from "./color";
import type { Pixels } from "./pixels";

export interface Box { x0: number; y0: number; x1: number; y1: number }

export const HEAD: Box = { x0: 0.3, y0: 0.02, x1: 0.7, y1: 0.2 };

export function garmentBox(slot: Slot): Box {
  if (slot === "top") return { x0: 0.25, y0: 0.2, x1: 0.75, y1: 0.5 };
  if (slot === "bottom") return { x0: 0.28, y0: 0.52, x1: 0.72, y1: 0.9 };
  return { x0: 0.25, y0: 0.22, x1: 0.75, y1: 0.8 };
}

export function pixelBox(px: Pixels, box: Box) {
  const x0 = Math.floor(box.x0 * px.width), x1 = Math.max(x0 + 1, Math.floor(box.x1 * px.width));
  const y0 = Math.floor(box.y0 * px.height), y1 = Math.max(y0 + 1, Math.floor(box.y1 * px.height));
  return { x0, x1, y0, y1 };
}

/** Average RGB of each cell of a cols × rows grid laid over the box. */
function cellMeans(px: Pixels, box: Box, cols: number, rows: number): [number, number, number][] {
  const b = pixelBox(px, box);
  const out: [number, number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx0 = b.x0 + Math.floor((c * (b.x1 - b.x0)) / cols), cx1 = Math.max(cx0 + 1, b.x0 + Math.floor(((c + 1) * (b.x1 - b.x0)) / cols));
      const cy0 = b.y0 + Math.floor((r * (b.y1 - b.y0)) / rows), cy1 = Math.max(cy0 + 1, b.y0 + Math.floor(((r + 1) * (b.y1 - b.y0)) / rows));
      let R = 0, G = 0, B = 0, n = 0;
      for (let y = cy0; y < cy1; y++) {
        for (let x = cx0; x < cx1; x++) {
          const i = (y * px.width + x) * 4;
          R += px.data[i]; G += px.data[i + 1]; B += px.data[i + 2]; n++;
        }
      }
      out.push([R / n, G / n, B / n]);
    }
  }
  return out;
}

export function labGrid(px: Pixels, box: Box, cols: number, rows: number): Lab[] {
  return cellMeans(px, box, cols, rows).map(([r, g, b]) => srgbToLab(r, g, b));
}

export function grayGrid(px: Pixels, box: Box, cols: number, rows: number): number[] {
  return cellMeans(px, box, cols, rows).map(([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b);
}
