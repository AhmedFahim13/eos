// lib/build/rules.ts — the brand's own words beat the photo. When a product name says "Two-Piece",
// "Kurta" or "Off White", that is the seller's ground truth; the vision tag only fills the gaps.
import type { Slot } from "@/lib/catalog/slots";
import type { Tag } from "./tags";
import { mergeColors, type ColorRead } from "./colorPass";
import { mergeStyles, stylesFromText } from "./styles";

const has = (re: RegExp, s: string) => re.test(s);

const SET3 = /\b(three|3)[- ]?(piece|pcs?)\b|\b3pcs\b/i;
const SET2 = /\b(two|2)[- ]?(piece|pcs?)\b|\b2pcs\b/i;
const SAREE = /\b(saree|sari)\b/i;
const KURTI = /\b(kurti|kurta|tunic|kameez)\b|\blong (shirt|top)\b/i;
const BOTTOM = /\b(palazzo|pants?|trousers?|jeans|skirt|leggings?|salwar|culottes?)\b/i;
const TOP = /\b(blazer|jacket|shirt|top|tops|tee|t-shirt|blouse|shrug|cardigan|bolero)\b/i;

/** Garment type from the brand's name and category text, or null to defer to the vision tag. */
export function slotFromText(name: string, hints: string): Slot | null {
  const t = `${name} | ${hints}`;
  if (has(SAREE, t)) return "saree";
  if (has(SET3, t)) return "set3";
  if (has(SET2, t)) return "set2";
  // A salwar kameez (set/suit) is at least kameez + salwar; with a dupatta or orna it is a three-piece.
  if (/\bsalwar (kameez|suit)\b|\bkameez set\b/i.test(name)) return /\b(dupatta|orna|urna)\b/i.test(name) ? "set3" : "set2";
  if (has(KURTI, name)) return "kurti";
  const bottom = has(BOTTOM, name), top = has(TOP, name);
  if (bottom && top) return "set2";
  if (bottom) return "bottom";
  if (top) return "top";
  return null;
}

// Multi-word shades first, so "dk olive green" reads as olive, not green.
const COLOR_WORDS: [RegExp, string][] = [
  [/\boff[- ]?white\b/i, "ivory"], [/\bsky[- ]?blue\b/i, "sky"], [/\bnavy( blue)?\b/i, "navy"],
  [/\bolive( green)?\b/i, "olive"], [/\bmint( green)?\b/i, "mint"], [/\b(light|dark|dk) gr[ae]y\b/i, "grey"],
  [/\bwhite\b/i, "white"], [/\bivory\b/i, "ivory"], [/\bcream\b/i, "cream"], [/\bbeige\b/i, "beige"],
  [/\byellow\b/i, "yellow"], [/\bmustard\b/i, "mustard"], [/\b(orange|rust)\b/i, "orange"], [/\bpeach\b/i, "peach"],
  [/\bcoral\b/i, "coral"], [/\bred\b/i, "red"], [/\b(maroon|wine|burgundy)\b/i, "maroon"], [/\bpink\b/i, "pink"],
  [/\bmagenta\b/i, "magenta"], [/\bpurple\b/i, "purple"], [/\b(lavender|lilac)\b/i, "lavender"], [/\bblue\b/i, "blue"],
  [/\bteal\b/i, "teal"], [/\bgreen\b/i, "green"], [/\bbrown\b/i, "brown"], [/\bgr[ae]y\b/i, "grey"],
  [/\bblack\b/i, "black"], [/\bgold(en)?\b/i, "gold"], [/\bsilver\b/i, "silver"],
];

/** The one palette colour the brand names, or null when it names none or several. */
export function colorFromText(name: string, hints: string): string | null {
  let rest = `${name} | ${hints}`;
  const found = new Set<string>();
  for (const [re, color] of COLOR_WORDS) {
    if (re.test(rest)) {
      found.add(color);
      rest = rest.replace(new RegExp(re.source, "gi"), " ");
    }
  }
  return found.size === 1 ? [...found][0] : null;
}

export function applyRules(text: { name: string; hints: string }, tag: Tag, read: ColorRead | null = null): Tag {
  if (tag.slot === "skip") return tag;
  const slot = slotFromText(text.name, text.hints) ?? tag.slot;
  const brand = colorFromText(text.name, text.hints);
  const colors = brand || read ? mergeColors(brand, read, tag.colors) : tag.colors;
  const styles = mergeStyles(stylesFromText(text.name, text.hints), read?.styles);
  return { ...tag, slot, colors, styles };
}
