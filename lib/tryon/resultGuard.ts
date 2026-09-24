// lib/tryon/resultGuard.ts — pure checks for the /api/result proxy: a host allowlist (blocks
// SSRF via redirects/lookalike hosts) and a content-type allowlist (blocks SVG-based stored XSS).
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isAllowedResultUrl(u: string): boolean {
  let url: URL;
  try { url = new URL(u); } catch { return false; }
  return url.protocol === "https:" && url.hostname.endsWith(".hf.space");
}

export function allowedImageType(ct: string): string | null {
  const type = ct.split(";")[0].trim().toLowerCase();
  if (ALLOWED_TYPES.has(type)) return type;
  if (type === "application/octet-stream") return "image/png";
  return null;
}
