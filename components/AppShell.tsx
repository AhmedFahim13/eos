"use client";
import { usePhoto } from "@/lib/photostore";
import { useCatalog, TRYON_ORDER } from "@/lib/catalog";
import { ARCHIVE_SLOTS } from "@/lib/catalog/archive";
import { Scene } from "./Scene";
import { Wardrobe } from "./Wardrobe";
import { Catalog } from "./Catalog";
import { Board } from "./Board";
import { Library } from "./Library";
import { Stylist } from "./Stylist";
import { MoodSwitcher } from "./MoodSwitcher";

const TABS = [{ m: "photo", l: "Board" }, { m: "library", l: "Library" }, { m: "3d", l: "3D" }] as const;

export function AppShell() {
  const { viewMode, setViewMode, clear, setTab } = usePhoto();
  const { source, setSource } = useCatalog();
  // The original foreign-brand catalogue, kept behind a near-invisible dot for those who know.
  const toggleArchive = () => {
    const next = source === "archive" ? "live" : "archive";
    clear();
    setTab(next === "archive" ? ARCHIVE_SLOTS[0].slot : TRYON_ORDER[0]);
    setSource(next);
  };
  return (
    <>
      {viewMode === "photo" && (<><Board /><Catalog />{source === "live" && <Stylist />}</>)}
      {viewMode === "library" && <Library />}
      {viewMode === "3d" && (<><div className="absolute inset-0"><Scene /></div><Wardrobe /></>)}
      <MoodSwitcher />
      <div className="pointer-events-auto absolute bottom-6 left-6 z-20 flex gap-1 rounded-full p-1 text-[11px] backdrop-blur-xl shadow-lg" style={{ background: "var(--panel)" }}>
        {TABS.map(({ m, l }) => (
          <button key={m} onClick={() => setViewMode(m)} className="rounded-full px-3 py-1.5 uppercase tracking-wider transition" style={{ background: viewMode === m ? "var(--accent)" : "transparent", color: viewMode === m ? "#fff" : "var(--text)" }}>{l}</button>
        ))}
      </div>
      <button
        onClick={toggleArchive}
        aria-label="Archive"
        className="pointer-events-auto absolute z-20 rounded-full"
        style={{ right: 8, bottom: 8, width: 8, height: 8, opacity: 0.12, background: "var(--text)" }}
      />
    </>
  );
}
