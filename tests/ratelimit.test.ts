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

  it("prunes stale keys once the map grows past 10,000 entries", () => {
    let t = 0;
    const allow = createLimiter(1, 1000, () => t);
    for (let i = 0; i < 10_001; i++) allow(`k${i}`);
    expect(allow.size).toBe(10_001);
    t = 2000; // every existing hit is now outside the window
    allow("new"); // triggers the >MAX_KEYS prune
    expect(allow.size).toBeLessThan(10_001);
  });
});
