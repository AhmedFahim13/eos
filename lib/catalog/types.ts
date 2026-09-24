// lib/catalog/types.ts — the shape of one catalog piece as the app sees it.
import type { Slot } from "./slots";

export type Occasion = "eid" | "wedding" | "gaye_holud" | "puja" | "office" | "university" | "casual" | "party";

export const OCCASIONS: Occasion[] = ["eid", "wedding", "gaye_holud", "puja", "office", "university", "casual", "party"];

export const OCCASION_LABEL: Record<Occasion, string> = {
  eid: "Eid", wedding: "Wedding", gaye_holud: "Gaye holud", puja: "Puja",
  office: "Office", university: "University", casual: "Everyday", party: "Party",
};

export type ImageKind = "flat" | "on_model" | "detail";

export interface Piece {
  id: string;
  slot: Slot;
  name: string;
  brand: string;
  url: string;
  price: number | null;
  image: string;
  colors: { name: string; hex: string }[];
  fabric: string;
  work: string;
  formality: number;
  occasions: Occasion[];
  imageKind: ImageKind;
  /** Established design names for search (weaves, crafts, cuts, bottoms, fabrics). */
  styles: string[];
}
