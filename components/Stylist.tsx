"use client";
import { useState } from "react";
import { useCatalog, imgUrl, TRYON_ORDER, OCCASIONS, OCCASION_LABEL, type Occasion } from "@/lib/catalog";
import { usePhoto } from "@/lib/photostore";
import { useBroken } from "@/lib/brokenImages";

interface Result { suggestions: { id: string; reason: string }[]; source: "ai" | "rules" }

export function Stylist() {
  const [open, setOpen] = useState(false);
  const [occasion, setOccasion] = useState<Occasion>("eid");
  const [budget, setBudget] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [res, setRes] = useState<Result | null>(null);
  const byId = useCatalog((s) => s.byId);
  const { equipped, pick } = usePhoto();
  const { broken, mark } = useBroken();
  const outfitId = TRYON_ORDER.map((s) => equipped[s]).find(Boolean);
  const panel = { background: "var(--panel)", color: "var(--text)" } as const;

  async function ask(anchorId?: string) {
    setState("loading");
    try {
      const r = await fetch("/api/stylist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion, budget: budget ? Number(budget) : null, anchorId: anchorId ?? null }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setRes(await r.json());
      setState("done");
    } catch {
      setState("error");
    }
  }

  const wear = (id: string) => { const p = byId[id]; if (p && equipped[p.slot] !== id) pick(id); };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="pointer-events-auto absolute bottom-20 left-3 rounded-full px-4 py-2 text-xs uppercase tracking-widest shadow-lg backdrop-blur-xl md:left-6" style={panel}>
        ✦ Style me
      </button>
    );
  }

  return (
    <aside className="pointer-events-auto absolute bottom-20 left-3 w-72 rounded-2xl p-3 shadow-xl backdrop-blur-xl md:left-6" style={panel}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-serif text-lg">Style me</h2>
        <button onClick={() => setOpen(false)} aria-label="Close" className="opacity-50">×</button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1 text-[11px]">
        {OCCASIONS.map((o) => (
          <button key={o} onClick={() => setOccasion(o)} className="rounded-full px-2.5 py-1" style={{ background: occasion === o ? "var(--accent)" : "transparent", color: occasion === o ? "#fff" : "var(--text)", border: "1px solid rgba(128,128,128,0.3)" }}>
            {OCCASION_LABEL[o]}
          </button>
        ))}
      </div>
      <div className="mb-2 flex gap-2">
        <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} placeholder="Budget ৳ (optional)" className="min-w-0 flex-1 rounded-full px-3 py-1.5 text-xs outline-none" style={{ background: "rgba(128,128,128,0.12)", color: "var(--text)" }} />
        <button onClick={() => ask()} disabled={state === "loading"} className="rounded-full px-3 py-1.5 text-xs text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>Suggest</button>
      </div>
      {outfitId && (
        <button onClick={() => ask(outfitId)} disabled={state === "loading"} className="mb-2 w-full rounded-full py-1.5 text-[11px] underline opacity-80">Complete my look with an orna or accessory</button>
      )}
      {state === "loading" && <p className="py-4 text-center text-xs opacity-60">Thinking…</p>}
      {state === "error" && <p className="py-4 text-center text-xs opacity-60">Couldn&apos;t get suggestions. Please try again.</p>}
      {state === "done" && res && (
        <div className="max-h-[40vh] space-y-2 overflow-y-auto">
          {res.suggestions.filter((s) => !broken[s.id]).length === 0 && <p className="py-2 text-center text-xs opacity-60">Nothing matches. Try another occasion or budget.</p>}
          {res.suggestions.filter((s) => !broken[s.id]).map((s) => {
            const p = byId[s.id];
            if (!p) return null;
            return (
              <div key={s.id} className="flex gap-2 rounded-xl p-1.5" style={{ background: "rgba(128,128,128,0.08)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl(p.image)} alt={p.name} onError={() => mark(s.id)} className="h-16 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">{p.name}</p>
                  <p className="text-[10px] opacity-70">{s.reason}</p>
                  <button onClick={() => wear(p.id)} className="mt-0.5 text-[10px] underline">Wear it</button>
                </div>
              </div>
            );
          })}
          <p className="text-[9px] opacity-50">{res.source === "ai" ? "Suggested by AI from the live catalog." : "Suggested by simple rules (the AI is resting)."}</p>
        </div>
      )}
    </aside>
  );
}
