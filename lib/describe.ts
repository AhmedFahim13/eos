// lib/describe.ts — turn the current styled look into a text prompt for the
// free text-to-image renderer (Pollinations).
import { useEos } from "./store";
import { BY_ID, FABRICS } from "./garments";
import { MOODS } from "./moods";

const COLOR_NAMES: Record<string, string> = {
  "#efe7dc": "ivory", "#d8cfc4": "stone", "#c9a98f": "camel", "#b9b3c9": "lavender-grey",
  "#8fa9a0": "sage green", "#7a2f39": "wine red", "#2b2b30": "charcoal", "#1f2733": "navy",
  "#3b3a37": "dark olive", "#c98a8a": "dusty rose", "#6d597a": "plum", "#355070": "indigo",
  "#b56576": "mauve", "#e0a458": "amber", "#0b0b0d": "black", "#3a5a80": "denim blue",
};
const colorName = (hex: string) => COLOR_NAMES[hex.toLowerCase()] || "richly coloured";

export function describeLook(): string {
  const s = useEos.getState();
  const eq = s.equipped;

  const ids: string[] = [];
  if (eq.dress) ids.push(eq.dress);
  else {
    if (eq.top) ids.push(eq.top);
    if (eq.bottom) ids.push(eq.bottom);
  }
  if (eq.outer) ids.push(eq.outer);

  const pieces = ids.map((id) => {
    const g = BY_ID[id];
    const fab = FABRICS[s.fabricOf(id)];
    const pat = s.patternOf(id);
    const print = pat.type === "solid" ? "" : `${pat.type} print `;
    return `a ${colorName(s.colorOf(id))} ${print}${fab.label.toLowerCase()} ${g.name.toLowerCase()}`;
  });

  const outfit = pieces.length ? pieces.join(", ") : "an elegant outfit";
  const m = MOODS[s.mood];

  return (
    `Full-body editorial fashion photograph of an elegant female model wearing ${outfit}. ` +
    `${m.name} mood: ${m.tagline}. Photorealistic, natural fabric texture and drape, ` +
    `soft studio lighting, clean seamless background, sharp detail, shot on 85mm.`
  ).slice(0, 640);
}
