"use client";
import { useEffect, useMemo } from "react";
import { useCatalog, imgUrl } from "@/lib/catalog";
import { usePhoto } from "@/lib/photostore";

// A full-bleed masonry montage of real brand lookbook shots — a fashion wall.
export function Library() {
  const { pieces, status, load } = useCatalog();
  const { pick, setViewMode } = usePhoto();
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const a = [...pieces];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, 120);
  }, [pieces]);

  return (
    <div className="pointer-events-auto absolute inset-0 overflow-y-auto px-3 pb-24 pt-20 md:px-8">
      <div className="mx-auto max-w-5xl columns-2 gap-2 sm:columns-3 md:columns-4 [column-fill:_balance]">
        {shown.map((p) => (
          <button key={p.id} onClick={() => { pick(p.id); setViewMode("photo"); }} className="mb-2 block w-full overflow-hidden rounded-xl bg-white/40 shadow-sm transition hover:opacity-90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl(p.image)} alt={p.name} loading="lazy" className="w-full" />
          </button>
        ))}
        {status !== "ready" && <p className="col-span-full py-10 text-center text-xs opacity-50" style={{ color: "var(--text)" }}>Loading library…</p>}
      </div>
    </div>
  );
}
