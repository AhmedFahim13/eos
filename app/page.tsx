import { AppShell } from "@/components/AppShell";
import { StoreHydrate } from "@/components/StoreHydrate";

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden" style={{ background: "var(--panel)" }}>
      <StoreHydrate />
      <AppShell />
    </main>
  );
}
