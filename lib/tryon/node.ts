// lib/tryon/node.ts — image loading for the benchmark and smoke test (Node only).
import { readFileSync } from "node:fs";
import sharp from "sharp";
import type { HfDeps } from "./hf";

const UA = "EosBench/1.0 (+https://github.com/AhmedFahim13/eos)";

export async function fileToDataUrl(path: string, max = 1024): Promise<string> {
  const buf = await sharp(readFileSync(path)).rotate().resize({ width: max, height: max, fit: "inside" }).jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

export function nodeDeps(hfToken?: string): HfDeps {
  return {
    hfToken,
    async loadImage(src) {
      const res = await fetch(src, { headers: src.startsWith("data:") ? {} : { "User-Agent": UA } });
      if (!res.ok) throw new Error(`image ${res.status} ${src.slice(0, 80)}`);
      return res.blob();
    },
    async fetchResult(url) {
      const res = await fetch(url, { headers: hfToken ? { Authorization: `Bearer ${hfToken}` } : {} });
      if (!res.ok) throw new Error(`result ${res.status}`);
      const ct = res.headers.get("content-type")?.startsWith("image/") ? res.headers.get("content-type")! : "image/png";
      return `data:${ct};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    },
  };
}
