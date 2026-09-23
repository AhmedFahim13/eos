// tests/brokenImages.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { useBroken } from "@/lib/brokenImages";

describe("useBroken", () => {
  beforeEach(() => useBroken.setState({ broken: {} }));

  it("marks an id as broken and leaves others alone", () => {
    useBroken.getState().mark("a");
    expect(useBroken.getState().broken).toEqual({ a: true });
    useBroken.getState().mark("b");
    expect(useBroken.getState().broken).toEqual({ a: true, b: true });
  });

  it("marking the same id twice is a no-op", () => {
    useBroken.getState().mark("a");
    const before = useBroken.getState().broken;
    useBroken.getState().mark("a");
    expect(useBroken.getState().broken).toBe(before);
  });
});
