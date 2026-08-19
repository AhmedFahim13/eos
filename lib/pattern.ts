// lib/pattern.ts — procedural fabric prints painted to a CanvasTexture.
import * as THREE from "three";

export type PatternType = "solid" | "stripes" | "dots" | "check" | "plaid" | "floral";

export interface PatternSpec {
  type: PatternType;
  color: string; // motif color (base color comes from the garment)
  scale: number; // repeat count (1..8)
}

export const PATTERNS: { type: PatternType; label: string }[] = [
  { type: "solid", label: "Solid" },
  { type: "stripes", label: "Stripes" },
  { type: "dots", label: "Dots" },
  { type: "check", label: "Check" },
  { type: "plaid", label: "Plaid" },
  { type: "floral", label: "Floral" },
];

export const DEFAULT_PATTERN: PatternSpec = { type: "solid", color: "#1f2733", scale: 3 };

const flower = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.4, r * 0.22, a, 0, Math.PI * 2);
    ctx.fill();
  }
};

// Draw a seamless 128px tile of `type` in `motif` over `base`.
export function makePatternTexture(type: PatternType, base: string, motif: string, scale: number): THREE.CanvasTexture {
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = motif;
  ctx.strokeStyle = motif;

  switch (type) {
    case "stripes":
      ctx.fillRect(0, 0, S / 2, S);
      break;
    case "dots":
      for (const [x, y] of [[S / 4, S / 4], [(3 * S) / 4, (3 * S) / 4]] as const) {
        ctx.beginPath();
        ctx.arc(x, y, S * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "check":
      ctx.fillRect(0, 0, S / 2, S / 2);
      ctx.fillRect(S / 2, S / 2, S / 2, S / 2);
      break;
    case "plaid":
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = S * 0.14;
      ctx.beginPath(); ctx.moveTo(S / 4, 0); ctx.lineTo(S / 4, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, S / 4); ctx.lineTo(S, S / 4); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    case "floral":
      flower(ctx, S * 0.3, S * 0.3, S * 0.16);
      flower(ctx, S * 0.75, S * 0.75, S * 0.16);
      break;
    default:
      break; // solid handled by caller (no map)
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(scale, scale);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
