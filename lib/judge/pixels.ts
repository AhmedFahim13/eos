// lib/judge/pixels.ts — decoded RGBA pixels, the same in the browser (canvas) and Node (sharp).
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}
