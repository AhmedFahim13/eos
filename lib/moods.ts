// lib/moods.ts — single source of truth for the four Moods.

export type MoodId = "elegant" | "editorial" | "romantic" | "playful";

// Valid drei <Environment> presets (HDRI served from the pmndrs CDN — no local file).
export type EnvPreset =
  | "apartment" | "city" | "dawn" | "forest" | "lobby"
  | "night" | "park" | "studio" | "sunset" | "warehouse";

export interface Mood {
  id: MoodId;
  name: string;
  tagline: string;
  env: EnvPreset;
  bg: string; // scene clear color
  key: { color: string; intensity: number; position: [number, number, number] };
  ambient: number;
  form: string; // display-form material color
  post: { bloom: number; vignette: number; contrast: number };
  ui: { accent: string; text: string; panel: string };
}

export const MOODS: Record<MoodId, Mood> = {
  elegant: {
    id: "elegant", name: "Elegant", tagline: "soft · refined · timeless",
    env: "studio", bg: "#efe9e1",
    key: { color: "#fff6ec", intensity: 1.1, position: [3, 5, 4] }, ambient: 0.6,
    form: "#d9cec1",
    post: { bloom: 0.15, vignette: 0.3, contrast: 0.03 },
    ui: { accent: "#8a7a68", text: "#2b2622", panel: "rgba(255,252,247,0.72)" },
  },
  editorial: {
    id: "editorial", name: "Editorial", tagline: "dark · dramatic · bold",
    env: "night", bg: "#0c0b0d",
    key: { color: "#ffffff", intensity: 2.6, position: [2.5, 6, 3] }, ambient: 0.1,
    form: "#e8e4de",
    post: { bloom: 0.6, vignette: 0.75, contrast: 0.2 },
    ui: { accent: "#c9a86a", text: "#f3efe9", panel: "rgba(18,17,19,0.55)" },
  },
  romantic: {
    id: "romantic", name: "Romantic", tagline: "warm · dreamy · gentle",
    env: "sunset", bg: "#f6e6df",
    key: { color: "#ffd9c2", intensity: 1.35, position: [-3, 4, 4] }, ambient: 0.55,
    form: "#e7cdc4",
    post: { bloom: 0.42, vignette: 0.32, contrast: 0.04 },
    ui: { accent: "#c98a8a", text: "#4a3a38", panel: "rgba(255,244,240,0.7)" },
  },
  playful: {
    id: "playful", name: "Playful", tagline: "bright · vivid · joyful",
    env: "city", bg: "#fdf3d8",
    key: { color: "#ffffff", intensity: 1.6, position: [0, 5, 5] }, ambient: 0.7,
    form: "#e7b7d0",
    post: { bloom: 0.32, vignette: 0.12, contrast: 0.06 },
    ui: { accent: "#e0518a", text: "#22203a", panel: "rgba(255,255,255,0.78)" },
  },
};

export const MOOD_ORDER: MoodId[] = ["elegant", "editorial", "romantic", "playful"];
