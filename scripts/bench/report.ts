// scripts/bench/report.ts — results.json for the /bench page and docs/bench.md for the repo.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { aggregate, type BenchRow } from "@/lib/bench/aggregate";
import { SLOT_NOUN } from "@/lib/catalog/slots";

const read = <T>(p: string, fallback: T): T => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const rows: BenchRow[] = read("data/bench/runs.json", []);
const table = aggregate(rows);
const judge = read<{ n: number; test: number } | null>("data/bench/calibration.json", null);
const tagger = read<{ n: number; slotAccuracy: number; colorAgreement: number } | null>("public/bench/tagger.json", null);
const results = { generatedAt: new Date().toISOString(), runs: rows.length, table, judge, tagger };
writeFileSync("public/bench/results.json", JSON.stringify(results, null, 2));

const pct = (x: number) => `${Math.round(x * 100)}%`;
const md = [
  "# How open try-on models handle Bangladeshi clothing",
  "",
  `Runs so far: ${rows.length}. Updated ${results.generatedAt.slice(0, 10)}. Live page: /bench.`,
  "",
  "| model | garment | attempts | generated | judged right |",
  "|---|---|---|---|---|",
  ...table.map((c) => `| ${c.provider === "ootd" ? "OOTDiffusion" : "IDM-VTON"} | ${SLOT_NOUN[c.slot]} | ${c.attempts} | ${pct(c.generationRate)} | ${pct(c.passRate)} |`),
  "",
  "## Method",
  "",
  "Five openly licensed photos of South Asian women (sources and licences in `data/bench/people.json`) × two pieces per garment type from the live catalog × each model that accepts that type. Each output is scored by the same judge that runs in the app: garment colour present (share of the garment region within CIELAB ΔE 25 of a tagged colour), same person (difference hash of the head region), outfit changed (mean ΔE across the garment region).",
  "",
  judge ? `The judge agreed with a human rating on ${pct(judge.test)} of held-out outputs (${judge.n} rated in total).` : "Judge agreement with human ratings: not calibrated yet.",
  tagger ? `The catalog tagger chose the right garment type for ${pct(tagger.slotAccuracy)} of ${tagger.n} pieces and the right main colour for ${pct(tagger.colorAgreement)}, checked against labels from a second AI model (Claude, labelling blind from the product photo and name), not a person. Most misses are two-piece sets tagged as three-piece: brands sell a kameez with dupatta as a two-piece and photograph it with trousers.` : "Tagger accuracy: not scored yet.",
  "",
  "## Limits",
  "",
  "Small sample: treat differences under about 15 points as noise. Regions are fixed fractions of a portrait, so crops and poses outside the norm are judged less reliably. Garment colours come from the vision tagger, not a measurement.",
  "",
].join("\n");
writeFileSync("docs/bench.md", md);
console.log(`Report: ${rows.length} runs, ${table.length} cells.`);
