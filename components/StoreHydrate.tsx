"use client";
import { useEffect } from "react";
import { useEos } from "@/lib/store";
import { usePhoto } from "@/lib/photostore";

// Rehydrate persisted stores after mount (both use skipHydration) so the
// server-rendered defaults match the first client render — no hydration mismatch.
export function StoreHydrate() {
  useEffect(() => {
    useEos.persist.rehydrate();
    usePhoto.persist.rehydrate();
  }, []);
  return null;
}
