// app/api/tryon/route.ts — the paid "stronger model" (fal.ai FASHN). Every call needs the owner's unlock
// code, so visitors cannot spend the fal balance. Free try-on runs in the browser; see lib/tryon/hf.ts.
import { NextRequest, NextResponse } from "next/server";
import { createLimiter } from "@/lib/ratelimit";
import { isWearable, SLOT_VALUES, type Slot } from "@/lib/catalog/slots";
import { verifyCode } from "@/lib/tryon/unlock";

export const runtime = "nodejs";
export const maxDuration = 60;

const limiter = createLimiter(30, 60 * 60 * 1000);
const wrongCode = createLimiter(5, 60 * 60 * 1000);
const ipOf = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";

/** Checks the code, counting only wrong attempts against the visitor. */
function checkCode(req: NextRequest, code: unknown): NextResponse | null {
  if (verifyCode(code)) return null;
  if (!wrongCode(ipOf(req))) return NextResponse.json({ error: "too_many_attempts", message: "Too many wrong codes. Try again in an hour." }, { status: 429 });
  return NextResponse.json({ error: "locked", message: "That code isn't right." }, { status: 401 });
}
const category = (slot: Slot) => (slot === "top" || slot === "kurti" ? "tops" : slot === "bottom" ? "bottoms" : "one-pieces");

export async function GET() {
  return NextResponse.json({ fal: Boolean(process.env.FAL_KEY) });
}

export async function POST(req: NextRequest) {
  const key = process.env.FAL_KEY;
  if (!key) return NextResponse.json({ error: "no_key", message: "Paid try-on is not configured." }, { status: 503 });

  let body: { person?: string; garment?: string; slot?: string; code?: string; unlock?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const denied = checkCode(req, body.code);
  if (denied) return denied;
  if (body.unlock) return NextResponse.json({ ok: true });
  const { person, garment, slot } = body;
  if (!person?.startsWith("data:image/") || !garment?.startsWith("https://") || !SLOT_VALUES.includes(slot as Slot) || !isWearable(slot as Slot)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (person.length > 8_000_000) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  if (!limiter(ipOf(req))) {
    return NextResponse.json({ error: "rate_limited", message: "Too many try-ons this hour. Please try later." }, { status: 429 });
  }

  try {
    const res = await fetch("https://fal.run/fal-ai/fashn/tryon/v1.6", {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model_image: person, garment_image: garment, category: category(slot as Slot), mode: "performance" }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      const message = /balance|locked|exhausted|credit|402/i.test(detail) ? "fal.ai balance is used up." : "Try-on failed. Please try again.";
      return NextResponse.json({ error: "provider_error", message, detail }, { status: 502 });
    }
    const j = await res.json();
    const url: string | undefined = j?.image?.url || j?.images?.[0]?.url;
    if (!url) return NextResponse.json({ error: "no_output" }, { status: 502 });
    const img = await fetch(url);
    if (!img.ok) return NextResponse.json({ error: "no_output" }, { status: 502 });
    const ct = img.headers.get("content-type") || "image/png";
    const b64 = Buffer.from(await img.arrayBuffer()).toString("base64");
    return NextResponse.json({ image: `data:${ct};base64,${b64}` });
  } catch (e) {
    return NextResponse.json({ error: "fetch_failed", detail: String(e).slice(0, 160) }, { status: 500 });
  }
}
