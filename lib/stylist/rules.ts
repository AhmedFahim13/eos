// lib/stylist/rules.ts — narrow the catalog to ~30 candidates, and a rules-only answer for when AI is unavailable.
import { EXTRAS, isWearable, SLOT_NOUN } from "@/lib/catalog/slots";
import { OCCASION_LABEL, type Occasion, type Piece } from "@/lib/catalog/types";

export interface StyleRequest { occasion: Occasion; budget?: number | null; anchorId?: string | null }
export interface Suggestion { id: string; reason: string }

export const FORMALITY_TARGET: Record<Occasion, number> = {
  eid: 4, wedding: 5, gaye_holud: 4, puja: 4, office: 2, university: 2, casual: 1, party: 4,
};

export function ruleScore(p: Piece, req: StyleRequest, anchor: Piece | null): number {
  const occasion = p.occasions.includes(req.occasion) ? 2 : 0;
  const formality = 1 - Math.abs(p.formality - FORMALITY_TARGET[req.occasion]) / 4;
  const shared = anchor && p.colors.some((c) => anchor.colors.some((a) => a.name === c.name)) ? 0.5 : 0;
  return occasion + formality + shared;
}

export function candidates(pieces: Piece[], req: StyleRequest, anchor: Piece | null, limit = 30): Piece[] {
  const pool = pieces.filter((p) => (anchor ? EXTRAS.includes(p.slot) : isWearable(p.slot)));
  const affordable = pool.filter((p) => req.budget == null || (p.price != null && p.price <= req.budget));
  const matching = affordable.filter((p) => p.occasions.includes(req.occasion));
  const base = matching.length >= 3 || anchor ? matching : affordable;
  return base
    .map((p) => ({ p, s: ruleScore(p, req, anchor) }))
    .sort((a, b) => b.s - a.s || a.p.id.localeCompare(b.p.id))
    .slice(0, limit)
    .map((x) => x.p);
}

export function ruleSuggestions(cands: Piece[], req: StyleRequest, n = 3): Suggestion[] {
  const picked: Piece[] = [];
  for (const p of cands) if (picked.length < n && !picked.some((q) => q.slot === p.slot)) picked.push(p);
  for (const p of cands) if (picked.length < n && !picked.includes(p)) picked.push(p);
  return picked.map((p) => ({
    id: p.id,
    reason: `${OCCASION_LABEL[req.occasion]}-ready ${p.fabric !== "unknown" ? `${p.fabric} ` : ""}${SLOT_NOUN[p.slot]}${p.work !== "none" ? ` with ${p.work}` : ""}${p.price ? `, ৳${p.price.toLocaleString("en-IN")}` : ""}.`,
  }));
}
