// tests/ai/gemini.test.ts
import { describe, expect, it, vi } from "vitest";
import { generateJSON, QuotaError } from "@/lib/ai/gemini";

const ok = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

describe("generateJSON", () => {
  it("parses the JSON text of the first candidate", async () => {
    const f = vi.fn().mockResolvedValue(ok('{"a":1}'));
    const out = await generateJSON<{ a: number }>({ parts: [{ text: "hi" }], schema: {}, apiKey: "k", fetchImpl: f });
    expect(out).toEqual({ a: 1 });
    const [url, init] = f.mock.calls[0];
    expect(url).toContain(":generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("k");
    expect(JSON.parse(init.body).generationConfig.responseMimeType).toBe("application/json");
  });
  it("throws QuotaError on 429", async () => {
    const f = vi.fn().mockResolvedValue(new Response("slow down", { status: 429 }));
    await expect(generateJSON({ parts: [], schema: {}, apiKey: "k", fetchImpl: f })).rejects.toBeInstanceOf(QuotaError);
  });
  it("throws QuotaError on RESOURCE_EXHAUSTED bodies", async () => {
    const f = vi.fn().mockResolvedValue(new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', { status: 400 }));
    await expect(generateJSON({ parts: [], schema: {}, apiKey: "k", fetchImpl: f })).rejects.toBeInstanceOf(QuotaError);
  });
  it("fails without a key", async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    await expect(generateJSON({ parts: [], schema: {} })).rejects.toThrow(/GEMINI_API_KEY/);
    if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
  });
  it("falls back to the default model when GEMINI_TEXT_MODEL is empty", async () => {
    const saved = process.env.GEMINI_TEXT_MODEL;
    process.env.GEMINI_TEXT_MODEL = "";
    const f = vi.fn().mockResolvedValue(ok('{"a":1}'));
    await generateJSON({ parts: [], schema: {}, apiKey: "k", fetchImpl: f });
    expect(f.mock.calls[0][0]).toContain("gemini-flash-lite-latest");
    if (saved === undefined) delete process.env.GEMINI_TEXT_MODEL;
    else process.env.GEMINI_TEXT_MODEL = saved;
  });
});
