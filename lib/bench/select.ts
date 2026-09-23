// lib/bench/select.ts — which pieces and runs make up the benchmark (fixed once chosen).
import { createHash } from "node:crypto";
import { TRYON_ORDER } from "@/lib/catalog/slots";
import type { Piece } from "@/lib/catalog/types";
import { providerOrder } from "@/lib/tryon/chain";
import type { ProviderId } from "@/lib/tryon/types";

const h = (s: string) => createHash("sha1").update(s).digest("hex");

export function selectBenchPieces(pieces: Piece[], perSlot = 2): Piece[] {
  return TRYON_ORDER.flatMap((slot) =>
    pieces.filter((p) => p.slot === slot).sort((a, b) => h(a.id).localeCompare(h(b.id))).slice(0, perSlot));
}

export interface PlannedRun { key: string; person: string; piece: string; provider: ProviderId }

export function planRuns(people: string[], pieces: Piece[]): PlannedRun[] {
  return people.flatMap((person) => pieces.flatMap((p) =>
    providerOrder(p.slot, false).map((provider) => ({ key: `${person}|${p.id}|${provider}`, person, piece: p.id, provider }))));
}
