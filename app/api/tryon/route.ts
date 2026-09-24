// app/api/tryon/route.ts — the paid "stronger model" (fal.ai FASHN). Every call needs the owner's unlock
// code, so visitors cannot spend the fal balance. Free try-on runs in the browser; see lib/tryon/hf.ts.
import { NextRequest, NextResponse } from "next/server";
import { createLimiter } from "@/lib/ratelimit";
import { isWearable, SLOT_VALUES, type Slot } from "@/lib/catalog/slots";
import { verifyCode } from "@/lib/tryon/unlock";
import { callFal, type FalModel } from "@/lib/tryon/falModels";

export const runtime = "nodejs";
export const maxDuration = 120;

const limiter = createLimiter(30, 60 * 60 * 1000);
const wrongCode = createLimiter(5, 60 * 60 * 1000);
const ipOf = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";

/** Checks the code, counting only wrong attempts against the visitor. */
function checkCode(req: NextRequest, code: unknown): NextResponse | null {
  if (verifyCode(code)) return null;
  if (!wrongCode(ipOf(req))) return NextResponse.json({ error: "too_many_attempts", message: "Too many wrong codes. Try again in an hour." }, { status: 429 });
  return NextResponse.json({ error: "locked", message: "That code isn't right." }, { status: 401 });
}

export async function GET() {
  return NextResponse.json({ fal: Boolean(process.env.FAL_KEY) });
}

export async function POST(req: NextRequest) {
  const key = process.env.FAL_KEY;
  if (!key) return NextResponse.json({ error: "no_key", message: "Paid try-on is not configured." }, { status: 503 });

  let body: { person?: string; garment?: string; slot?: string; code?: string; unlock?: boolean; model?: string; description?: string; styles?: unknown };
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

  const model: FalModel = body.model === "banana" ? "banana" : "fashn";
  const styles = Array.isArray(body.styles) ? body.styles.filter((x): x is string => typeof x === "string").slice(0, 8) : [];
  const brief = { slot: slot as Slot, description: String(body.description ?? "").slice(0, 120), styles };
  try {
    const r = await callFal(key, model, person, garment, brief);
    return "image" in r ? NextResponse.json({ image: r.image }) : NextResponse.json({ error: "provider_error", message: r.error }, { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: "fetch_failed", detail: String(e).slice(0, 160) }, { status: 500 });
  }
}
