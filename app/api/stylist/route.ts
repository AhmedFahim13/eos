// POST /api/stylist { occasion, budget?, anchorId? } → { suggestions, source }
import { NextRequest, NextResponse } from "next/server";
import catalog from "@/public/catalog.json";
import { generateJSON } from "@/lib/ai/gemini";
import { createLimiter } from "@/lib/ratelimit";
import { OCCASIONS, type Occasion, type Piece } from "@/lib/catalog/types";
import { SUGGEST_SCHEMA } from "@/lib/stylist/prompt";
import { suggest } from "@/lib/stylist/suggest";

export const runtime = "nodejs";

const pieces = catalog as unknown as Piece[];
const limiter = createLimiter(20, 60 * 60 * 1000);

export async function POST(req: NextRequest) {
  let body: { occasion?: string; budget?: number | null; anchorId?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (!OCCASIONS.includes(body.occasion as Occasion)) return NextResponse.json({ error: "bad_occasion" }, { status: 400 });
  const budget = typeof body.budget === "number" && body.budget > 0 ? body.budget : null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const useAi = limiter(ip);
  const result = await suggest(
    pieces,
    { occasion: body.occasion as Occasion, budget, anchorId: body.anchorId ?? null },
    (prompt) => (useAi ? generateJSON({ parts: [{ text: prompt }], schema: SUGGEST_SCHEMA }) : Promise.reject(new Error("rate limited"))),
  );
  return NextResponse.json(result);
}
