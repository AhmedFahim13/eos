// tests/tryon/hf.test.ts
import { describe, expect, it, vi } from "vitest";
import { classifyError, firstImageUrl, makeProvider, ootdCategory, runJob } from "@/lib/tryon/hf";
import type { TryOnInput } from "@/lib/tryon/types";
import type { Client } from "@gradio/client";

const input: TryOnInput = { person: "data:image/jpeg;base64,x", garment: "https://g", slot: "saree", description: "red saree" };
const deps = () => ({
  loadImage: vi.fn().mockResolvedValue(new Blob(["x"])),
  fetchResult: vi.fn().mockResolvedValue("data:image/png;base64,R"),
});

describe("ootdCategory", () => {
  it("maps slots to OOTDiffusion categories", () => {
    expect(ootdCategory("saree")).toBe("Dress");
    expect(ootdCategory("set3")).toBe("Dress");
    expect(ootdCategory("kurti")).toBe("Upper-body");
    expect(ootdCategory("top")).toBe("Upper-body");
    expect(ootdCategory("bottom")).toBe("Lower-body");
  });
});

describe("classifyError", () => {
  it("recognises quota and downtime", () => {
    expect(classifyError(new Error("You have exceeded your GPU quota (60s requested vs. 0s left)."))).toBe("quota");
    expect(classifyError({ message: "ZeroGPU quota exceeded" })).toBe("quota");
    expect(classifyError(new Error("Space is sleeping"))).toBe("unavailable");
    expect(classifyError(new Error("try-on timed out"))).toBe("unavailable");
    expect(classifyError(new Error("This application is currently busy. Please try again."))).toBe("unavailable");
    expect(classifyError(new Error("No GPU was available after 60s"))).toBe("unavailable");
    expect(classifyError(new Error("CUDA error"))).toBe("error");
    expect(classifyError(new Error("FileNotFoundError: model.bin not found"))).toBe("error");
    expect(classifyError(new Error("ZeroGPU worker error"))).toBe("error");
  });
});

describe("firstImageUrl", () => {
  it("finds the first url in Gradio output shapes", () => {
    expect(firstImageUrl([{ url: "https://a/1.png", path: "p" }, { url: "https://a/2.png" }])).toBe("https://a/1.png");
    expect(firstImageUrl([[{ image: { url: "https://a/g.png" }, caption: null }]])).toBe("https://a/g.png");
    expect(firstImageUrl(["https://a/s.png"])).toBe("https://a/s.png");
    expect(firstImageUrl([null, { caption: "x" }])).toBeNull();
  });
});

describe("makeProvider", () => {
  it("returns the fetched image on success", async () => {
    const d = deps();
    const p = makeProvider("ootd", async () => [[{ image: { url: "https://x.hf.space/file=o.png" } }]], d);
    await expect(p.run(input)).resolves.toEqual({ ok: true, provider: "ootd", image: "data:image/png;base64,R" });
    expect(d.fetchResult).toHaveBeenCalledWith("https://x.hf.space/file=o.png");
    expect(d.loadImage).toHaveBeenCalledTimes(2);
  });
  it("classifies thrown errors", async () => {
    const p = makeProvider("idm", async () => { throw new Error("exceeded your GPU quota"); }, deps());
    await expect(p.run(input)).resolves.toMatchObject({ ok: false, provider: "idm", reason: "quota" });
  });
  it("fails when the response has no image", async () => {
    const p = makeProvider("idm", async () => [null], deps());
    await expect(p.run(input)).resolves.toMatchObject({ ok: false, reason: "error" });
  });
  it("aborts the signal passed to call when the timeout fires", async () => {
    let sig: AbortSignal | undefined;
    const p = makeProvider("ootd", (_input, _person, _garment, signal) => {
      sig = signal;
      return new Promise(() => {}); // never resolves — only the timeout ends the run
    }, { ...deps(), timeoutMs: 20 });
    const res = await p.run(input);
    expect(res).toMatchObject({ ok: false, provider: "ootd", reason: "unavailable" });
    expect(sig?.aborted).toBe(true);
  });
});

