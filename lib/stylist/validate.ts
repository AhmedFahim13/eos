// lib/stylist/validate.ts — never show a suggestion the model invented.
import type { Piece } from "@/lib/catalog/types";
import type { Suggestion } from "./rules";

export function validateSuggestions(raw: unknown, cands: Piece[], n = 3): Suggestion[] | null {
  const list = (raw as { suggestions?: unknown } | null)?.suggestions;
  if (!Array.isArray(list)) return null;
  const known = new Set(cands.map((p) => p.id));
  const out: Suggestion[] = [];
  for (const item of list) {
    const id = (item as { id?: unknown })?.id, reason = (item as { reason?: unknown })?.reason;
    if (typeof id !== "string" || typeof reason !== "string" || !reason.trim()) continue;
    if (!known.has(id) || out.some((s) => s.id === id)) continue;
    out.push({ id, reason: reason.trim().slice(0, 200) });
    if (out.length === n) break;
  }
  return out.length ? out : null;
}
