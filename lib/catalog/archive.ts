// lib/catalog/archive.ts — the original foreign-brand catalogue (Uniqlo and Shopify boutiques), kept as a
// hidden archive. Its western slots are mapped onto the current ones so try-on and the judge work unchanged.
import type { Slot } from "./slots";
import type { Piece } from "./types";

export const ARCHIVE_URL =
  "https://gist.githubusercontent.com/AhmedFahim13/080209db01b74009048273b849d53a01/raw/catalog.json";

interface ArchivePiece { id: string; slot: string; name: string; brand: string; image: string }

const SLOT_MAP: Record<string, Slot> = {
  dress: "set2", top: "top", outer: "top", bottom: "bottom", bag: "accessory", shoes: "accessory", accessory: "accessory",
};

/** Tab labels while browsing the archive, in the archive's own words. */
export const ARCHIVE_SLOTS: { slot: Slot; label: string }[] = [
  { slot: "set2", label: "Dresses" },
  { slot: "top", label: "Tops & outerwear" },
  { slot: "bottom", label: "Bottoms" },
  { slot: "accessory", label: "Bags, shoes & more" },
];

export function toArchivePiece(p: ArchivePiece): Piece | null {
  const slot = SLOT_MAP[p.slot];
  if (!slot || !p.image) return null;
  return {
    id: `archive-${p.id}`, slot, name: p.name, brand: p.brand, url: "", price: null, image: p.image,
    colors: [], fabric: "unknown", work: "none", formality: 3, occasions: [], imageKind: "on_model", styles: [],
  };
}
