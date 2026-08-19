// lib/photostore.ts — state for the image-based experience: catalog selection,
// the deterministic outfit Board, saved looks. No AI generation.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useCatalog, type CatSlot } from "./catalog";

export type ViewMode = "photo" | "library" | "3d";

interface SavedLook {
  id: string;
  name: string;
  equipped: Partial<Record<CatSlot, string>>;
}

interface PhotoState {
  viewMode: ViewMode;
  equipped: Partial<Record<CatSlot, string>>;
  active: string | null;
  tab: CatSlot;
  query: string;
  savedLooks: SavedLook[];

  setViewMode: (v: ViewMode) => void;
  setTab: (s: CatSlot) => void;
  setQuery: (q: string) => void;
  pick: (id: string) => void;
  clear: () => void;
  saveLook: () => void;
  loadLook: (id: string) => void;
  deleteLook: (id: string) => void;
}

const rid = () => Math.random().toString(36).slice(2, 9);
const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

export const usePhoto = create<PhotoState>()(
  persist(
    (set, get) => ({
      viewMode: "photo",
      equipped: {},
      active: null,
      tab: "dress",
      query: "",
      savedLooks: [],

      setViewMode: (viewMode) => set({ viewMode }),
      setTab: (tab) => set({ tab, query: "" }),
      setQuery: (query) => set({ query }),

      pick: (id) => {
        const p = useCatalog.getState().byId[id];
        if (!p) return;
        const eq = { ...get().equipped };
        if (eq[p.slot] === id) {
          delete eq[p.slot];
          set({ equipped: eq, active: null });
          return;
        }
        eq[p.slot] = id;
        // A dress and separates are mutually exclusive.
        if (p.slot === "dress") {
          delete eq.top;
          delete eq.bottom;
        } else if (p.slot === "top" || p.slot === "bottom") {
          delete eq.dress;
        }
        set({ equipped: eq, active: id });
      },

      clear: () => set({ equipped: {}, active: null }),

      saveLook: () => {
        const { equipped, savedLooks } = get();
        if (Object.keys(equipped).length === 0) return;
        set({ savedLooks: [...savedLooks, { id: rid(), name: `Look ${savedLooks.length + 1}`, equipped: { ...equipped } }] });
      },
      loadLook: (id) => {
        const l = get().savedLooks.find((x) => x.id === id);
        if (l) set({ equipped: { ...l.equipped }, active: null });
      },
      deleteLook: (id) => set({ savedLooks: get().savedLooks.filter((x) => x.id !== id) }),
    }),
    {
      name: "eos-photo",
      skipHydration: true,
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : noopStorage)),
      partialize: (s) => ({ equipped: s.equipped, savedLooks: s.savedLooks, viewMode: s.viewMode }),
    }
  )
);
