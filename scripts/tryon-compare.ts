// scripts/tryon-compare.ts — side-by-side of the paid models on hard pieces. Makes exactly
// (pieces × 2) paid fal calls, so run it deliberately. Usage: npm run tryon:compare -- id1 id2 ...
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import type { Piece } from "@/lib/catalog/types";
import { callFal, type FalModel } from "@/lib/tryon/falModels";
import { describePiece } from "@/lib/tryon/fit";
import { dataUrlToBuffer, fileToDataUrl } from "@/lib/tryon/node";
import { judge } from "@/lib/judge/judge";
import { loadPixelsNode } from "@/lib/judge/node";

const key = process.env.FAL_KEY;
if (!key) { console.error("FAL_KEY is not set in .env.local"); process.exit(1); }
const ids = process.argv.slice(2);
const catalog: Piece[] = JSON.parse(readFileSync("public/catalog.json", "utf8"));
const pieces = ids.map((id) => catalog.find((p) => p.id === id)).filter((p): p is Piece => Boolean(p));
if (pieces.length !== ids.length || pieces.length === 0 || pieces.length > 5) { console.error("Give 1–5 valid piece ids."); process.exit(1); }

const personFile = "public/samples/model-1.jpg";
const person = await fileToDataUrl(personFile);
const personPx = await loadPixelsNode(readFileSync(personFile));
mkdirSync("data/smoke/compare", { recursive: true });
const models: FalModel[] = ["fashn", "banana"];
const H = 420, W = 280, tiles: { input: Buffer; left: number; top: number }[] = [];

for (const [row, p] of pieces.entries()) {
  const brief = { slot: p.slot, description: describePiece(p), styles: p.styles };
  const garment = await sharp(Buffer.from(await (await fetch(p.image)).arrayBuffer())).resize({ width: W, height: H, fit: "contain", background: "#fff" }).jpeg().toBuffer();
  tiles.push({ input: garment, left: 0, top: row * H });
  for (const [col, model] of models.entries()) {
    const t0 = Date.now();
    const r = await callFal(key, model, person, p.image, brief);
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    let tile: Buffer, line: string;
    if ("image" in r) {
      const buf = dataUrlToBuffer(r.image);
      writeFileSync(`data/smoke/compare/${p.id}-${model}.jpg`, buf);
      const v = judge(personPx, await loadPixelsNode(buf), p);
      line = `${model} ${secs}s colour ${v.metrics.colorCoverage.toFixed(2)} face ${v.metrics.headSimilarity.toFixed(2)} ${v.pass ? "PASS" : "FAIL"}`;
      tile = await sharp(buf).resize({ width: W, height: H, fit: "contain", background: "#fff" }).jpeg().toBuffer();
    } else {
      line = `${model} ERROR ${r.error}`;
      tile = await sharp({ create: { width: W, height: H, channels: 3, background: "#ddd" } }).jpeg().toBuffer();
    }
    console.log(`${p.id}: ${line}`);
    const label = Buffer.from(`<svg width="${W}" height="22"><rect width="100%" height="100%" fill="#000" opacity="0.75"/><text x="5" y="15" font-size="12" fill="#fff" font-family="Arial">${line}</text></svg>`);
    tiles.push({ input: tile, left: (col + 1) * W, top: row * H }, { input: label, left: (col + 1) * W, top: row * H + H - 22 });
  }
}
await sharp({ create: { width: W * 3, height: H * pieces.length, channels: 3, background: "#fff" } }).composite(tiles).jpeg({ quality: 85 }).toFile("data/smoke/compare/sheet.jpg");
console.log("sheet: data/smoke/compare/sheet.jpg");
