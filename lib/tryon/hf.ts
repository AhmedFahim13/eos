// lib/tryon/hf.ts — free try-on models on Hugging Face ZeroGPU Spaces (APIs checked 2026-09-23).
// Runs in the browser (the visitor's own anonymous quota) and in Node (benchmark, with HF_TOKEN).
import { Client, handle_file } from "@gradio/client";
import type { Slot } from "@/lib/catalog/slots";
import type { Provider, ProviderId, TryOnInput } from "./types";

export const SPACES = { ootd: "levihsu/OOTDiffusion", idm: "yisol/IDM-VTON" } as const;

export interface HfDeps {
  /** Turn a data URL or https URL into a Blob the Space can receive. */
  loadImage: (src: string) => Promise<Blob>;
  /** Turn the Space's temporary result URL into a data URL. */
  fetchResult: (url: string) => Promise<string>;
  hfToken?: string;
  timeoutMs?: number;
}

type Call = (input: TryOnInput, person: Blob, garment: Blob) => Promise<unknown>;

export function ootdCategory(slot: Slot): "Dress" | "Upper-body" | "Lower-body" {
  if (slot === "top" || slot === "kurti") return "Upper-body";
  if (slot === "bottom") return "Lower-body";
  return "Dress";
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

export function classifyError(e: unknown): "quota" | "unavailable" | "error" {
  const m = errMsg(e);
  if (/quota|exceeded your gpu|zerogpu/i.test(m)) return "quota";
  if (/paused|sleeping|building|not found|503|timed out|timeout/i.test(m)) return "unavailable";
  return "error";
}

export function firstImageUrl(data: unknown): string | null {
  if (typeof data === "string") return /^https?:\/\//.test(data) ? data : null;
  if (Array.isArray(data)) {
    for (const d of data) {
      const u = firstImageUrl(d);
      if (u) return u;
    }
    return null;
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.url === "string") return o.url;
    for (const v of Object.values(o)) {
      const u = firstImageUrl(v);
      if (u) return u;
    }
  }
  return null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("try-on timed out")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export function makeProvider(id: ProviderId, call: Call, deps: HfDeps): Provider {
  return {
    id,
    async run(input) {
      try {
        const [person, garment] = await Promise.all([deps.loadImage(input.person), deps.loadImage(input.garment)]);
        const data = await withTimeout(call(input, person, garment), deps.timeoutMs ?? 120_000);
        const url = firstImageUrl(data);
        if (!url) return { ok: false, provider: id, reason: "error", detail: "no image in response" };
        return { ok: true, provider: id, image: await deps.fetchResult(url) };
      } catch (e) {
        return { ok: false, provider: id, reason: classifyError(e), detail: errMsg(e).slice(0, 200) };
      }
    },
  };
}

const connect = (space: string, deps: HfDeps) =>
  Client.connect(space, deps.hfToken ? { hf_token: deps.hfToken as `hf_${string}` } : {});

export function ootdProvider(deps: HfDeps): Provider {
  return makeProvider("ootd", async (input, person, garment) => {
    const app = await connect(SPACES.ootd, deps);
    const r = await app.predict("/process_dc", {
      vton_img: handle_file(person),
      garm_img: handle_file(garment),
      category: ootdCategory(input.slot),
      n_samples: 1,
      n_steps: 20,
      image_scale: 2,
      seed: -1,
    });
    return r.data;
  }, deps);
}

export function idmProvider(deps: HfDeps): Provider {
  return makeProvider("idm", async (input, person, garment) => {
    const app = await connect(SPACES.idm, deps);
    // Inputs, in order: human (image editor), garment, description, auto-mask, auto-crop, steps, seed.
    const r = await app.predict("/tryon", [
      { background: handle_file(person), layers: [], composite: null },
      handle_file(garment),
      input.description,
      true,
      false,
      30,
      42,
    ]);
    return r.data;
  }, deps);
}
