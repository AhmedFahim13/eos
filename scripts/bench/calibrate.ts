// scripts/bench/calibrate.ts — `--template` writes a rating sheet; otherwise fit thresholds on half
// of Fahim's ratings and report agreement on the other half.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { BenchRow } from "@/lib/bench/aggregate";
import { agreement, searchThresholds, type Labelled } from "@/lib/bench/agreement";
import { THRESHOLDS } from "@/lib/judge/judge";

const RUNS = "data/bench/runs.json";
const SHEET = "data/bench/ratings.csv";
const rows: BenchRow[] = JSON.parse(readFileSync(RUNS, "utf8"));
const generated = rows.filter((r) => r.ok && r.image && r.metrics);

if (process.argv.includes("--template")) {
  const have = existsSync(SHEET) ? readFileSync(SHEET, "utf8") : "image,good\n";
  const listed = new Set(have.split("\n").slice(1).map((l) => l.split(",")[0]));
  const add = generated.filter((r) => !listed.has(r.image!)).map((r) => `${r.image},`).join("\n");
  writeFileSync(SHEET, have.trimEnd() + (add ? `\n${add}` : "") + "\n");
  console.log(`${SHEET}: put 1 (looks right) or 0 (wrong garment, wrong colour, altered face, or unchanged) after each image path. Images are under public/.`);
  process.exit(0);
}

const ratings = new Map(readFileSync(SHEET, "utf8").split("\n").slice(1)
  .map((l) => l.trim().split(",")).filter(([img, g]) => img && (g === "0" || g === "1")).map(([img, g]) => [img, g === "1"]));
const labelled: Labelled[] = generated.filter((r) => ratings.has(r.image!)).map((r) => ({ metrics: r.metrics!, good: ratings.get(r.image!)! }));
if (labelled.length < 20) { console.error(`Only ${labelled.length} rated; rate at least 20.`); process.exit(1); }

const train = labelled.filter((_, i) => i % 2 === 0), test = labelled.filter((_, i) => i % 2 === 1);
const fitted = searchThresholds(train);
const result = {
  n: labelled.length,
  before: agreement(labelled, THRESHOLDS),
  train: agreement(train, fitted),
  test: agreement(test, fitted),
  thresholds: fitted,
  calibratedAt: new Date().toISOString(),
};
writeFileSync("lib/judge/thresholds.json", JSON.stringify(fitted, null, 2) + "\n");
writeFileSync("data/bench/calibration.json", JSON.stringify(result, null, 2));
console.log(result);
