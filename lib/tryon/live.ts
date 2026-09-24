// lib/tryon/live.ts — browser wiring: free Spaces called directly (visitor's own quota); the paid model
// (fal) only when the owner has unlocked it with their code, and then it goes first.
import { judge } from "@/lib/judge/judge";
import { loadPixels } from "@/lib/judge/browser";
import { providerOrder, strongOrder } from "./chain";
import { falProvider } from "./falClient";
import type { FitDeps } from "./fit";
import { idmProvider, ootdProvider, type HfDeps } from "./hf";

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(b);
  });

const hf: HfDeps = {
  async loadImage(src) {
    const res = await fetch(src.startsWith("data:") ? src : `/api/img?u=${encodeURIComponent(src)}`);
    if (!res.ok) throw new Error(`image ${res.status}`);
    return res.blob();
  },
  async fetchResult(url) {
    const res = await fetch(`/api/result?u=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`result ${res.status}`);
    return blobToDataUrl(await res.blob());
  },
};

export async function liveDeps(unlockCode: string | null = null): Promise<FitDeps> {
  return {
    providers: { ootd: ootdProvider(hf), idm: idmProvider(hf), fal: unlockCode ? falProvider(unlockCode) : undefined },
    orderFor: (slot) => (unlockCode ? strongOrder(slot) : providerOrder(slot, false)),
    judge: async (person, result, piece) => judge(await loadPixels(person), await loadPixels(result), piece),
  };
}
