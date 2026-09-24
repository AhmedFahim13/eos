// lib/tryon/chain.ts — which model to ask first, and falling through to the next.
import type { Slot } from "@/lib/catalog/slots";
import type { ProviderId, Providers, TryOnInput, TryOnResult } from "./types";

/** OOTDiffusion handles full-length pieces; IDM-VTON is upper-body only, so it never gets a saree or a set
 * (it would dress the top half and leave the rest); fal is the paid last resort. */
export function providerOrder(slot: Slot, hasFal: boolean): ProviderId[] {
  const base: ProviderId[] = slot === "top" ? ["idm", "ootd"] : slot === "kurti" ? ["ootd", "idm"] : ["ootd"];
  return hasFal ? [...base, "fal"] : base;
}

export async function runChain(
  input: TryOnInput,
  providers: Providers,
  order: ProviderId[],
  exclude: ProviderId[] = [],
): Promise<{ result: TryOnResult; tried: TryOnResult[] }> {
  const tried: TryOnResult[] = [];
  for (const id of order) {
    const p = providers[id];
    if (!p || exclude.includes(id)) continue;
    const r = await p.run(input);
    tried.push(r);
    if (r.ok) return { result: r, tried };
  }
  const last = tried.at(-1);
  return { result: last ?? { ok: false, provider: order[0] ?? "ootd", reason: "unavailable", detail: "no provider available" }, tried };
}

/** Every model said "no GPU left" or was down, and at least one was a quota answer. */
export function outOfCapacity(tried: TryOnResult[]): boolean {
  return tried.some((r) => !r.ok && r.reason === "quota")
    && tried.every((r) => !r.ok && (r.reason === "quota" || r.reason === "unavailable"));
}

/** The unlocked "stronger model" path: Nano Banana Pro, then FASHN, then the free models. */
export function strongOrder(slot: Slot): ProviderId[] {
  return ["banana", "fal", ...providerOrder(slot, false)];
}
