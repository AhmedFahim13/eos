// lib/stylist/prompt.ts — a compact candidate list and the instruction for the model.
import { SLOT_NOUN } from "@/lib/catalog/slots";
import { OCCASION_LABEL, type Piece } from "@/lib/catalog/types";
import type { StyleRequest } from "./rules";

export const SUGGEST_SCHEMA = {
  type: "OBJECT",
  properties: {
    suggestions: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { id: { type: "STRING" }, reason: { type: "STRING" } }, required: ["id", "reason"] },
    },
  },
  required: ["suggestions"],
};

const line = (p: Piece) =>
  `${p.id} | ${SLOT_NOUN[p.slot]} | ${p.name} | ${p.colors.map((c) => c.name).join("/")} | ${p.fabric} | ${p.work} | formality ${p.formality} | ${p.price ? `৳${p.price}` : "price n/a"}`;

export function stylistPrompt(cands: Piece[], req: StyleRequest, anchor: Piece | null): string {
  const task = anchor
    ? `She is wearing: ${line(anchor)}. Suggest up to 3 ornas or accessories from the list that complete this look for ${OCCASION_LABEL[req.occasion]}.`
    : `Suggest up to 3 pieces from the list for ${OCCASION_LABEL[req.occasion]}${req.budget ? `, each under ৳${req.budget}` : ""}. Prefer variety of type.`;
  return [
    "You are a stylist who knows Bangladeshi women's fashion and occasions well.",
    task,
    "Use only ids from the list. For each, give one short sentence (under 20 words) on why it suits the occasion. No prices in the reason.",
    "Candidates (id | type | name | colours | fabric | work | formality 1-5 | price):",
    ...cands.map(line),
  ].join("\n");
}
