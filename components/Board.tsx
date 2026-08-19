"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCatalog, SLOT_TINT, imgUrl, type CatSlot } from "@/lib/catalog";
import { usePhoto } from "@/lib/photostore";

const MAIN: CatSlot[] = ["dress", "top", "bottom", "outer"];
const EXTRA: CatSlot[] = ["shoes", "bag", "accessory"];

const toData = (f: File) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(f); });
const resize = (u: string, max = 1024) => new Promise<string>((r) => { const i = new Image(); i.onload = () => { const s = Math.min(1, max / Math.max(i.width, i.height)); const c = document.createElement("canvas"); c.width = i.width * s; c.height = i.height * s; c.getContext("2d")!.drawImage(i, 0, 0, c.width, c.height); r(c.toDataURL("image/jpeg", 0.9)); }; i.src = u; });

function Tile({ id, big }: { id: string; big?: boolean }) {
  const p = useCatalog((s) => s.byId[id]);
  if (!p) return null;
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative overflow-hidden rounded-2xl bg-white shadow-md" style={{ background: SLOT_TINT[p.slot] }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgUrl(p.image)} alt={p.name} loading="lazy" className={`w-full ${big ? "h-52" : "h-28"} object-contain p-1`} />
      <span className="block truncate px-2 pb-1.5 text-[10px] tracking-wide text-neutral-600">{p.name}</span>
    </motion.div>
  );
}

export function Board() {
  const { equipped, clear, saveLook } = usePhoto();
  const byId = useCatalog((s) => s.byId);
  const main = MAIN.map((s) => equipped[s]).filter(Boolean) as string[];
  const extra = EXTRA.map((s) => equipped[s]).filter(Boolean) as string[];
  const any = main.length + extra.length > 0;

  const [tstate, setT] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<string | null>(null);
  const [tmsg, setTmsg] = useState("");
  const [step, setStep] = useState("");

  async function onFile(f: File) {
    // Chain the wearable pieces (dress OR top/bottom, then outer) one at a time,
    // feeding each result into the next — full-outfit try-on without server timeouts.
    const mains = MAIN.map((s) => equipped[s]).map((id) => (id ? byId[id] : null)).filter(Boolean) as { name: string; image: string }[];
    if (mains.length === 0) return;
    setResult(null); setT("loading");
    try {
      let current = await resize(await toData(f));
      for (let i = 0; i < mains.length; i++) {
        setStep(`Fitting ${mains[i].name} (${i + 1}/${mains.length})…`);
        const res = await fetch("/api/tryon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "photo", provider: "fal", images: [current, mains[i].image] }) });
        const d = await res.json();
        if (!(res.ok && d.image)) { setTmsg(d.message || "Try-on failed."); setT("error"); return; }
        current = d.image;
      }
      setResult(current); setT("done");
    } catch { setTmsg("Network error."); setT("error"); }
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 pb-28 pt-24 md:pr-[22rem]">
      <div className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-3">
        {any ? (
          <div className="w-full rounded-3xl p-4 shadow-2xl backdrop-blur-xl" style={{ background: "var(--panel)" }}>
            <div className="grid grid-cols-2 gap-2"><AnimatePresence>{main.map((id) => (<Tile key={id} id={id} big />))}</AnimatePresence></div>
            {extra.length > 0 && (<div className="mt-2 grid grid-cols-3 gap-2"><AnimatePresence>{extra.map((id) => (<Tile key={id} id={id} />))}</AnimatePresence></div>)}
            <label className="mt-3 block cursor-pointer rounded-full py-2.5 text-center text-xs uppercase tracking-widest text-white" style={{ background: "var(--accent)" }}>
              ◈ Try on me
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            </label>
            <div className="mt-2 flex gap-2">
              <button onClick={saveLook} className="flex-1 rounded-full py-2 text-xs uppercase tracking-widest" style={{ color: "var(--text)", border: "1px solid rgba(128,128,128,0.4)" }}>Save look</button>
              <button onClick={clear} className="rounded-full px-4 py-2 text-xs uppercase tracking-widest" style={{ color: "var(--text)", border: "1px solid rgba(128,128,128,0.4)" }}>Clear</button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl px-10 py-16 text-center shadow-xl backdrop-blur-xl" style={{ background: "var(--panel)", color: "var(--text)" }}>
            <p className="font-serif text-xl">Style a look</p>
            <p className="mt-1 text-xs opacity-60">Pick real pieces from the wardrobe →</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {tstate !== "idle" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setT("idle")} className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md">
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-4 text-neutral-800 shadow-2xl">
              <div className="mb-2 flex items-center justify-between"><h3 className="font-serif text-lg">Try on me</h3><button onClick={() => setT("idle")} aria-label="Close" className="text-neutral-400">×</button></div>
              {tstate === "loading" && <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-neutral-100 px-4 text-center"><span className="animate-pulse text-xs tracking-widest text-neutral-400">{step || "FITTING…"}</span></div>}
              {tstate === "done" && result && (<>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result} alt="You in the look" className="w-full rounded-xl" />
                <a href={result} download="eos-me.png" className="mt-3 block rounded-full bg-neutral-900 py-2 text-center text-xs uppercase tracking-widest text-white">Download</a>
              </>)}
              {tstate === "error" && <div className="rounded-xl bg-neutral-100 p-6 text-center text-sm text-neutral-500">{tmsg}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
