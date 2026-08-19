// lib/garments.ts — procedural wardrobe silhouettes + real CC0 fabric definitions.
// Each garment is a lathe silhouette in "body space" (x = radius, y = height from
// floor; the figure spans ~0..1.95). Fabrics load real PBR maps from /public/textures.

export type Slot = "dress" | "top" | "bottom" | "outer";
export type FabricId = "satin" | "cotton" | "denim" | "wool" | "leather" | "chiffon";

export interface FabricDef {
  id: FabricId;
  label: string;
  dir: string; // folder under /public/textures
  repeat: number; // weave tiling
  roughness: number;
  metalness: number;
  sheen: number;
  opacity: number;
}

// Real fabrics (Poly Haven, CC0). Maps: color.jpg / normal.jpg / rough.jpg.
export const FABRICS: Record<FabricId, FabricDef> = {
  satin: { id: "satin", label: "Satin", dir: "crepe_satin", repeat: 6, roughness: 0.55, metalness: 0, sheen: 1.0, opacity: 1 },
  cotton: { id: "cotton", label: "Cotton", dir: "cotton_jersey", repeat: 6, roughness: 0.9, metalness: 0, sheen: 0.2, opacity: 1 },
  denim: { id: "denim", label: "Denim", dir: "denim_fabric", repeat: 5, roughness: 0.85, metalness: 0, sheen: 0.1, opacity: 1 },
  wool: { id: "wool", label: "Wool", dir: "caban", repeat: 6, roughness: 0.95, metalness: 0, sheen: 0.15, opacity: 1 },
  leather: { id: "leather", label: "Leather", dir: "brown_leather", repeat: 3, roughness: 0.5, metalness: 0.1, sheen: 0.3, opacity: 1 },
  chiffon: { id: "chiffon", label: "Chiffon", dir: "crepe_georgette", repeat: 7, roughness: 0.6, metalness: 0, sheen: 0.8, opacity: 0.9 },
};

export const FABRIC_LIST = Object.values(FABRICS);

export interface Garment {
  id: string;
  name: string;
  slot: Slot;
  fabric: FabricId; // default fabric
  defaultColor: string;
  profile: [number, number][]; // [radius, height]
}

// Radius nudge per slot to keep layers separated (outer sits widest).
export const SLOT_OFFSET: Record<Slot, number> = {
  top: 0.012,
  bottom: 0.012,
  dress: 0.02,
  outer: 0.05,
};

export const GARMENTS: Garment[] = [
  // ── Dresses ──
  {
    id: "gown", name: "Gown", slot: "dress", fabric: "satin", defaultColor: "#b9b3c9",
    profile: [[0.7, 0.05], [0.55, 0.5], [0.4, 0.9], [0.3, 1.25], [0.35, 1.55], [0.33, 1.72], [0.14, 1.88]],
  },
  {
    id: "slip", name: "Slip", slot: "dress", fabric: "satin", defaultColor: "#c9a98f",
    profile: [[0.33, 0.55], [0.34, 1.0], [0.3, 1.2], [0.33, 1.5], [0.3, 1.6]],
  },
  {
    id: "aline", name: "A-line", slot: "dress", fabric: "chiffon", defaultColor: "#8fa9a0",
    profile: [[0.42, 0.55], [0.32, 1.05], [0.29, 1.2], [0.33, 1.5], [0.34, 1.7], [0.16, 1.85]],
  },
  // ── Tops ──
  {
    id: "blouse", name: "Blouse", slot: "top", fabric: "satin", defaultColor: "#efe7dc",
    profile: [[0.33, 1.05], [0.31, 1.18], [0.35, 1.55], [0.34, 1.72], [0.16, 1.9]],
  },
  {
    id: "cami", name: "Camisole", slot: "top", fabric: "cotton", defaultColor: "#2b2b30",
    profile: [[0.31, 1.08], [0.3, 1.2], [0.32, 1.55]],
  },
  // ── Bottoms ──
  {
    id: "fullskirt", name: "Full skirt", slot: "bottom", fabric: "cotton", defaultColor: "#7a2f39",
    profile: [[0.5, 0.55], [0.34, 1.05], [0.29, 1.2]],
  },
  {
    id: "pencil", name: "Pencil skirt", slot: "bottom", fabric: "denim", defaultColor: "#3a5a80",
    profile: [[0.3, 0.62], [0.33, 1.05], [0.29, 1.2]],
  },
  // ── Layers ──
  {
    id: "coat", name: "Wrap coat", slot: "outer", fabric: "wool", defaultColor: "#3b3a37",
    profile: [[0.5, 0.4], [0.46, 0.9], [0.4, 1.2], [0.42, 1.5], [0.4, 1.72], [0.18, 1.9]],
  },
  {
    id: "shawl", name: "Shawl", slot: "outer", fabric: "wool", defaultColor: "#c98a8a",
    profile: [[0.42, 1.45], [0.44, 1.6], [0.36, 1.75]],
  },
];

export const BY_ID: Record<string, Garment> = Object.fromEntries(GARMENTS.map((g) => [g.id, g]));

export const SLOT_LABELS: { slot: Slot; label: string }[] = [
  { slot: "dress", label: "Dresses" },
  { slot: "top", label: "Tops" },
  { slot: "bottom", label: "Skirts" },
  { slot: "outer", label: "Layers" },
];

// Curated recolor palette (neutrals + jewel + soft accents).
export const SWATCHES = [
  "#efe7dc", "#d8cfc4", "#c9a98f", "#b9b3c9", "#8fa9a0",
  "#7a2f39", "#2b2b30", "#1f2733", "#3b3a37", "#c98a8a",
  "#6d597a", "#355070", "#b56576", "#e0a458", "#0b0b0d",
];
