// lib/tryon/falClient.ts — browser-side provider for the paid model; sends the owner's unlock code.
import type { Provider } from "./types";

export function falProvider(code: string, fetchImpl: typeof fetch = fetch): Provider {
  return {
    id: "fal",
    async run(input) {
      try {
        const res = await fetchImpl("/api/tryon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person: input.person, garment: input.garment, slot: input.slot, code }),
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.image) return { ok: true, provider: "fal", image: d.image };
        const reason = res.status === 503 || res.status === 429 || res.status === 401 ? "unavailable" : /balance/i.test(d.message ?? "") ? "quota" : "error";
        return { ok: false, provider: "fal", reason, detail: d.message ?? `HTTP ${res.status}` };
      } catch (e) {
        return { ok: false, provider: "fal", reason: "error", detail: String(e).slice(0, 200) };
      }
    },
  };
}

/** Asks the server whether a code unlocks the paid model, without running a try-on. */
export async function checkUnlock(code: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetchImpl("/api/tryon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, unlock: true }) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, message: d.message ?? "Couldn't check the code." };
  } catch {
    return { ok: false, message: "Couldn't check the code." };
  }
}
