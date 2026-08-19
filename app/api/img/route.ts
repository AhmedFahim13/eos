// GET /api/img?u=<image url> — proxies a brand product image through the app and
// caches it on Vercel's CDN for a year. Accepts any https image (validated by
// response content-type) so every brand's CDN works without an allowlist.
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return new Response("missing url", { status: 400 });
  let url: URL;
  try { url = new URL(u); } catch { return new Response("bad url", { status: 400 }); }
  if (url.protocol !== "https:") return new Response("https only", { status: 403 });
  try {
    const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !ct.startsWith("image/")) return new Response("not an image", { status: 502 });
    const buf = await res.arrayBuffer();
    return new Response(buf, { headers: { "Content-Type": ct, "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
  } catch { return new Response("fetch failed", { status: 502 }); }
}
