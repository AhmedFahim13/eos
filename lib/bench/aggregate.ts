// lib/bench/aggregate.ts — pass rates per model and garment type, re-decided with current thresholds.
import type { Slot } from "@/lib/catalog/slots";
import { decide, THRESHOLDS, type Metrics, type Thresholds } from "@/lib/judge/judge";
import type { ProviderId } from "@/lib/tryon/types";

export interface BenchRow {
  key: string;
  person: string;
  piece: string;
  slot: Slot;
  provider: ProviderId;
  ok: boolean;
  seconds: number;
  metrics?: Metrics;
  image?: string;
  reason?: string;
  detail?: string;
}

export interface Cell {
  provider: ProviderId;
  slot: Slot;
  attempts: number;
  generated: number;
  passed: number;
  generationRate: number;
  passRate: number;
}

export function aggregate(rows: BenchRow[], t: Thresholds = THRESHOLDS): Cell[] {
  const cells = new Map<string, Cell>();
  for (const r of rows) {
    const k = `${r.provider}|${r.slot}`;
    const c = cells.get(k) ?? { provider: r.provider, slot: r.slot, attempts: 0, generated: 0, passed: 0, generationRate: 0, passRate: 0 };
    c.attempts++;
    if (r.ok && r.metrics) {
      c.generated++;
      if (decide(r.metrics, t).pass) c.passed++;
    }
    cells.set(k, c);
  }
  return [...cells.values()].map((c) => ({
    ...c,
    generationRate: c.attempts ? c.generated / c.attempts : 0,
    passRate: c.generated ? c.passed / c.generated : 0,
  }));
}
