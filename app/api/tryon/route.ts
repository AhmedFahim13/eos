import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
const FAL_KEY = process.env.FAL_KEY || "";
type Result = { status: number; body: Record<string, unknown> };

async function viaPollinations(prompt: string): Promise<Result> {
  const seed = Math.floor(Math.random() * 1000000);
  const base = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=1024&nologo=true&seed=${seed}`;
  let lastDetail = "";
  for (const model of ["flux", "turbo", "sana"]) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 55000);
      const res = await fetch(`${base}&model=${model}`, { signal: ctl.signal });
      clearTimeout(t);
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.startsWith("image/")) {
        const buf = Buffer.from(await res.arrayBuffer());
        return { status: 200, body: { image: `data:${ct};base64,${buf.toString("base64")}` } };
      }
      lastDetail = `${model}: ${res.status}`;
    } catch (e) { lastDetail = `${model}: ${String(e).slice(0, 80)}`; }
  }
  return { status: 502, body: { error: "provider_error", message: "The free renderer is busy — please try again.", detail: lastDetail } };
}

async function viaFal(person: string, garment: string): Promise<Result> {
  if (!FAL_KEY) return { status: 503, body: { error: "no_key", message: "Real-photo try-on needs a fal.ai key (FAL_KEY)." } };
  try {
    const res = await fetch("https://fal.run/fal-ai/fashn/tryon/v1.6", { method: "POST", headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model_image: person, garment_image: garment, category: "auto", mode: "performance" }) });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      const msg = /balance|locked|exhausted|credit|402/i.test(detail) ? "fal.ai needs a balance top-up." : "Try-on failed — please try again.";
      return { status: 502, body: { error: "provider_error", message: msg, detail } };
    }
    const j = await res.json();
    const url = j?.image?.url || j?.images?.[0]?.url;
    if (!url) return { status: 502, body: { error: "no_output", detail: JSON.stringify(j).slice(0, 200) } };
    return { status: 200, body: { image: url } };
  } catch (e) { return { status: 500, body: { error: "fetch_failed", detail: String(e).slice(0, 160) } }; }
}

async function viaGemini(images: string[], prompt: string): Promise<Result> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 503, body: { error: "no_key", message: "Gemini mode needs a key with billing." } };
  const parts = [{ text: prompt }, ...images.map((d) => ({ inline_data: { mime_type: "image/png", data: d.includes(",") ? d.split(",")[1] : d } }))];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }] }) });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    const msg = res.status === 429 || /quota|billing|RESOURCE_EXHAUSTED/i.test(detail) ? "Google's free tier excludes image generation — needs billing." : "Render failed — please try again.";
    return { status: 502, body: { error: "provider_error", message: msg, detail } };
  }
  const json = await res.json();
  const parts2 = json?.candidates?.[0]?.content?.parts ?? [];
  const img = parts2.find((p: Record<string, { data?: string }>) => p.inlineData || p.inline_data);
  const out = img?.inlineData?.data || img?.inline_data?.data;
  if (!out) return { status: 502, body: { error: "no_output" } };
  return { status: 200, body: { image: `data:image/png;base64,${out}` } };
}

export async function POST(req: NextRequest) {
  let body: { mode?: string; provider?: string; images?: string[]; prompt?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const mode = body.mode === "photo" ? "photo" : "look";
  const provider = body.provider ?? (mode === "photo" ? "fal" : "pollinations");
  const images = (body.images ?? []).filter(Boolean);
  let r: Result;
  if (mode === "look") {
    r = provider === "gemini" ? await viaGemini(images, body.prompt || "") : await viaPollinations(body.prompt || "Editorial fashion photograph, photorealistic.");
  } else {
    if (images.length < 2) return NextResponse.json({ error: "need_two", message: "Add a person photo and a garment image." }, { status: 400 });
    r = provider === "gemini" ? await viaGemini(images, body.prompt || "") : await viaFal(images[0], images[1]);
  }
  return NextResponse.json(r.body, { status: r.status });
}
