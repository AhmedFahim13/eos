// tests/tryon/hf.test.ts
import { describe, expect, it, vi } from "vitest";
import { classifyError, firstImageUrl, makeProvider, ootdCategory } from "@/lib/tryon/hf";
import type { TryOnInput } from "@/lib/tryon/types";

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
    expect(classifyError(new Error("CUDA error"))).toBe("error");
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
});
