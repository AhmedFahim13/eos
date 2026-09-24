// tests/tryon/falModels.test.ts
import { describe, expect, it, vi } from "vitest";
import { bananaPrompt, callFal, falRequest } from "@/lib/tryon/falModels";

const saree = { slot: "saree" as const, description: "maroon silk saree", styles: ["Jamdani", "Half silk"] };

describe("bananaPrompt", () => {
  it("names the piece, how it is worn, and what must not change", () => {
    const p = bananaPrompt(saree);
    expect(p).toContain("maroon silk saree (Jamdani, Half silk)");
    expect(p).toContain("Nivi style");
    expect(p).toContain("face");
    expect(p).toContain("folded, on a hanger or on a mannequin");
  });
  it("lets the product photo decide how much of the outfit changes", () => {
    const p = bananaPrompt({ slot: "bottom", description: "blue swim short", styles: [] });
    expect(p).toContain("complete look");
    expect(p).toContain("replace only that garment");
    expect(p).not.toContain("keep the person's own top");
  });
  it("keeps a kurti full length", () => {
    expect(bananaPrompt({ slot: "kurti", description: "green kurti", styles: [] })).toContain("full length");
  });
});

describe("falRequest", () => {
  it("sends both images to Nano Banana Pro with the prompt", () => {
    const r = falRequest("banana", "data:image/jpeg;base64,P", "https://g/1.jpg", saree);
    expect(r.url).toContain("nano-banana-pro/edit");
    expect(r.body).toMatchObject({ image_urls: ["data:image/jpeg;base64,P", "https://g/1.jpg"], num_images: 1, resolution: "1K" });
  });
  it("keeps the FASHN request as before", () => {
    const r = falRequest("fashn", "P", "G", { slot: "kurti", description: "", styles: [] });
    expect(r.url).toContain("fashn/tryon/v1.6");
    expect(r.body).toMatchObject({ model_image: "P", garment_image: "G", category: "auto" });
    expect(falRequest("fashn", "P", "G", saree).body).toMatchObject({ category: "one-pieces" });
  });
});

describe("callFal", () => {
  it("returns the result as a data URL", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ images: [{ url: "https://fal.media/out.jpg" }] })))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }));
    await expect(callFal("k", "banana", "P", "G", saree, f)).resolves.toEqual({ image: "data:image/jpeg;base64,AQID" });
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Key k");
  });
  it("reports an empty balance plainly", async () => {
    const f = vi.fn().mockResolvedValue(new Response("User is locked. Reason: Exhausted balance", { status: 403 }));
    await expect(callFal("k", "banana", "P", "G", saree, f)).resolves.toEqual({ error: "fal.ai balance is used up.", status: 502 });
  });
});
