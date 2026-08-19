// lib/catalog.ts — real women's-fashion catalog, loaded at runtime from a hosted
// JSON (see scripts/scrape.mjs). Images hotlink from brand CDNs. Growing the
// catalog = update the gist; no redeploy needed.
import { create } from "zustand";

export type CatSlot = "dress" | "top" | "bottom" | "outer" | "shoes" | "bag" | "accessory";

export interface Piece {
  id: string;
  slot: CatSlot;
  name: string;
  brand: string;
  color: string;
  image: string;
}

export const CATALOG_URL =
  "https://gist.githubusercontent.com/AhmedFahim13/080209db01b74009048273b849d53a01/raw/catalog.json";

export const SLOTS: { slot: CatSlot; label: string }[] = [
  { slot: "dress", label: "Dresses" },
  { slot: "top", label: "Tops" },
  { slot: "bottom", label: "Bottoms" },
  { slot: "outer", label: "Outerwear" },
  { slot: "shoes", label: "Shoes" },
  { slot: "bag", label: "Bags" },
  { slot: "accessory", label: "Accessories" },
];

export const SLOT_TINT: Record<CatSlot, string> = {
  dress: "#e9dfe8", top: "#e3e7ec", bottom: "#e7e2d8", outer: "#dfe4e0",
  shoes: "#ece2df", bag: "#e8e3ea", accessory: "#efe6dc",
};

interface CatalogState {
  pieces: Piece[];
  byId: Record<string, Piece>;
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
}

export const useCatalog = create<CatalogState>((set, get) => ({
  pieces: [],
  byId: {},
  status: "idle",
  load: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading" });
    try {
      const res = await fetch(CATALOG_URL);
      const pieces: Piece[] = await res.json();
      set({ pieces, byId: Object.fromEntries(pieces.map((p) => [p.id, p])), status: "ready" });
    } catch {
      set({ status: "error" });
    }
  },
}));

// Serve brand images through our cached proxy (fast + reliable everywhere).
export function imgUrl(image: string): string {
  return `/api/img?u=${encodeURIComponent(image)}`;
}

export function searchPieces(pieces: Piece[], slot: CatSlot, q: string): Piece[] {
  const term = q.trim().toLowerCase();
  return pieces.filter((p) => p.slot === slot && (!term || p.name.toLowerCase().includes(term)));
}
