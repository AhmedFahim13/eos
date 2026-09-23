// lib/brokenImages.ts — pieces whose brand image failed to load; hidden instead of shown broken.
import { create } from "zustand";

interface BrokenState {
  broken: Record<string, true>;
  mark: (id: string) => void;
}

export const useBroken = create<BrokenState>((set) => ({
  broken: {},
  mark: (id) => set((s) => (s.broken[id] ? s : { broken: { ...s.broken, [id]: true } })),
}));
