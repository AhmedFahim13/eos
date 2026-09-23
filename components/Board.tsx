"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCatalog, SLOT_TINT, imgUrl, TRYON_ORDER, EXTRAS, type Piece } from "@/lib/catalog";
import { usePhoto } from "@/lib/photostore";

type TState = "idle" | "loading" | "done" | "error" | "quota";
interface GalleryItem { piece: string; slot: string; provider: string; image: string }

const toData = (b: Blob) => new Promise<string>((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.onerror = () => j(fr.error); fr.readAsDataURL(b); });
const resize = (u: string, max = 1024) => new Promise<string>((r, j) => { const i = new Image(); i.onload = () => { const s = Math.min(1, max / Math.max(i.width, i.height)); const c = document.createElement("canvas"); c.width = i.width * s; c.height = i.height * s; c.getContext("2d")!.drawImage(i, 0, 0, c.width, c.height); r(c.toDataURL("image/jpeg", 0.9)); }; i.onerror = () => j(new Error("image decode failed")); i.src = u; });
const downloadName = (dataUrl: string) => { const m = /^data:image\/(\w+)/.exec(dataUrl); const type = m?.[1]; return `eos-me.${type === "jpeg" ? "jpg" : type === "webp" ? "webp" : "png"}`; };

function Tile({ id, big }: { id: string; big?: boolean }) {
  const p = useCatalog((s) => s.byId[id]);
  if (!p) return null;
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative overflow-hidden rounded-2xl bg-white shadow-md" style={{ background: SLOT_TINT[p.slot] }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgUrl(p.image)} alt={p.name} loading="lazy" className={`w-full ${big ? "h-52" : "h-28"} object-contain p-1`} />
      <span className="block truncate px-2 text-[10px] tracking-wide text-neutral-600">{p.name}</span>
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="block truncate px-2 pb-1.5 text-[10px] text-neutral-500 underline">
        {p.price ? `৳${p.price.toLocaleString("en-IN")} · ` : ""}View at {p.brand} ↗
      </a>
    </motion.div>
  );
}

function QuotaGallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  useEffect(() => { fetch("/bench/gallery.json").then((r) => r.json()).then((d: GalleryItem[]) => setItems(d.slice(0, 6))).catch(() => setItems([])); }, []);
  return (
    <div className="space-y-2">
      <p className="text-sm text-neutral-600">Today&apos;s free try-on capacity is used up. It resets within a day.</p>
      {items.length > 0 && (<>
        <p className="text-xs text-neutral-500">Meanwhile, here is how the same models dress our benchmark models:</p>
        <div className="grid grid-cols-3 gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {items.map((g) => <img key={g.image} src={g.image} alt={`${g.slot} on a benchmark model`} className="aspect-[3/4] w-full rounded-lg object-cover" />)}
        </div>
        <a href="/bench" className="block text-center text-xs underline">See the full benchmark</a>
      </>)}
    </div>
  );
}

