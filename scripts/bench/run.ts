// scripts/bench/run.ts — resumable benchmark: up to BENCH_MAX_RUNS try-ons per invocation, stops on quota.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import type { Piece } from "@/lib/catalog/types";
import { planRuns, selectBenchPieces } from "@/lib/bench/select";
import type { BenchRow } from "@/lib/bench/aggregate";
import { decide, measure } from "@/lib/judge/judge";
import { loadPixelsNode } from "@/lib/judge/node";
import { describePiece } from "@/lib/tryon/fit";
import { idmProvider, ootdProvider } from "@/lib/tryon/hf";
import { dataUrlToBuffer, fileToDataUrl, nodeDeps } from "@/lib/tryon/node";

const PEOPLE = "data/bench/people.json";
const PIECES = "data/bench/pieces.json";
const RUNS = "data/bench/runs.json";
const IMG_DIR = "public/bench/img";
const GALLERY = "public/bench/gallery.json";
const MAX = Number(process.env.BENCH_MAX_RUNS ?? 12);

const people: { id: string; file: string; license: string; credit: string }[] = JSON.parse(readFileSync(PEOPLE, "utf8"));
if (people.some((p) => /REPLACE/.test(JSON.stringify(p)) || !existsSync(p.file))) {
  console.log("::notice::Benchmark waiting for photos in data/bench/people.json");
  process.exit(0);
}

if (!existsSync(PIECES)) {
  const catalog: Piece[] = JSON.parse(readFileSync("public/catalog.json", "utf8"));
  writeFileSync(PIECES, JSON.stringify(selectBenchPieces(catalog, 2), null, 2));
}
const pieces: Piece[] = JSON.parse(readFileSync(PIECES, "utf8"));
const byId = Object.fromEntries(pieces.map((p) => [p.id, p]));
const rows: BenchRow[] = existsSync(RUNS) ? JSON.parse(readFileSync(RUNS, "utf8")) : [];
const done = new Set(rows.map((r) => r.key));
const todo = planRuns(people.map((p) => p.id), pieces).filter((r) => !done.has(r.key));
console.log(`${rows.length} done, ${todo.length} to go, running up to ${MAX}`);

const deps = nodeDeps(process.env.HF_TOKEN);
const providers = { ootd: ootdProvider(deps), idm: idmProvider(deps) };
const personData: Record<string, string> = {};
mkdirSync(IMG_DIR, { recursive: true });

let ran = 0;
for (const plan of todo.slice(0, MAX)) {
  const piece = byId[plan.piece];
  const person = people.find((p) => p.id === plan.person)!;
  personData[person.id] ??= await fileToDataUrl(person.file);
  const provider = providers[plan.provider as "ootd" | "idm"];
  const t0 = Date.now();
  const r = await provider.run({ person: personData[person.id], garment: piece.image, slot: piece.slot, description: describePiece(piece) });
  const seconds = (Date.now() - t0) / 1000;
  if (!r.ok && (r.reason === "quota" || r.reason === "unavailable")) {
    console.warn(`${plan.key}: ${r.reason}; stopping for today.`);
    break;
  }
  const base = { key: plan.key, person: plan.person, piece: piece.id, slot: piece.slot, provider: plan.provider, seconds };
  if (r.ok) {
    const buf = dataUrlToBuffer(r.image);
    const file = `${IMG_DIR}/${plan.key.replace(/[^a-z0-9]+/gi, "-")}.jpg`;
    await sharp(buf).resize({ width: 512, height: 512, fit: "inside" }).jpeg({ quality: 78 }).toFile(file);
    const metrics = measure(await loadPixelsNode(dataUrlToBuffer(personData[person.id])), await loadPixelsNode(buf), piece);
    rows.push({ ...base, ok: true, metrics, image: file.replace(/^public/, "") });
    console.log(`${plan.key}: ok in ${seconds.toFixed(0)}s, pass=${decide(metrics).pass}`);
  } else {
    rows.push({ ...base, ok: false, reason: r.reason, detail: r.detail });
    console.log(`${plan.key}: ${r.reason}: ${r.detail}`);
  }
  writeFileSync(RUNS, JSON.stringify(rows, null, 1));
  ran++;
}

const gallery = rows.filter((r) => r.ok && r.metrics && decide(r.metrics).pass)
  .map((r) => ({ piece: r.piece, slot: r.slot, provider: r.provider, image: r.image! }));
writeFileSync(GALLERY, JSON.stringify(gallery));
console.log(`Ran ${ran}. ${rows.length} of ${rows.length + todo.length - ran} complete. Gallery: ${gallery.length}.`);
