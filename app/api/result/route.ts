// GET /api/result?u=<https://*.hf.space/... image> — fetches a try-on result so the browser can
// read its pixels for the judge. Never cached: these images show a real person.
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return new Response("missing url", { status: 400 });
  let url: URL;
  try { url = new URL(u); } catch { return new Response("bad url", { status: 400 }); }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".hf.space")) return new Response("forbidden host", { status: 403 });
  try {
    const res = await fetch(url, { cache: "no-store" });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !(ct.startsWith("image/") || ct === "application/octet-stream")) return new Response("not an image", { status: 502 });
    return new Response(await res.arrayBuffer(), {
      headers: { "Content-Type": ct.startsWith("image/") ? ct : "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
