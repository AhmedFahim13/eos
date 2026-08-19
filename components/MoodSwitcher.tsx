"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { MOODS, MOOD_ORDER } from "@/lib/moods";
import { useEos } from "@/lib/store";

export function MoodSwitcher() {
  const { mood, setMood } = useEos();

  // Re-skin the HTML UI in sync with the 3D scene by writing CSS vars.
  useEffect(() => {
    const m = MOODS[mood];
    const r = document.documentElement.style;
    r.setProperty("--accent", m.ui.accent);
    r.setProperty("--text", m.ui.text);
    r.setProperty("--panel", m.ui.panel);
  }, [mood]);

  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 md:p-10"
      style={{ color: "var(--text)" }}
    >
      <header className="flex items-baseline justify-between">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="font-serif text-3xl md:text-4xl font-light tracking-[0.35em]"
        >
          EOS
        </motion.h1>
        <motion.span
          key={mood}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 0.75, x: 0 }}
          transition={{ duration: 0.6 }}
          className="text-[10px] md:text-xs tracking-[0.25em] uppercase"
        >
          {MOODS[mood].tagline}
        </motion.span>
      </header>

      <footer className="flex flex-col items-center gap-4">
        <div
          className="pointer-events-auto flex gap-1 rounded-full p-1.5 backdrop-blur-xl shadow-lg"
          style={{ background: "var(--panel)" }}
        >
          {MOOD_ORDER.map((id) => (
            <button
              key={id}
              onClick={() => setMood(id)}
              className="relative rounded-full px-4 py-2 text-xs md:text-sm tracking-wider transition-colors"
              style={{ color: mood === id ? "#fff" : "var(--text)" }}
            >
              {mood === id && (
                <motion.span
                  layoutId="moodPill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: "var(--accent)" }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10">{MOODS[id].name}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
