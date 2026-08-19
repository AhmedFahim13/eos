// lib/store.ts — app state: active mood + wardrobe, persisted to localStorage.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MoodId } from "./moods";
import { BY_ID, type Slot, type FabricId } from "./garments";
import { DEFAULT_PATTERN, type PatternSpec } from "./pattern";

export interface SavedLook {
  id: string;
  name: string;
  equipped: Partial<Record<Slot, string>>;
  colors: Record<string, string>;
  patterns: Record<string, PatternSpec>;
  fabrics: Record<string, FabricId>;
}

interface EosState {
  mood: MoodId;
  equipped: Partial<Record<Slot, string>>;
  colors: Record<string, string>; // garmentId -> hex
  patterns: Record<string, PatternSpec>; // garmentId -> print
  fabrics: Record<string, FabricId>; // garmentId -> fabric
  active: string | null; // garment whose colour/print/fabric the studio edits
  savedLooks: SavedLook[];

  setMood: (m: MoodId) => void;
  toggleGarment: (id: string) => void;
  setActive: (id: string | null) => void;
  setColor: (id: string, hex: string) => void;
  setPattern: (id: string, patch: Partial<PatternSpec>) => void;
  setFabric: (id: string, fabric: FabricId) => void;
  saveLook: () => void;
  loadLook: (id: string) => void;
  deleteLook: (id: string) => void;
  colorOf: (id: string) => string;
  patternOf: (id: string) => PatternSpec;
  fabricOf: (id: string) => FabricId;
}

const rid = () => Math.random().toString(36).slice(2, 9);

// SSR-safe: localStorage in the browser, a no-op on the server.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useEos = create<EosState>()(
  persist(
    (set, get) => ({
      mood: "elegant",
      equipped: { dress: "gown" },
      colors: {},
      patterns: {},
      fabrics: {},
      active: "gown",
      savedLooks: [],

      setMood: (mood) => set({ mood }),

      toggleGarment: (id) => {
        const g = BY_ID[id];
        if (!g) return;
        const eq = { ...get().equipped };
        if (eq[g.slot] === id) {
          delete eq[g.slot]; // toggle off
          set({ equipped: eq, active: null });
          return;
        }
        eq[g.slot] = id;
        // Dresses and separates are mutually exclusive.
        if (g.slot === "dress") {
          delete eq.top;
          delete eq.bottom;
        } else if (g.slot === "top" || g.slot === "bottom") {
          delete eq.dress;
        }
        set({ equipped: eq, active: id });
      },

      setActive: (active) => set({ active }),
      setColor: (id, hex) => set({ colors: { ...get().colors, [id]: hex } }),

      setPattern: (id, patch) =>
        set({ patterns: { ...get().patterns, [id]: { ...get().patternOf(id), ...patch } } }),

      setFabric: (id, fabric) => set({ fabrics: { ...get().fabrics, [id]: fabric } }),

      colorOf: (id) => get().colors[id] ?? BY_ID[id]?.defaultColor ?? "#cccccc",
      patternOf: (id) => get().patterns[id] ?? DEFAULT_PATTERN,
      fabricOf: (id) => get().fabrics[id] ?? BY_ID[id]?.fabric ?? "satin",

      saveLook: () => {
        const { equipped, colors, patterns, fabrics, savedLooks } = get();
        const look: SavedLook = {
          id: rid(),
          name: `Look ${savedLooks.length + 1}`,
          equipped: { ...equipped },
          colors: { ...colors },
          patterns: { ...patterns },
          fabrics: { ...fabrics },
        };
        set({ savedLooks: [...savedLooks, look] });
      },

      loadLook: (id) => {
        const look = get().savedLooks.find((l) => l.id === id);
        if (look)
          set({
            equipped: { ...look.equipped },
            colors: { ...look.colors },
            patterns: { ...(look.patterns ?? {}) },
            fabrics: { ...(look.fabrics ?? {}) },
            active: null,
          });
      },

      deleteLook: (id) => set({ savedLooks: get().savedLooks.filter((l) => l.id !== id) }),
    }),
    {
      name: "eos-wardrobe",
      skipHydration: true, // rehydrate after mount (see StoreHydrate) to avoid SSR mismatch
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage
      ),
      partialize: (s) => ({
        mood: s.mood,
        equipped: s.equipped,
        colors: s.colors,
        patterns: s.patterns,
        fabrics: s.fabrics,
        savedLooks: s.savedLooks,
      }),
    }
  )
);
