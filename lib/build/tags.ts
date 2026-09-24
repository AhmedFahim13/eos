// lib/build/tags.ts — what the vision tagger returns for each piece, and how a tag becomes a Piece.
import { createHash } from "node:crypto";
import { SLOT_VALUES, isWearable, type Slot } from "@/lib/catalog/slots";
import { OCCASIONS, type ImageKind, type Occasion, type Piece } from "@/lib/catalog/types";
import type { RawPiece } from "./feeds";
import { PALETTE } from "./palette";

export { PALETTE };
import { applyRules, colorFromText, slotFromText } from "./rules";
import type { ColorRead } from "./colorPass";


export const FABRICS = ["cotton", "georgette", "silk", "linen", "lawn", "chiffon", "khadi", "mixed", "unknown"] as const;
export const WORKS = ["none", "print", "embroidery", "karchupi", "block", "sequin"] as const;
export const IMAGE_KINDS: readonly ImageKind[] = ["flat", "on_model", "detail"];

export interface Tag {
  slot: Slot | "skip";
  colors: string[];
  fabric: string;
  work: string;
  formality: number;
  occasions: Occasion[];
  tryon_image: number;
  image_kind: ImageKind;
  tryon_ok: boolean;
  /** Filled by applyRules from the brand text and the vision pass; not asked of the main tagger. */
  styles?: string[];
}

const str = (values: readonly string[]) => ({ type: "STRING", enum: [...values] });

export const TAG_SCHEMA = {
  type: "OBJECT",
  properties: {
    slot: str([...SLOT_VALUES, "skip"]),
    colors: { type: "ARRAY", items: str(Object.keys(PALETTE)) },
    fabric: str(FABRICS),
    work: str(WORKS),
    formality: { type: "INTEGER" },
    occasions: { type: "ARRAY", items: str(OCCASIONS) },
    tryon_image: { type: "INTEGER" },
    image_kind: str(IMAGE_KINDS),
    tryon_ok: { type: "BOOLEAN" },
  },
  required: ["slot", "colors", "fabric", "work", "formality", "occasions", "tryon_image", "image_kind", "tryon_ok"],
};

export function tagPrompt(p: RawPiece, nImages: number): string {
  return [
    "You are cataloguing a Bangladeshi women's clothing product for a virtual try-on app.",
    `Product: "${p.name}" from ${p.brand}. Shop category hints: ${p.hints || "none"}.`,
    `You see ${nImages} product photo(s), numbered from 0.`,
    "Decide:",
    "- slot: saree; set3 (three-piece salwar kameez with orna or dupatta); set2 (two-piece: kameez or kurti with a bottom, or a co-ord); kurti (a single long tunic or kameez); top (short top, shirt, blouse, tee); bottom (salwar, palazzo, pants, skirt, leggings); orna (dupatta, scarf, shawl); accessory (jewellery, bag, other); skip (menswear, kidswear, underwear, homeware, or not clothing).",
    "- colors: up to three main garment colours, most dominant first, from the allowed list. Ignore the background and skin.",
    "- fabric; work (surface decoration); formality from 1 (at home) to 5 (bridal); the occasions it suits.",
    "- tryon_image: the index of the photo that best shows the whole garment from the front. Prefer a flat or mannequin shot, else a front on-model shot.",
    "- image_kind: what that chosen photo is.",
    "- tryon_ok: false if no photo shows the whole garment from the front.",
  ].join("\n");
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function normalizeTag(raw: unknown, nImages: number): Tag | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const slot = t.slot;
  if (typeof slot !== "string" || ![...SLOT_VALUES, "skip"].includes(slot)) return null;
  const colors = Array.isArray(t.colors)
    ? [...new Set(t.colors.filter((c): c is string => typeof c === "string" && c in PALETTE))].slice(0, 3)
    : [];
  if (slot !== "skip" && colors.length === 0) return null;
  const occasions = Array.isArray(t.occasions)
    ? [...new Set(t.occasions.filter((o): o is Occasion => typeof o === "string" && (OCCASIONS as string[]).includes(o)))]
    : [];
  const last = Math.max(0, nImages - 1);
  return {
    slot: slot as Tag["slot"],
    colors,
    fabric: oneOf(t.fabric, FABRICS, "unknown"),
    work: oneOf(t.work, WORKS, "none"),
    formality: Math.min(5, Math.max(1, Math.round(Number(t.formality) || 3))),
    occasions,
    tryon_image: Math.min(last, Math.max(0, Math.round(Number(t.tryon_image) || 0))),
    image_kind: oneOf(t.image_kind, IMAGE_KINDS, "on_model"),
    tryon_ok: t.tryon_ok !== false,
  };
}

/** Cache key: the piece plus the images the tagger saw, so a re-shot product is re-tagged. */
export function tagKey(raw: RawPiece): string {
  const h = createHash("sha1").update(raw.images.slice(0, 3).join("|")).digest("hex").slice(0, 12);
  return `${raw.id}:${h}`;
}

export function selectUntagged(raws: RawPiece[], cache: Record<string, Tag>, budget: number): RawPiece[] {
  return raws.filter((r) => !(tagKey(r) in cache)).slice(0, budget);
}

export function toPiece(raw: RawPiece, tag: Tag): Piece | null {
  if (tag.slot === "skip") return null;
  if (isWearable(tag.slot) && !tag.tryon_ok) return null;
  return {
    id: raw.id,
    slot: tag.slot,
    name: raw.name,
    brand: raw.brand,
    url: raw.url,
    price: raw.price,
    image: raw.images[tag.tryon_image] ?? raw.images[0],
    colors: tag.colors.map((name) => ({ name, hex: PALETTE[name] })),
    fabric: tag.fabric,
    work: tag.work,
    formality: tag.formality,
    occasions: tag.occasions,
    imageKind: tag.image_kind,
    styles: tag.styles ?? [],
  };
}

/** For a piece the vision tagger hasn't reached yet: only what the brand's own text states, or null. */
export function textOnlyTag(raw: RawPiece): Tag | null {
  const slot = slotFromText(raw.name, raw.hints);
  if (!slot) return null;
  const color = colorFromText(raw.name, raw.hints);
  return {
    slot, colors: color ? [color] : [], fabric: "unknown", work: "none", formality: 3, occasions: [],
    tryon_image: 0, image_kind: "on_model", tryon_ok: true,
  };
}

export function buildCatalog(raws: RawPiece[], cache: Record<string, Tag>, colorCache: Record<string, ColorRead> = {}): Piece[] {
  const out: Piece[] = [];
  for (const r of raws) {
    const tag = cache[tagKey(r)] ?? textOnlyTag(r);
    const piece = tag ? toPiece(r, applyRules(r, tag, colorCache[tagKey(r)] ?? null)) : null;
    if (piece) out.push(piece);
  }
  return out;
}
