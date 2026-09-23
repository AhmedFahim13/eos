"use client";
import { useEffect, useMemo } from "react";
import { useCatalog, imgUrl } from "@/lib/catalog";
import { usePhoto } from "@/lib/photostore";
import { useBroken } from "@/lib/brokenImages";

// A cheap 32-bit multiplicative (×31) hash used only to give the library a fixed, mixed-looking order
// (deterministic, so it stays pure inside useMemo — no Math.random()).
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}

// A full-bleed masonry montage of real brand lookbook shots — a fashion wall.
export function Library() {
  const { pieces, status, load } = useCatalog();
  const { pick, setViewMode } = usePhoto();
  const { broken, mark } = useBroken();
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    return [...pieces].filter((p) => !broken[p.id]).sort((a, b) => hash(a.id) - hash(b.id)).slice(0, 120);
  }, [pieces, broken]);

  return (
    <div className="pointer-events-auto absolute inset-0 overflow-y-auto px-3 pb-24 pt-20 md:px-8">
      <div className="mx-auto max-w-5xl columns-2 gap-2 sm:columns-3 md:columns-4 [column-fill:_balance]">
        {shown.map((p) => (
          <button key={p.id} onClick={() => { pick(p.id); setViewMode("photo"); }} className="mb-2 block w-full overflow-hidden rounded-xl bg-white/40 shadow-sm transition hover:opacity-90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl(p.image)} alt={p.name} loading="lazy" onError={() => mark(p.id)} className="w-full" />
          </button>
        ))}
        {status !== "ready" && <p className="col-span-full py-10 text-center text-xs opacity-50" style={{ color: "var(--text)" }}>Loading library…</p>}
      </div>
    </div>
  );
}
