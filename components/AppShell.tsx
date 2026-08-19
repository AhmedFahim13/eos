"use client";
import { usePhoto } from "@/lib/photostore";
import { Scene } from "./Scene";
import { Wardrobe } from "./Wardrobe";
import { Catalog } from "./Catalog";
import { Board } from "./Board";
import { Library } from "./Library";
import { MoodSwitcher } from "./MoodSwitcher";

const TABS = [{ m: "photo", l: "Board" }, { m: "library", l: "Library" }, { m: "3d", l: "3D" }] as const;

export function AppShell() {
  const { viewMode, setViewMode } = usePhoto();
  return (
    <>
      {viewMode === "photo" && (<><Board /><Catalog /></>)}
      {viewMode === "library" && <Library />}
      {viewMode === "3d" && (<><div className="absolute inset-0"><Scene /></div><Wardrobe /></>)}
      <MoodSwitcher />
      <div className="pointer-events-auto absolute bottom-6 left-6 z-20 flex gap-1 rounded-full p-1 text-[11px] backdrop-blur-xl shadow-lg" style={{ background: "var(--panel)" }}>
        {TABS.map(({ m, l }) => (
          <button key={m} onClick={() => setViewMode(m)} className="rounded-full px-3 py-1.5 uppercase tracking-wider transition" style={{ background: viewMode === m ? "var(--accent)" : "transparent", color: viewMode === m ? "#fff" : "var(--text)" }}>{l}</button>
        ))}
      </div>
    </>
  );
}
