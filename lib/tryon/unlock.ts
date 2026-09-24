// lib/tryon/unlock.ts — the owner's code that unlocks the paid model (fal.ai). Only a salted hash lives in
// the repo; FAL_CODE_HASH in the environment overrides it, so the code can change without a commit.
import { createHash, timingSafeEqual } from "node:crypto";

const SALT = "eos-fal:";
const DEFAULT_HASH = "8e5dbf340984dad648f8e8c923bd47001c28408c027b580b020efda7988f9730";

export const hashCode = (code: string) => createHash("sha256").update(SALT + code).digest("hex");

export function verifyCode(code: unknown, expected = process.env.FAL_CODE_HASH || DEFAULT_HASH): boolean {
  if (typeof code !== "string" || code.length === 0 || code.length > 64) return false;
  const a = Buffer.from(hashCode(code), "hex"), b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
