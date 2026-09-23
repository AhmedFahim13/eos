// tests/ratelimit.test.ts
import { describe, expect, it } from "vitest";
import { createLimiter } from "@/lib/ratelimit";

describe("createLimiter", () => {
  it("allows up to the limit per key within the window", () => {
    let t = 0;
    const allow = createLimiter(2, 1000, () => t);
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(false);
    expect(allow("b")).toBe(true);
    t = 1001;
    expect(allow("a")).toBe(true);
  });
});