export function Board() {
  const { equipped, clear, saveLook } = usePhoto();
  const byId = useCatalog((s) => s.byId);
  const main = TRYON_ORDER.map((s) => equipped[s]).filter(Boolean) as string[];
  const extra = EXTRAS.map((s) => equipped[s]).filter(Boolean) as string[];
  const any = main.length + extra.length > 0;

  const [tstate, setT] = useState<TState>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [tmsg, setTmsg] = useState("");
  const [step, setStep] = useState("");
  const runRef = useRef(0);

  function closeModal() { runRef.current++; setT("idle"); }

  async function tryOn(person: string) {
    // Dress the pieces one at a time in TRYON_ORDER, feeding each result into the next.
    const pieces = main.map((id) => byId[id]).filter((p): p is Piece => Boolean(p));
    if (pieces.length === 0) return;
    const run = ++runRef.current;
    setResult(null); setNotes([]); setT("loading");
    try {
      const [{ liveDeps }, { fitOne }] = await Promise.all([import("@/lib/tryon/live"), import("@/lib/tryon/fit")]);
      if (run !== runRef.current) return;
      const deps = await liveDeps();
      if (run !== runRef.current) return;
      let current = person;
      const found: string[] = [];
      for (let i = 0; i < pieces.length; i++) {
        setStep(`Fitting ${pieces[i].name} (${i + 1}/${pieces.length})… about a minute`);
        const out = await fitOne(current, pieces[i], deps);
        if (run !== runRef.current) return;
        if (out.kind === "quota") { setT("quota"); return; }
        if (out.kind === "error") { setTmsg(out.message); setT("error"); return; }
        if (out.note) found.push(out.note);
        current = out.image;
      }
      setResult(current); setNotes(found); setT("done");
    } catch {
      if (run !== runRef.current) return;
      setTmsg("Something went wrong. Please try again."); setT("error");
    }
  }

  async function onFile(f: File) {
    try {
      tryOn(await resize(await toData(f)));
    } catch {
      setTmsg("Couldn't read that photo. Try a JPG or PNG."); setT("error");
    }
  }
  async function onSample() {
    try {
      const r = await fetch("/samples/model.jpg");
      if (!r.ok) throw new Error("sample fetch failed");
      tryOn(await resize(await toData(await r.blob())));
    } catch {
      setTmsg("The sample model isn't available right now."); setT("error");
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 pb-28 pt-24 md:pr-[22rem]">
      <div className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-3">
        {any ? (
          <div className="w-full rounded-3xl p-4 shadow-2xl backdrop-blur-xl" style={{ background: "var(--panel)" }}>
            <div className="grid grid-cols-2 gap-2"><AnimatePresence>{main.map((id) => (<Tile key={id} id={id} big />))}</AnimatePresence></div>
            {extra.length > 0 && (<div className="mt-2 grid grid-cols-3 gap-2"><AnimatePresence>{extra.map((id) => (<Tile key={id} id={id} />))}</AnimatePresence></div>)}
            {main.length > 0 && (<>
              <label className="mt-3 block cursor-pointer rounded-full py-2.5 text-center text-xs uppercase tracking-widest text-white" style={{ background: "var(--accent)" }}>
                ◈ Try on me
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
              </label>
              <button onClick={onSample} className="mt-1.5 w-full text-center text-[11px] underline opacity-70" style={{ color: "var(--text)" }}>or try it on a sample model</button>
              <p className="mt-1.5 text-center text-[10px] opacity-50" style={{ color: "var(--text)" }}>
                Your photo goes straight from your browser to open try-on models on Hugging Face. Eos never stores it.
              </p>
            </>)}
            <div className="mt-2 flex gap-2">
              <button onClick={saveLook} className="flex-1 rounded-full py-2 text-xs uppercase tracking-widest" style={{ color: "var(--text)", border: "1px solid rgba(128,128,128,0.4)" }}>Save look</button>
              <button onClick={clear} className="rounded-full px-4 py-2 text-xs uppercase tracking-widest" style={{ color: "var(--text)", border: "1px solid rgba(128,128,128,0.4)" }}>Clear</button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl px-10 py-16 text-center shadow-xl backdrop-blur-xl" style={{ background: "var(--panel)", color: "var(--text)" }}>
            <p className="font-serif text-xl">Style a look</p>
            <p className="mt-1 text-xs opacity-60">Pick real pieces from Bangladeshi brands →</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {tstate !== "idle" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => tstate !== "loading" && closeModal()} className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md">
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-4 text-neutral-800 shadow-2xl">
              <div className="mb-2 flex items-center justify-between"><h3 className="font-serif text-lg">Try on me</h3><button onClick={closeModal} aria-label="Close" className="text-neutral-400">×</button></div>
              {tstate === "loading" && <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-neutral-100 px-4 text-center"><span className="animate-pulse text-xs tracking-widest text-neutral-400">{step || "FITTING…"}</span></div>}
              {tstate === "done" && result && (<>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result} alt="You in the look" className="w-full rounded-xl" />
                {notes.map((n) => <p key={n} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{n}</p>)}
                <a href={result} download={downloadName(result)} className="mt-3 block rounded-full bg-neutral-900 py-2 text-center text-xs uppercase tracking-widest text-white">Download</a>
              </>)}
              {tstate === "error" && <div className="rounded-xl bg-neutral-100 p-6 text-center text-sm text-neutral-500">{tmsg}</div>}
              {tstate === "quota" && <QuotaGallery />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
