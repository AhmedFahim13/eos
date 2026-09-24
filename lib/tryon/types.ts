// lib/tryon/types.ts — one interface for every try-on model.
import type { Slot } from "@/lib/catalog/slots";

export type ProviderId = "ootd" | "idm" | "fal" | "banana";

export interface TryOnInput {
  /** The person photo as a data URL. */
  person: string;
  /** The garment image: a brand https URL or a data URL. */
  garment: string;
  slot: Slot;
  /** Short garment description, e.g. "maroon georgette saree". */
  description: string;
  /** Established design names, passed to instruction-following models. */
  styles?: string[];
}

export type TryOnResult =
  | { ok: true; provider: ProviderId; image: string }
  | { ok: false; provider: ProviderId; reason: "quota" | "unavailable" | "error"; detail: string };

export interface Provider {
  id: ProviderId;
  run(input: TryOnInput): Promise<TryOnResult>;
}

export type Providers = Partial<Record<ProviderId, Provider>>;
