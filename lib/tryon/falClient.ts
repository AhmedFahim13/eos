// lib/tryon/falClient.ts — browser-side provider that asks our fal route.
import type { Provider } from "./types";

export function falProvider(fetchImpl: typeof fetch = fetch): Provider {
  return {
    id: "fal",
    async run(input) {
      try {
        const res = await fetchImpl("/api/tryon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person: input.person, garment: input.garment, slot: input.slot }),
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.image) return { ok: true, provider: "fal", image: d.image };
        const reason = res.status === 503 || res.status === 429 ? "unavailable" : /balance/i.test(d.message ?? "") ? "quota" : "error";
        return { ok: false, provider: "fal", reason, detail: d.message ?? `HTTP ${res.status}` };
      } catch (e) {
        return { ok: false, provider: "fal", reason: "error", detail: String(e).slice(0, 200) };
      }
    },
  };
}
