"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SLOTS, SLOT_TINT, searchPieces, imgUrl, useCatalog } from "@/lib/catalog";
import { ARCHIVE_SLOTS } from "@/lib/catalog/archive";
import { usePhoto } from "@/lib/photostore";
import { useBroken } from "@/lib/brokenImages";

export function Catalog() {
  const { equipped, tab, setTab, query, setQuery, pick, savedLooks, loadLook, deleteLook } = usePhoto();
  const { pieces: all, status, load, source } = useCatalog();
  const tabs = source === "archive" ? ARCHIVE_SLOTS : SLOTS;
  const { broken, mark } = useBroken();
  useEffect(() => { load(); }, [load]);
  const panel = { background: "var(--panel)", color: "var(--text)" } as const;
  // Style chips: the most common design names in this tab (weaves, crafts, cuts, fabrics).
  const [style, setStyle] = useState<string | null>(null);
  const [styleTab, setStyleTab] = useState(tab);
  if (styleTab !== tab) { setStyleTab(tab); setStyle(null); }
  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of all) if (p.slot === tab) for (const s of p.styles ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
    return [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([s]) => s);
  }, [all, tab]);
  const pieces = searchPieces(all, tab, query).filter((p) => !broken[p.id] && (!style || (p.styles ?? []).includes(style)));

  return (
    <>
      <aside className="pointer-events-auto absolute right-3 top-20 bottom-24 flex w-72 flex-col rounded-2xl p-3 backdrop-blur-xl shadow-xl md:right-6 md:w-80" style={panel}>
        <h2 className="mb-2 px-1 font-serif text-lg tracking-wide">{source === "archive" ? "Archive" : "Wardrobe"}</h2>

        <div className="mb-2 flex gap-1 overflow-x-auto pb-1 text-[11px]">
          {tabs.map(({ slot, label }) => (
            <button
              key={slot}
              onClick={() => setTab(slot)}
              className="whitespace-nowrap rounded-full px-2.5 py-1 tracking-wide transition"
              style={{
                background: tab === slot ? "var(--accent)" : "transparent",
                color: tab === slot ? "#fff" : "var(--text)",
                border: `1px solid ${tab === slot ? "var(--accent)" : "rgba(128,128,128,0.3)"}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {chips.length > 0 && (
          <div className="mb-2 flex gap-1 overflow-x-auto pb-1 text-[10px]">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => setStyle(style === c ? null : c)}
                className="whitespace-nowrap rounded-full px-2.5 py-1 tracking-wide transition"
                style={{
                  background: style === c ? "var(--text)" : "rgba(128,128,128,0.12)",
                  color: style === c ? "#fff" : "var(--text)",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${pieces.length} pieces…`}
          className="mb-2 rounded-full px-3 py-1.5 text-xs outline-none"
          style={{ background: "rgba(128,128,128,0.12)", color: "var(--text)" }}
        />

        <div className="grid flex-1 auto-rows-max grid-cols-2 gap-2 overflow-y-auto pr-1">
          {pieces.map((p) => {
            const on = equipped[p.slot] === p.id;
            return (
              <button
                key={p.id}
                onClick={() => pick(p.id)}
                className="group relative block overflow-hidden rounded-xl text-left transition hover:z-10 hover:scale-[1.06] hover:shadow-lg"
                style={{ background: SLOT_TINT[p.slot], outline: on ? "2px solid var(--accent)" : "1px solid rgba(128,128,128,0.18)", outlineOffset: -1 }}
              >
                <div className="flex h-32 w-full items-center justify-center p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl(p.image)} alt={p.name} loading="lazy" onError={() => mark(p.id)} className="max-h-full max-w-full object-contain" />
                </div>
                <span className="block truncate bg-white/70 px-1.5 pt-1 text-[10px] font-medium tracking-wide text-neutral-700">{p.name}</span>
                <span className="block truncate bg-white/70 px-1.5 pb-1 text-[9px] tracking-wide text-neutral-500">
                  {p.brand}{p.price ? ` · ৳${p.price.toLocaleString("en-IN")}` : ""}
                </span>
                {on && (
                  <span className="absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] text-white" style={{ background: "var(--accent)" }}>✓</span>
                )}
              </button>
            );
          })}
          {pieces.length === 0 && (
            <p className="col-span-2 py-6 text-center text-xs opacity-50">
              {status === "ready" ? "No matches" : status === "error" ? "Couldn’t load catalog" : "Loading pieces…"}
            </p>
          )}
        </div>
      </aside>

      {/* saved looks — top-left, below the EOS header */}
      <AnimatePresence>
        {savedLooks.length > 0 && (
          <motion.aside initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="pointer-events-auto absolute left-3 top-24 flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto md:left-6">
            <p className="px-1 text-[10px] uppercase tracking-[0.2em] opacity-50" style={{ color: "var(--text)" }}>Looks</p>
            {savedLooks.map((l) => (
              <div key={l.id} className="flex items-center gap-1">
                <button onClick={() => loadLook(l.id)} className="rounded-full px-3 py-1.5 text-xs backdrop-blur-xl shadow" style={panel}>{l.name}</button>
                <button onClick={() => deleteLook(l.id)} aria-label="Delete" className="rounded-full px-2 py-1 text-xs opacity-50 hover:opacity-100" style={panel}>×</button>
              </div>
            ))}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
