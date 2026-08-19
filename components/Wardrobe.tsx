"use client";
import { motion, AnimatePresence } from "framer-motion";
import { GARMENTS, SLOT_LABELS, SWATCHES, BY_ID, FABRIC_LIST } from "@/lib/garments";
import { PATTERNS } from "@/lib/pattern";
import { useEos } from "@/lib/store";

export function Wardrobe() {
  const {
    equipped, active, toggleGarment, setColor, colorOf,
    setPattern, patternOf, setFabric, fabricOf, saveLook, loadLook, deleteLook, savedLooks,
  } = useEos();

  const panel = { background: "var(--panel)", color: "var(--text)" } as const;

  return (
    <>
      {/* Wardrobe — right */}
      <aside
        className="pointer-events-auto absolute right-4 top-20 bottom-28 w-60 overflow-y-auto rounded-2xl p-4 backdrop-blur-xl shadow-xl md:right-8"
        style={panel}
      >
        <h2 className="mb-3 font-serif text-lg tracking-wide">Wardrobe</h2>

        {SLOT_LABELS.map(({ slot, label }) => (
          <section key={slot} className="mb-3">
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.2em] opacity-60">{label}</p>
            <div className="flex flex-wrap gap-1.5">
              {GARMENTS.filter((g) => g.slot === slot).map((g) => {
                const on = equipped[slot] === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleGarment(g.id)}
                    className="rounded-full px-3 py-1.5 text-xs tracking-wide transition"
                    style={{
                      background: on ? "var(--accent)" : "transparent",
                      color: on ? "#fff" : "var(--text)",
                      border: `1px solid ${on ? "var(--accent)" : "rgba(128,128,128,0.35)"}`,
                    }}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {/* Colour */}
        <AnimatePresence>
          {active && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-1 overflow-hidden"
            >
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.2em] opacity-60">
                Colour · {BY_ID[active]?.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SWATCHES.map((hex) => {
                  const sel = colorOf(active) === hex;
                  return (
                    <button
                      key={hex}
                      onClick={() => setColor(active, hex)}
                      aria-label={hex}
                      className="h-6 w-6 rounded-full transition"
                      style={{
                        background: hex,
                        outline: sel ? "2px solid var(--text)" : "1px solid rgba(128,128,128,0.35)",
                        outlineOffset: 1,
                      }}
                    />
                  );
                })}
              </div>

              {/* Fabric */}
              <p className="mb-1.5 mt-3 text-[10px] uppercase tracking-[0.2em] opacity-60">Fabric</p>
              <div className="flex flex-wrap gap-1.5">
                {FABRIC_LIST.map((fb) => {
                  const on = fabricOf(active) === fb.id;
                  return (
                    <button
                      key={fb.id}
                      onClick={() => setFabric(active, fb.id)}
                      className="rounded-full px-2.5 py-1 text-[11px] tracking-wide transition"
                      style={{
                        background: on ? "var(--accent)" : "transparent",
                        color: on ? "#fff" : "var(--text)",
                        border: `1px solid ${on ? "var(--accent)" : "rgba(128,128,128,0.35)"}`,
                      }}
                    >
                      {fb.label}
                    </button>
                  );
                })}
              </div>

              {/* Print / pattern */}
              <p className="mb-1.5 mt-3 text-[10px] uppercase tracking-[0.2em] opacity-60">Print</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {PATTERNS.map((p) => {
                  const on = patternOf(active).type === p.type;
                  return (
                    <button
                      key={p.type}
                      onClick={() => setPattern(active, { type: p.type })}
                      className="rounded-full px-2.5 py-1 text-[11px] tracking-wide transition"
                      style={{
                        background: on ? "var(--accent)" : "transparent",
                        color: on ? "#fff" : "var(--text)",
                        border: `1px solid ${on ? "var(--accent)" : "rgba(128,128,128,0.35)"}`,
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {patternOf(active).type !== "solid" && (
                <>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {SWATCHES.map((hex) => {
                      const sel = patternOf(active).color === hex;
                      return (
                        <button
                          key={"p" + hex}
                          onClick={() => setPattern(active, { color: hex })}
                          aria-label={`print ${hex}`}
                          className="h-5 w-5 rounded-full transition"
                          style={{
                            background: hex,
                            outline: sel ? "2px solid var(--text)" : "1px solid rgba(128,128,128,0.35)",
                            outlineOffset: 1,
                          }}
                        />
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-2 text-[11px] opacity-70">
                    Scale
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={1}
                      value={patternOf(active).scale}
                      onChange={(e) => setPattern(active, { scale: Number(e.target.value) })}
                      className="flex-1 accent-[color:var(--accent)]"
                    />
                  </label>
                </>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        <button
          onClick={saveLook}
          className="mt-4 w-full rounded-full py-2 text-xs font-medium tracking-wider transition"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Save look
        </button>
      </aside>

      {/* Saved looks — left */}
      <AnimatePresence>
        {savedLooks.length > 0 && (
          <motion.aside
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 flex max-h-[60vh] flex-col gap-2 overflow-y-auto md:left-8"
          >
            {savedLooks.map((l) => (
              <div key={l.id} className="flex items-center gap-1">
                <button
                  onClick={() => loadLook(l.id)}
                  className="rounded-full px-3 py-1.5 text-xs backdrop-blur-xl shadow"
                  style={panel}
                >
                  {l.name}
                </button>
                <button
                  onClick={() => deleteLook(l.id)}
                  aria-label={`Delete ${l.name}`}
                  className="rounded-full px-2 py-1 text-xs opacity-50 hover:opacity-100"
                  style={panel}
                >
                  ×
                </button>
              </div>
            ))}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
