// lib/build/colorPass.ts — a second, single-purpose look at colour. The main tagger names colours while
// deciding eight other things and often picks print accents or the dupatta; this asks one question only.
import { PALETTE } from "./palette";
import { VISUAL_STYLES } from "./styles";

export interface ColorRead { primary: string; secondary: string[]; styles?: string[] }

export const COLOR_SCHEMA = {
  type: "OBJECT",
  properties: {
    primary: { type: "STRING", enum: Object.keys(PALETTE) },
    secondary: { type: "ARRAY", items: { type: "STRING", enum: Object.keys(PALETTE) } },
    styles: { type: "ARRAY", items: { type: "STRING", enum: [...VISUAL_STYLES] } },
  },
  required: ["primary", "secondary", "styles"],
};

export function colorPrompt(name: string, slotNoun: string): string {
  return [
    `This photo shows "${name}", a ${slotNoun} from a Bangladeshi brand.`,
    "Name the colour a shopper would use for this garment: the colour covering most of the main garment body (the kameez, kurti, top, saree body or trousers being sold).",
    "Ignore the background, skin, hair, shoes, jewellery, and any trousers or dupatta that are only styling. For a print, name the ground colour, not the accents.",
    "Pick from this palette, matching by the swatch shown in brackets:",
    Object.entries(PALETTE).map(([n, hex]) => `${n} (${hex})`).join(", "),
    "secondary: up to two other clearly visible colours of the same garment, or none.",
    `styles: which of these the garment clearly shows, or none; only choose what is plainly visible: ${VISUAL_STYLES.join(", ")}.`,
  ].join("\n");
}

export function normalizeColorRead(raw: unknown): ColorRead | null {
  const r = raw as { primary?: unknown; secondary?: unknown } | null;
  if (!r || typeof r.primary !== "string" || !(r.primary in PALETTE)) return null;
  const secondary = Array.isArray(r.secondary)
    ? [...new Set(r.secondary.filter((c): c is string => typeof c === "string" && c in PALETTE && c !== r.primary))].slice(0, 2)
    : [];
  const allowed = new Set<string>(VISUAL_STYLES);
  const rawStyles = (r as { styles?: unknown }).styles;
  const styles = Array.isArray(rawStyles) ? [...new Set(rawStyles.filter((x): x is string => typeof x === "string" && allowed.has(x)))] : [];
  return { primary: r.primary, secondary, styles };
}

/** Merge order: brand-named colour, focused primary, then the rest; at most three. */
export function mergeColors(brand: string | null, read: ColorRead | null, tagColors: string[]): string[] {
  const order = [brand, read?.primary, ...tagColors, ...(read?.secondary ?? [])].filter((c): c is string => Boolean(c));
  return [...new Set(order)].slice(0, 3);
}
