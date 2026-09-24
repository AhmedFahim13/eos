// lib/stylist/suggest.ts — one model call over the narrowed list; rules when the model is unavailable or wrong.
import type { Piece } from "@/lib/catalog/types";
import { stylistPrompt } from "./prompt";
import { candidates, ruleSuggestions, type StyleRequest, type Suggestion } from "./rules";
import { validateSuggestions } from "./validate";

export interface SuggestResult { suggestions: Suggestion[]; source: "ai" | "rules" }

export async function suggest(
  pieces: Piece[],
  req: StyleRequest,
  generate: (prompt: string) => Promise<unknown>,
): Promise<SuggestResult> {
  const anchor = req.anchorId ? pieces.find((p) => p.id === req.anchorId) ?? null : null;
  const cands = candidates(pieces, req, anchor);
  if (cands.length === 0) return { suggestions: [], source: "rules" };
  try {
    const valid = validateSuggestions(await generate(stylistPrompt(cands, req, anchor)), cands);
    if (valid) return { suggestions: valid, source: "ai" };
  } catch {
    // quota, network or parse error: fall through to rules
  }
  return { suggestions: ruleSuggestions(cands, req), source: "rules" };
}
