// lib/catalog/slots.ts — Bangladeshi women's-wear slots and how they combine.
export type Slot = "saree" | "set3" | "set2" | "kurti" | "top" | "bottom" | "orna" | "accessory";

export const SLOT_VALUES: Slot[] = ["saree", "set3", "set2", "kurti", "top", "bottom", "orna", "accessory"];

export const SLOTS: { slot: Slot; label: string; noun: string }[] = [
  { slot: "saree", label: "Sarees", noun: "saree" },
  { slot: "set3", label: "3-piece", noun: "three-piece salwar kameez" },
  { slot: "set2", label: "2-piece", noun: "two-piece set" },
  { slot: "kurti", label: "Kurtis", noun: "kurti" },
  { slot: "top", label: "Tops", noun: "top" },
  { slot: "bottom", label: "Bottoms", noun: "bottom" },
  { slot: "orna", label: "Ornas", noun: "orna" },
  { slot: "accessory", label: "Accessories", noun: "accessory" },
];

export const SLOT_NOUN = Object.fromEntries(SLOTS.map((s) => [s.slot, s.noun])) as Record<Slot, string>;

export const SLOT_TINT: Record<Slot, string> = {
  saree: "#efe3e6", set3: "#e9dfe8", set2: "#e3e7ec", kurti: "#e7e2d8",
  top: "#dfe4e0", bottom: "#ece2df", orna: "#e8e3ea", accessory: "#efe6dc",
};

/** Complete outfits: each one replaces every other wearable. */
export const OUTFITS: Slot[] = ["saree", "set3", "set2"];
/** The order pieces are sent to try-on: an outfit alone, else the bottom before what goes over it. */
export const TRYON_ORDER: Slot[] = ["saree", "set3", "set2", "bottom", "kurti", "top"];
/** Shown on the board, never sent to try-on. */
export const EXTRAS: Slot[] = ["orna", "accessory"];

export const isWearable = (s: Slot): boolean => TRYON_ORDER.includes(s);

/** Slots that must be emptied when a piece in `slot` is equipped. */
export function displaced(slot: Slot): Slot[] {
  if (OUTFITS.includes(slot)) return TRYON_ORDER.filter((s) => s !== slot);
  if (slot === "kurti") return [...OUTFITS, "top"];
  if (slot === "top") return [...OUTFITS, "kurti"];
  if (slot === "bottom") return [...OUTFITS];
  return [];
}
