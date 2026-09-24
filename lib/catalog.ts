// lib/catalog.ts — Bangladeshi women's-wear catalog, rebuilt weekly by scripts/catalog
// (fetch → tag) and served from /catalog.json. Images proxy through /api/img.
import { create } from "zustand";
import type { Slot } from "./catalog/slots";
import type { Piece } from "./catalog/types";
import { ARCHIVE_URL, toArchivePiece } from "./catalog/archive";

export * from "./catalog/slots";
export * from "./catalog/types";
export type CatSlot = Slot;

export const CATALOG_URL = "/catalog.json";

/** "live" is the Bangladeshi catalogue; "archive" is the original foreign-brand one, kept out of sight. */
export type CatalogSource = "live" | "archive";

interface CatalogState {
  source: CatalogSource;
  pieces: Piece[];
  byId: Record<string, Piece>;
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
  setSource: (s: CatalogSource) => void;
}

async function fetchPieces(source: CatalogSource): Promise<Piece[]> {
  if (source === "live") return (await fetch(CATALOG_URL)).json();
  const raw: Parameters<typeof toArchivePiece>[0][] = await (await fetch(ARCHIVE_URL)).json();
  return raw.map(toArchivePiece).filter((p): p is Piece => p !== null);
}

export const useCatalog = create<CatalogState>((set, get) => ({
  source: "live",
  pieces: [],
  byId: {},
  status: "idle",
  load: async () => {
    if (get().status === "loading" || get().status === "ready") return;
    const source = get().source;
    set({ status: "loading" });
    try {
      const pieces = await fetchPieces(source);
      if (get().source !== source) return;
      set({ pieces, byId: Object.fromEntries(pieces.map((p) => [p.id, p])), status: "ready" });
    } catch {
      if (get().source === source) set({ status: "error" });
    }
  },
  setSource: (source) => {
    if (source === get().source) return;
    set({ source, pieces: [], byId: {}, status: "idle" });
    get().load();
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
