"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCatalog, SLOT_TINT, imgUrl, TRYON_ORDER, EXTRAS, type Piece } from "@/lib/catalog";
import { usePhoto } from "@/lib/photostore";

type TState = "idle" | "choose" | "models" | "loading" | "done" | "error" | "quota";
interface GalleryItem { piece: string; slot: string; provider: string; image: string }
interface StockModel { id: string; image: string; credit: string; source: string }

const toData = (b: Blob) => new Promise<string>((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.onerror = () => j(fr.error); fr.readAsDataURL(b); });
// Scale to at most `max` px. Cut-out photos (transparent PNG) are trimmed to the person with a margin and put on
// white: JPEG has no transparency, and try-on models expect the person to fill the frame.
const resize = (u: string, max = 1024) => new Promise<string>((r, j) => {
  const i = new Image();
  i.onload = () => {
    let sx = 0, sy = 0, sw = i.width, sh = i.height;
    const probe = document.createElement("canvas");
    probe.width = i.width; probe.height = i.height;
    const pc = probe.getContext("2d", { willReadFrequently: true })!;
    pc.drawImage(i, 0, 0);
    const a = pc.getImageData(0, 0, i.width, i.height).data;
    let x0 = i.width, y0 = i.height, x1 = -1, y1 = -1;
    for (let y = 0; y < i.height; y++) for (let x = 0; x < i.width; x++) if (a[(y * i.width + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const transparent = x1 >= 0 && (x1 - x0 + 1) * (y1 - y0 + 1) < 0.9 * i.width * i.height;
    if (transparent) {
      const pad = Math.round(0.06 * Math.max(x1 - x0, y1 - y0));
      sx = Math.max(0, x0 - pad); sy = Math.max(0, y0 - pad);
      sw = Math.min(i.width, x1 + pad + 1) - sx; sh = Math.min(i.height, y1 + pad + 1) - sy;
    }
    const s = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.round(sw * s); c.height = Math.round(sh * s);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(i, sx, sy, sw, sh, 0, 0, c.width, c.height);
    r(c.toDataURL("image/jpeg", 0.9));
  };
  i.onerror = () => j(new Error("image decode failed"));
  i.src = u;
});
const CODE_KEY = "eos-fal-code";
const readCode = () => { try { return sessionStorage.getItem(CODE_KEY); } catch { return null; } };
const downloadName = (dataUrl: string) => { const m = /^data:image\/(\w+)/.exec(dataUrl); const type = m?.[1]; return `eos-me.${type === "jpeg" ? "jpg" : type === "webp" ? "webp" : "png"}`; };

function Tile({ id, big }: { id: string; big?: boolean }) {
  const p = useCatalog((s) => s.byId[id]);
  if (!p) return null;
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative overflow-hidden rounded-2xl bg-white shadow-md" style={{ background: SLOT_TINT[p.slot] }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgUrl(p.image)} alt={p.name} loading="lazy" className={`w-full ${big ? "h-52" : "h-28"} object-contain p-1`} />
      <span className="block truncate px-2 text-[10px] tracking-wide text-neutral-600">{p.name}</span>
      {p.url ? (
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="block truncate px-2 pb-1.5 text-[10px] text-neutral-500 underline">
          {p.price ? `৳${p.price.toLocaleString("en-IN")} · ` : ""}View at {p.brand} ↗
        </a>
      ) : <span className="block truncate px-2 pb-1.5 text-[10px] text-neutral-500">{p.brand}</span>}
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

function StockModels({ onPick }: { onPick: (image: string) => void }) {
  const [models, setModels] = useState<StockModel[] | null>(null);
  useEffect(() => { fetch("/samples/models.json").then((r) => r.json()).then(setModels).catch(() => setModels([])); }, []);
  if (!models) return <p className="py-6 text-center text-xs text-neutral-400">Loading models…</p>;
  if (models.length === 0) return <p className="py-6 text-center text-xs text-neutral-500">Stock models aren&apos;t available right now.</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {models.map((m) => (
        <div key={m.id}>
          <button onClick={() => onPick(m.image)} className="block w-full overflow-hidden rounded-xl transition hover:opacity-90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.image} alt={`Stock model photographed by ${m.credit}`} className="aspect-[3/4] w-full object-cover" />
          </button>
          <a href={m.source} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-[10px] text-neutral-500 underline">Photo: {m.credit} / Pexels</a>
        </div>
      ))}
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
  // Read once on the client; the code only shows inside the try-on window, so server and client markup agree.
  const [code, setCode] = useState<string | null>(() => (typeof window === "undefined" ? null : readCode()));
  const [codeInput, setCodeInput] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");

  async function unlock() {
    setCodeMsg("Checking…");
    const { checkUnlock } = await import("@/lib/tryon/falClient");
    const res = await checkUnlock(codeInput.trim());
    if (!res.ok) { setCodeMsg(res.message ?? "That code isn't right."); return; }
    try { sessionStorage.setItem(CODE_KEY, codeInput.trim()); } catch { /* private mode: keep it in memory only */ }
    setCode(codeInput.trim()); setCodeInput(""); setCodeOpen(false); setCodeMsg("");
  }
  function lock() { try { sessionStorage.removeItem(CODE_KEY); } catch { /* ignore */ } setCode(null); }
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
      const deps = await liveDeps(code);
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
  async function onStock(image: string) {
    try {
      const r = await fetch(image);
      if (!r.ok) throw new Error("stock model fetch failed");
      tryOn(await resize(await toData(await r.blob())));
    } catch {
      setTmsg("That stock model isn't available right now."); setT("error");
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
              <button onClick={() => setT("choose")} className="mt-3 block w-full rounded-full py-2.5 text-center text-xs uppercase tracking-widest text-white" style={{ background: "var(--accent)" }}>
                ◈ Try on me
              </button>
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
              {tstate === "choose" && (
                <div className="space-y-2">
                  <label className="block cursor-pointer rounded-xl border border-neutral-200 p-4 text-center transition hover:bg-neutral-50">
                    <span className="block text-sm font-medium">Use my photo</span>
                    <span className="block text-[11px] text-neutral-500">A standing, front-facing photo works best</span>
                    <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
                  </label>
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                    <p className="font-medium">For a good result, use a photo that is:</p>
                    <ul className="mt-0.5 list-disc pl-4">
                      <li>just you, standing and facing the camera</li>
                      <li>full body, or at least down to the knees</li>
                      <li>arms by your sides, not crossed or covering your clothes</li>
                      <li>on a plain background, in good light</li>
                      <li>in fitted clothes (loose layers confuse the model)</li>
                    </ul>
                    <p className="mt-1 text-amber-800">Avoid group photos, sitting poses, mirror selfies where the phone hides your body, and heavy filters. Sarees and long kurtis are the hardest for the models, so results vary.</p>
                  </div>
                  <button onClick={() => setT("models")} className="block w-full rounded-xl border border-neutral-200 p-4 text-center transition hover:bg-neutral-50">
                    <span className="block text-sm font-medium">Choose a stock model</span>
                    <span className="block text-[11px] text-neutral-500">See the look without uploading anything</span>
                  </button>
                  <div className="rounded-xl bg-neutral-50 px-3 py-2 text-center text-[11px] text-neutral-600">
                    {code ? (<>
                      <span className="font-medium">✓ Stronger model on</span> (Google&apos;s Nano Banana Pro, backed by FASHN){" "}
                      <button onClick={lock} className="underline">turn off</button>
                    </>) : codeOpen ? (
                      <form onSubmit={(e) => { e.preventDefault(); unlock(); }} className="flex items-center gap-1.5">
                        <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} type="password" inputMode="numeric" autoComplete="off" placeholder="Code" aria-label="Unlock code" className="min-w-0 flex-1 rounded-full border border-neutral-200 px-3 py-1 text-xs outline-none" />
                        <button type="submit" className="rounded-full bg-neutral-900 px-3 py-1 text-xs text-white">Unlock</button>
                      </form>
                    ) : (
                      <button onClick={() => setCodeOpen(true)} className="underline">Use a stronger model</button>
                    )}
                    {codeMsg && <span className="mt-1 block text-[10px] text-neutral-500">{codeMsg}</span>}
                  </div>
                  <p className="pt-1 text-center text-[10px] text-neutral-400">
                    Your photo goes straight from your browser to open try-on models on Hugging Face, or to fal.ai when the stronger model is on. Eos never stores it.
                  </p>
                </div>
              )}
              {tstate === "models" && (<>
                <StockModels onPick={onStock} />
                <button onClick={() => setT("choose")} className="mt-2 block w-full text-center text-[11px] text-neutral-500 underline">← Back</button>
              </>)}
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
