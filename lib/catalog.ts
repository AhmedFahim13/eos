// lib/catalog.ts — Bangladeshi women's-wear catalog, rebuilt weekly by scripts/catalog
// (fetch → tag) and served from /catalog.json. Images proxy through /api/img.
import { create } from "zustand";
import type { Slot } from "./catalog/slots";
import type { Piece } from "./catalog/types";

export * from "./catalog/slots";
export * from "./catalog/types";
export type CatSlot = Slot;

export const CATALOG_URL = "/catalog.json";

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

export function searchPieces(pieces: Piece[], slot: Slot, q: string): Piece[] {
  const term = q.trim().toLowerCase();
  return pieces.filter((p) => {
    if (p.slot !== slot) return false;
    if (!term) return true;
    return `${p.name} ${p.brand} ${p.colors.map((c) => c.name).join(" ")}`.toLowerCase().includes(term);
  });
}
