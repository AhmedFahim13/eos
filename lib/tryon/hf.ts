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

type Call = (input: TryOnInput, person: Blob, garment: Blob, signal: AbortSignal) => Promise<unknown>;

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
  if (/exceeded your gpu quota|gpu quota|quota exceeded/i.test(m)) return "quota";
  if (/paused|sleeping|building|currently busy|no gpu was available|503|timed out|timeout|could not resolve app config|space.*not found|failed to fetch/i.test(m)) return "unavailable";
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

// Races a promise against an AbortSignal, rejecting with a timeout error when it fires. The
// signal is also handed to `call` so it can cancel the underlying HF job instead of leaving it
// running (and burning the visitor's GPU quota) after we've stopped waiting for it.
function raceAbort<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new Error("try-on timed out"));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => { signal.removeEventListener("abort", onAbort); resolve(v); },
      (e) => { signal.removeEventListener("abort", onAbort); reject(e); },
    );
  });
}

export function makeProvider(id: ProviderId, call: Call, deps: HfDeps): Provider {
  return {
    id,
    async run(input) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), deps.timeoutMs ?? 120_000);
      try {
        const [person, garment] = await Promise.all([deps.loadImage(input.person), deps.loadImage(input.garment)]);
        const data = await raceAbort(call(input, person, garment, controller.signal), controller.signal);
        const url = firstImageUrl(data);
        if (!url) return { ok: false, provider: id, reason: "error", detail: "no image in response" };
        return { ok: true, provider: id, image: await deps.fetchResult(url) };
      } catch (e) {
        return { ok: false, provider: id, reason: classifyError(e), detail: errMsg(e).slice(0, 200) };
      } finally {
        clearTimeout(t);
      }
    },
  };
}

// Submits a job and cancels it (and closes the client's SSE stream) if `signal` aborts before
// the job's "data" event arrives, so a timed-out visitor doesn't keep burning ZeroGPU quota.
async function runJob(app: Client, endpoint: string, data: unknown[] | Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
  const job = app.submit(endpoint, data);
  const onAbort = () => { job.cancel().catch(() => {}); app.close(); };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    for await (const event of job) {
      if (event.type === "data") return event.data;
    }
    throw new Error("no data event");
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

const connect = (space: string, deps: HfDeps) =>
  Client.connect(space, deps.hfToken ? { hf_token: deps.hfToken as `hf_${string}` } : {});

export function ootdProvider(deps: HfDeps): Provider {
  return makeProvider("ootd", async (input, person, garment, signal) => {
    const app = await connect(SPACES.ootd, deps);
    return runJob(app, "/process_dc", {
      vton_img: handle_file(person),
      garm_img: handle_file(garment),
      category: ootdCategory(input.slot),
      n_samples: 1,
      n_steps: 20,
      image_scale: 2,
      seed: -1,
    }, signal);
  }, deps);
}

export function idmProvider(deps: HfDeps): Provider {
  return makeProvider("idm", async (input, person, garment, signal) => {
    const app = await connect(SPACES.idm, deps);
    // Inputs, in order: human (image editor), garment, description, auto-mask, auto-crop, steps, seed.
    return runJob(app, "/tryon", [
      { background: handle_file(person), layers: [], composite: null },
      handle_file(garment),
      input.description,
      true,
      false,
      30,
      42,
    ], signal);
  }, deps);
}
