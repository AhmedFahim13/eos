// lib/tryon/fit.ts — dress one person in one piece: try, judge, retry once on another model,
// and if both miss, show the better one with a plain note instead of a silent bad image.
import { SLOT_NOUN, type Slot } from "@/lib/catalog/slots";
import type { Piece } from "@/lib/catalog/types";
import type { Verdict } from "@/lib/judge/judge";
import { outOfCapacity, runChain } from "./chain";
import type { ProviderId, Providers } from "./types";

export interface FitDeps {
  providers: Providers;
  orderFor: (slot: Slot) => ProviderId[];
  judge: (person: string, result: string, piece: Piece) => Promise<Verdict>;
}

export type FitOutcome =
  | { kind: "ok"; image: string; provider: ProviderId; note?: string }
  | { kind: "quota" }
  | { kind: "error"; message: string };

export function describePiece(p: Piece): string {
  return [p.colors[0]?.name, p.fabric !== "unknown" ? p.fabric : "", SLOT_NOUN[p.slot]].filter(Boolean).join(" ");
}

export function noteFor(v: Verdict): string {
  if (!v.color) return "The colours came out different from the real piece in this one.";
  if (!v.person) return "The face may look a little altered in this one.";
  if (!v.changed) return "The model barely changed the outfit; this piece may not suit try-on.";
  return "This one may not be fully accurate.";
}

async function safeJudge(deps: FitDeps, person: string, image: string, piece: Piece): Promise<Verdict | null> {
  try { return await deps.judge(person, image, piece); } catch { return null; }
}

export async function fitOne(person: string, piece: Piece, deps: FitDeps): Promise<FitOutcome> {
  const input = { person, garment: piece.image, slot: piece.slot, description: describePiece(piece) };
  const order = deps.orderFor(piece.slot);

  const first = await runChain(input, deps.providers, order);
  if (!first.result.ok) {
    return outOfCapacity(first.tried) ? { kind: "quota" } : { kind: "error", message: "Try-on failed. Please try again." };
  }
  const r1 = first.result;
  const v1 = await safeJudge(deps, person, r1.image, piece);
  if (!v1 || v1.pass) return { kind: "ok", image: r1.image, provider: r1.provider };

  const second = await runChain(input, deps.providers, order, first.tried.map((t) => t.provider));
  if (!second.result.ok) return { kind: "ok", image: r1.image, provider: r1.provider, note: noteFor(v1) };
  const r2 = second.result;
  const v2 = await safeJudge(deps, person, r2.image, piece);
  if (!v2 || v2.pass) return { kind: "ok", image: r2.image, provider: r2.provider };

  return v2.score > v1.score
    ? { kind: "ok", image: r2.image, provider: r2.provider, note: noteFor(v2) }
    : { kind: "ok", image: r1.image, provider: r1.provider, note: noteFor(v1) };
}
