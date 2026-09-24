// lib/ai/gemini.ts — one JSON-mode call to the Gemini API (free tier, Flash-Lite by default).
export class QuotaError extends Error {}

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export interface GenerateOptions {
  parts: Part[];
  schema: object;
  model?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function generateJSON<T>(opts: GenerateOptions): Promise<T> {
  const key = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = opts.model || process.env.GEMINI_TEXT_MODEL || "gemini-flash-lite-latest";
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: opts.parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: opts.schema, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  if (res.status === 429) throw new QuotaError(await res.text());
  if (!res.ok) {
    const body = await res.text();
    if (/RESOURCE_EXHAUSTED|quota/i.test(body)) throw new QuotaError(body);
    throw new Error(`gemini ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const parts: { text?: string }[] = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("gemini: empty response");
  return JSON.parse(text) as T;
}
