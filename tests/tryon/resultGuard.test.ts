// tests/tryon/resultGuard.test.ts
import { describe, expect, it } from "vitest";
import { allowedImageType, isAllowedResultUrl } from "@/lib/tryon/resultGuard";

describe("isAllowedResultUrl", () => {
  it("accepts a real hf.space result url", () => {
    expect(isAllowedResultUrl("https://levihsu-ootdiffusion.hf.space/file=/tmp/a.png")).toBe(true);
  });
  it("rejects non-hf.space hosts, including lookalikes", () => {
    expect(isAllowedResultUrl("https://evil.com#.hf.space")).toBe(false);
    expect(isAllowedResultUrl("https://x.hf.space.evil.com")).toBe(false);
    expect(isAllowedResultUrl("https://a.hf.space@evil.com")).toBe(false);
  });
  it("rejects non-https", () => {
    expect(isAllowedResultUrl("http://x.hf.space")).toBe(false);
  });
  it("rejects unparseable urls", () => {
    expect(isAllowedResultUrl("not a url")).toBe(false);
  });
});

describe("allowedImageType", () => {
  it("allows png, jpeg, webp", () => {
    expect(allowedImageType("image/png")).toBe("image/png");
    expect(allowedImageType("image/jpeg")).toBe("image/jpeg");
    expect(allowedImageType("image/webp")).toBe("image/webp");
  });
  it("relabels octet-stream as png", () => {
    expect(allowedImageType("application/octet-stream")).toBe("image/png");
  });
  it("rejects svg and other types", () => {
    expect(allowedImageType("image/svg+xml")).toBeNull();
    expect(allowedImageType("text/html")).toBeNull();
  });
  it("handles a charset suffix", () => {
    expect(allowedImageType("image/png; charset=utf-8")).toBe("image/png");
  });
});
