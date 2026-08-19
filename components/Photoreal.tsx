"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { describeLook } from "@/lib/describe";

type Status = "idle" | "loading" | "done" | "error";
type Tab = "look" | "photo";

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.readAsDataURL(f);
  });
}
function resize(dataUrl: string, max = 1024): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });
}

function UploadSlot({ label, value, onPick }: { label: string; value: string | null; onPick: (d: string) => void }) {
  return (
    <label className="flex aspect-[3/4] flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-center text-xs text-neutral-400">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={label} className="h-full w-full object-cover" />
      ) : (
        <span className="px-2">+ {label}</span>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onPick(await resize(await fileToDataUrl(f)));
        }}
      />
    </label>
  );
}

export function Photoreal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("look");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const [garment, setGarment] = useState<string | null>(null);

  async function send(payload: { mode: Tab; provider: string; images?: string[]; prompt?: string }) {
    setStatus("loading");
    setResult(null);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.image) {
        setResult(data.image);
        setStatus("done");
      } else {
        setStatus("error");
        setMessage(data.message || "Render failed — please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error — please try again.");
    }
  }

  // Free: describe the styled outfit and generate a photoreal editorial image.
  function renderLook() {
    send({ mode: "look", provider: "pollinations", prompt: describeLook() });
  }

  // Keyed: dress an uploaded person in an uploaded garment.
  function tryPhoto() {
    if (!person || !garment) {
      setStatus("error");
      setMessage("Add both a person photo and a garment image.");
      return;
    }
    send({ mode: "photo", provider: "fal", images: [person, garment] });
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => { setTab(id); setStatus("idle"); setResult(null); }}
      className="flex-1 rounded-full py-1.5 text-xs tracking-wide transition"
      style={{ background: tab === id ? "#111" : "transparent", color: tab === id ? "#fff" : "#666" }}
    >
      {label}
    </button>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto absolute left-1/2 top-6 -translate-x-1/2 rounded-full px-5 py-2 text-xs tracking-[0.2em] uppercase backdrop-blur-xl shadow-lg md:top-10"
        style={{ background: "var(--panel)", color: "var(--text)", border: "1px solid var(--accent)" }}
      >
        ◈ Photoreal
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-2xl bg-white p-4 text-neutral-800 shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-serif text-lg">Photoreal</h3>
                <button onClick={() => setOpen(false)} aria-label="Close" className="text-neutral-400 hover:text-neutral-800">×</button>
              </div>

              <div className="mb-3 flex gap-1 rounded-full bg-neutral-100 p-1">
                {tabBtn("look", "Render my look")}
                {tabBtn("photo", "Try on a photo")}
              </div>

              {status !== "done" && tab === "look" && (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-500">Free · turns your styled outfit into a photoreal editorial image.</p>
                  <button onClick={renderLook} disabled={status === "loading"} className="w-full rounded-full bg-neutral-900 py-2.5 text-xs uppercase tracking-widest text-white disabled:opacity-50">
                    {status === "loading" ? "Rendering…" : "Generate"}
                  </button>
                </div>
              )}

              {status !== "done" && tab === "photo" && (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-500">
                    Dress a real photo in a real garment (fal.ai IDM-VTON). Needs a free
                    <span className="font-medium"> fal.ai</span> key — no card. The
                    <span className="font-medium"> Render my look</span> tab is free without any key.
                  </p>
                  <div className="flex gap-3">
                    <UploadSlot label="Person" value={person} onPick={setPerson} />
                    <UploadSlot label="Garment" value={garment} onPick={setGarment} />
                  </div>
                  <button onClick={tryPhoto} disabled={status === "loading"} className="w-full rounded-full bg-neutral-900 py-2.5 text-xs uppercase tracking-widest text-white disabled:opacity-50">
                    {status === "loading" ? "Fitting…" : "Try it on"}
                  </button>
                </div>
              )}

              {status === "loading" && (
                <div className="mt-3 flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-neutral-100">
                  <span className="animate-pulse text-sm tracking-widest text-neutral-400">
                    {tab === "look" ? "RENDERING…" : "FITTING…"}
                  </span>
                </div>
              )}
              {status === "done" && result && (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result} alt="Photoreal result" className="w-full rounded-xl" />
                  <div className="flex gap-2">
                    <button onClick={() => { setStatus("idle"); setResult(null); }} className="flex-1 rounded-full border border-neutral-300 py-2 text-xs uppercase tracking-widest">
                      Again
                    </button>
                    <a href={result} download="eos-look.png" className="flex-1 rounded-full bg-neutral-900 py-2 text-center text-xs uppercase tracking-widest text-white">
                      Download
                    </a>
                  </div>
                </div>
              )}
              {status === "error" && (
                <div className="mt-3 rounded-xl bg-neutral-100 p-6 text-center text-sm text-neutral-500">{message}</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