// A fake @gradio/client job: an async-iterable that yields fixed events, plus the
// cancel()/return() surface runJob relies on for abort handling.
function fakeJob(events: unknown[]) {
  let i = 0;
  const cancel = vi.fn(async () => {});
  const ret = vi.fn(async () => ({ done: true as const, value: undefined }));
  const iterable = {
    [Symbol.asyncIterator]() { return this; },
    next: vi.fn(async () => {
      if (i < events.length) return { done: false, value: events[i++] };
      return { done: true, value: undefined };
    }),
    cancel,
    return: ret,
  };
  return { iterable, cancel, return: ret };
}

// A job whose next() never settles on its own — only cancel()/return() end it — for
// simulating an abort that arrives while the job is still running.
function fakeHangingJob() {
  let settle: (() => void) | null = null;
  const cancel = vi.fn(async () => settle?.());
  const ret = vi.fn(async () => { settle?.(); return { done: true as const, value: undefined }; });
  const iterable = {
    [Symbol.asyncIterator]() { return this; },
    next: vi.fn(() => new Promise<IteratorResult<unknown>>((resolve) => {
      settle = () => resolve({ done: true, value: undefined });
    })),
    cancel,
    return: ret,
  };
  return { iterable, cancel, return: ret };
}

function fakeApp(job: ReturnType<typeof fakeJob>["iterable"] | ReturnType<typeof fakeHangingJob>["iterable"]) {
  const close = vi.fn();
  const submit = vi.fn(() => job);
  return { app: { submit, close } as unknown as Client, submit, close };
}

describe("runJob", () => {
  it("requests all_events from submit", async () => {
    const { iterable } = fakeJob([{ type: "data", data: [{ url: "https://x.hf.space/file=a.png" }] }]);
    const { app, submit } = fakeApp(iterable);
    await runJob(app, "/x", { a: 1 }, new AbortController().signal);
    expect(submit).toHaveBeenCalledWith("/x", { a: 1 }, undefined, undefined, true);
  });

  it("throws the Space's message on a status:error event", async () => {
    const { iterable } = fakeJob([
      { type: "status", stage: "error", message: "You have exceeded your GPU quota (60s requested vs. 0s left)." },
    ]);
    const { app } = fakeApp(iterable);
    await expect(runJob(app, "/x", {}, new AbortController().signal)).rejects.toThrow(
      "You have exceeded your GPU quota (60s requested vs. 0s left).",
    );
  });

  it("classifies a status:error quota message through makeProvider", async () => {
    const p = makeProvider("ootd", async (_input, _person, _garment, signal) => {
      const { iterable } = fakeJob([
        { type: "status", stage: "error", message: "You have exceeded your GPU quota (60s requested vs. 0s left)." },
      ]);
      const { app } = fakeApp(iterable);
      return runJob(app, "/x", {}, signal);
    }, deps());
    await expect(p.run(input)).resolves.toEqual({
      ok: false, provider: "ootd", reason: "quota",
      detail: "You have exceeded your GPU quota (60s requested vs. 0s left).",
    });
  });

  it("ignores a pending status event and resolves with the data event", async () => {
    const { iterable } = fakeJob([
      { type: "status", stage: "pending" },
      { type: "data", data: [{ url: "https://x.hf.space/file=a.png" }] },
    ]);
    const { app } = fakeApp(iterable);
    await expect(runJob(app, "/x", {}, new AbortController().signal)).resolves.toEqual([
      { url: "https://x.hf.space/file=a.png" },
    ]);
  });

  it("rejects on an already-aborted signal without calling submit, and closes the client", async () => {
    const { iterable } = fakeJob([]);
    const { app, submit, close } = fakeApp(iterable);
    const controller = new AbortController();
    controller.abort();
    await expect(runJob(app, "/x", {}, controller.signal)).rejects.toThrow("try-on timed out");
    expect(submit).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it("cancels and closes on abort mid-job, and settles the promise", async () => {
    const { iterable, cancel, return: ret } = fakeHangingJob();
    const { app, close } = fakeApp(iterable);
    const controller = new AbortController();
    const promise = runJob(app, "/x", {}, controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow();
    expect(cancel).toHaveBeenCalled();
    expect(ret).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
