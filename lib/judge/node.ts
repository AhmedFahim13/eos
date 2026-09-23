// lib/judge/node.ts — decode an image into Pixels with sharp (Node only).
import sharp from "sharp";
import type { Pixels } from "./pixels";

export async function loadPixelsNode(input: Buffer | string, max = 384): Promise<Pixels> {
  const { data, info } = await sharp(input).rotate().resize({ width: max, height: max, fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}
