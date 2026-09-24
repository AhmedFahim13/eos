// GET /api/result?u=<https://*.hf.space/... image> — fetches a try-on result so the browser can
// read its pixels for the judge. Never cached: these images show a real person.
import { NextRequest } from "next/server";
import { allowedImageType, isAllowedResultUrl } from "@/lib/tryon/resultGuard";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

// Reads the body while enforcing MAX_BYTES, in case content-length was absent or lied about.
async function readCapped(res: Response, max: number): Promise<Uint8Array | null> {
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > max ? null : buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return out;
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return new Response("missing url", { status: 400 });
  if (!isAllowedResultUrl(u)) return new Response("forbidden host", { status: 403 });
  try {
    const res = await fetch(u, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status >= 300 && res.status < 400) return new Response("redirect not allowed", { status: 502 });
    if (!res.ok) return new Response("fetch failed", { status: 502 });
    const len = Number(res.headers.get("content-length") || "0");
    if (len > MAX_BYTES) return new Response("too large", { status: 502 });
    const type = allowedImageType(res.headers.get("content-type") || "");
    if (!type) return new Response("not an image", { status: 502 });
    const body = await readCapped(res, MAX_BYTES);
    if (!body) return new Response("too large", { status: 502 });
    return new Response(body.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
