// tests/tryon/unlock.test.ts
import { describe, expect, it } from "vitest";
import { hashCode, verifyCode } from "@/lib/tryon/unlock";
import { strongOrder } from "@/lib/tryon/chain";

describe("verifyCode", () => {
  it("accepts the owner's code and nothing else", () => {
    expect(verifyCode("3565")).toBe(true);
    expect(verifyCode("3566")).toBe(false);
    expect(verifyCode("")).toBe(false);
    expect(verifyCode(3565)).toBe(false);
    expect(verifyCode("x".repeat(100))).toBe(false);
  });
  it("uses an overriding hash when one is configured", () => {
    expect(verifyCode("1234", hashCode("1234"))).toBe(true);
    expect(verifyCode("3565", hashCode("1234"))).toBe(false);
  });
});

describe("strongOrder", () => {
  it("puts fal first and keeps the free models as backup", () => {
    expect(strongOrder("saree")).toEqual(["fal", "ootd", "idm"]);
    expect(strongOrder("top")).toEqual(["fal", "idm", "ootd"]);
  });
});
