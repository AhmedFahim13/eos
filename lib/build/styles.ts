// lib/build/styles.ts — design tags for search, using only established names that brands and shoppers
// already use (weaves, crafts, cuts, bottom types, fabrics). Nothing is invented: a variation without a
// recognised name gets no tag. Weave names come only from the brand's own text, since a photo cannot
// reliably tell a Jamdani from a Tangail; the vision pass may add only what a photo shows (VISUAL_STYLES).

const TEXT_STYLES: [RegExp, string][] = [
  // Sarees: weaves and types
  [/\bjamdani\b/i, "Jamdani"], [/\btangail\b/i, "Tangail"], [/\b(mirpur )?katan\b/i, "Katan"],
  [/\b(banarasi|benarasi|benarashi)\b/i, "Banarasi"], [/\bmuslin|maslin\b/i, "Muslin"], [/\bmonipuri|manipuri\b/i, "Monipuri"],
  [/\brajshahi silk\b/i, "Rajshahi silk"], [/\bhalf[- ]?silk\b/i, "Half silk"], [/\btant\b|\bhandloom\b/i, "Tant"],
  [/\bkanchipuram|kanjivaram\b/i, "Kanchipuram"], [/\bkota\b/i, "Kota"], [/\btussar|tasar\b/i, "Tussar"], [/\bikk?at\b/i, "Ikat"],
  // Crafts
  [/\bkantha\b/i, "Kantha"], [/\bblock[- ]?print/i, "Block print"], [/\bbatik\b/i, "Batik"], [/\btie[- ]?dye\b/i, "Tie-dye"],
  [/\bscreen[- ]?print/i, "Screen print"], [/\bdigital(ly)?[- ]?print/i, "Digital print"], [/\bhand[- ]?paint/i, "Hand-painted"],
  [/\bkarchupi\b/i, "Karchupi"], [/\bzari\b/i, "Zari"], [/\bsequin/i, "Sequin"], [/\bappli(que|qué)\b/i, "Appliqué"],
  [/\bchikan(kari)?\b/i, "Chikankari"], [/\bmirror[- ]?work\b/i, "Mirror work"], [/\bembroider/i, "Embroidery"],
  // Cuts and garment types
  [/\banarkali\b/i, "Anarkali"], [/\ba[- ]line\b/i, "A-line"], [/\bkaftan|caftan\b/i, "Kaftan"], [/\bangrakha\b/i, "Angrakha"],
  [/\bpeplum\b/i, "Peplum"], [/\bgown\b/i, "Gown"], [/\btunic\b/i, "Tunic"], [/\bkoti\b/i, "Koti"], [/\bshrug\b/i, "Shrug"],
  // Bottoms
  [/\bpalazzo\b/i, "Palazzo"], [/\bchuridar\b/i, "Churidar"], [/\bsalwar\b/i, "Salwar"], [/\bcigarette\b/i, "Cigarette pants"],
  [/\bculottes?\b/i, "Culottes"], [/\bwide[- ]?leg\b/i, "Wide-leg"], [/\bjeans|denim\b/i, "Denim"], [/\bleggings?\b/i, "Leggings"], [/\bskirt\b/i, "Skirt"],
  // Fabrics
  [/\bcotton\b/i, "Cotton"], [/\bsilk\b/i, "Silk"], [/\blinen\b/i, "Linen"], [/\blawn\b/i, "Lawn"], [/\bgeorgette\b/i, "Georgette"],
  [/\bchiffon\b/i, "Chiffon"], [/\bviscose\b/i, "Viscose"], [/\bkhadi\b/i, "Khadi"], [/\bvelvet\b/i, "Velvet"], [/\borganza\b/i, "Organza"],
];

/** What a photo can show; the vision pass may only answer from this list. */
export const VISUAL_STYLES = [
  "Anarkali", "A-line", "Kaftan", "Angrakha", "Peplum", "Gown", "Koti",
  "Palazzo", "Churidar", "Salwar", "Wide-leg", "Skirt",
  "Block print", "Batik", "Tie-dye", "Digital print", "Embroidery", "Sequin", "Mirror work", "Zari",
] as const;

export function stylesFromText(name: string, hints: string): string[] {
  const text = `${name} | ${hints}`;
  return TEXT_STYLES.filter(([re]) => re.test(text)).map(([, tag]) => tag);
}

export function mergeStyles(text: string[], visual: string[] = []): string[] {
  const allowed = new Set<string>(VISUAL_STYLES);
  return [...new Set([...text, ...visual.filter((s) => allowed.has(s))])];
}
