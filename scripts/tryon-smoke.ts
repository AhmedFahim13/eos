// scripts/tryon-smoke.ts — one real try-on per provider, to check the Space APIs and time a run.
// Usage: npm run tryon:smoke -- [person.jpg] [pieceId]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { idmProvider, ootdProvider } from "@/lib/tryon/hf";
import { dataUrlToBuffer, fileToDataUrl, nodeDeps } from "@/lib/tryon/node";
import { SLOT_NOUN, type Piece } from "@/lib/catalog";

const [personPath = "public/samples/model-1.jpg", pieceId] = process.argv.slice(2);
const pieces: Piece[] = JSON.parse(readFileSync("public/catalog.json", "utf8"));
const piece = pieces.find((p) => p.id === pieceId) ?? pieces.find((p) => p.slot === "kurti") ?? pieces[0];
const person = await fileToDataUrl(personPath);
const deps = nodeDeps(process.env.HF_TOKEN);
const input = { person, garment: piece.image, slot: piece.slot, description: `${piece.colors[0]?.name ?? ""} ${SLOT_NOUN[piece.slot]}`.trim() };

console.log(`Piece: ${piece.id} (${piece.slot}) ${piece.name}`);
mkdirSync("data/smoke", { recursive: true });
for (const p of [ootdProvider(deps), idmProvider(deps)]) {
  const t0 = Date.now();
  const r = await p.run(input);
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.ok) {
    writeFileSync(`data/smoke/${p.id}.png`, dataUrlToBuffer(r.image));
    console.log(`${p.id}: ok in ${s}s → data/smoke/${p.id}.png`);
  } else {
    console.log(`${p.id}: ${r.reason} in ${s}s: ${r.detail}`);
  }
}
