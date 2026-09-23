// /bench — the Bangladeshi try-on benchmark, rendered from committed results.
import results from "@/public/bench/results.json";
import gallery from "@/public/bench/gallery.json";
import { SLOT_NOUN, type Slot } from "@/lib/catalog/slots";

export const metadata = { title: "Eos · Bangladeshi try-on benchmark" };

interface Cell { provider: string; slot: Slot; attempts: number; generated: number; passed: number; generationRate: number; passRate: number }
interface Results { generatedAt: string | null; runs: number; table: Cell[]; judge: { n: number; test: number } | null; tagger: { n: number; slotAccuracy: number; colorAgreement: number } | null }
interface GalleryItem { piece: string; slot: Slot; provider: string; image: string }

const pct = (x: number) => `${Math.round(x * 100)}%`;
const model = (p: string) => (p === "ootd" ? "OOTDiffusion" : p === "idm" ? "IDM-VTON" : p);

export default function BenchPage() {
  const r = results as unknown as Results;
  const g = (gallery as unknown as GalleryItem[]).slice(0, 24);
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-neutral-800">
      <a href="/" className="text-xs underline">← Eos</a>
      <h1 className="mt-4 font-serif text-3xl">How open try-on models handle Bangladeshi clothing</h1>
      <p className="mt-3 text-sm text-neutral-600">
        Open virtual try-on models are trained mostly on western tops and dresses. Nobody had measured them on sarees,
        salwar kameez or kurtis. Eos runs the same automatic judge used in the app on every output: is the garment&apos;s
        colour kept, is it the same person, did the outfit actually change.
      </p>
      {r.table.length === 0 ? (
        <p className="mt-8 rounded-xl bg-neutral-100 p-6 text-sm">The benchmark is running a few try-ons a day on free GPUs. Results appear here as they complete.</p>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <thead><tr className="border-b text-xs uppercase tracking-wider text-neutral-500"><th className="py-2">Model</th><th>Garment</th><th>Attempts</th><th>Generated</th><th>Judged right</th></tr></thead>
          <tbody>
            {r.table.map((c) => (
              <tr key={`${c.provider}-${c.slot}`} className="border-b border-neutral-100">
                <td className="py-2">{model(c.provider)}</td><td>{SLOT_NOUN[c.slot]}</td><td>{c.attempts}</td><td>{pct(c.generationRate)}</td><td className="font-medium">{pct(c.passRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ul className="mt-6 space-y-1 text-xs text-neutral-500">
        <li>{r.runs} runs{r.generatedAt ? `, updated ${r.generatedAt.slice(0, 10)}` : ""}.</li>
        <li>{r.judge ? `The judge agreed with a human rating on ${pct(r.judge.test)} of held-out outputs (${r.judge.n} rated).` : "Judge agreement with human ratings: not calibrated yet."}</li>
        <li>{r.tagger ? `Catalog tagger: right garment type ${pct(r.tagger.slotAccuracy)}, right main colour ${pct(r.tagger.colorAgreement)} (${r.tagger.n} hand-labelled pieces).` : "Tagger accuracy: not scored yet."}</li>
      </ul>
      {g.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {g.map((x) => <img key={x.image} src={x.image} alt={`${SLOT_NOUN[x.slot]} by ${model(x.provider)}`} className="aspect-[3/4] w-full rounded-lg object-cover" />)}
        </div>
      )}
      <p className="mt-8 text-xs text-neutral-500">Method, limits and raw data: <a className="underline" href="https://github.com/AhmedFahim13/eos/blob/master/docs/bench.md">docs/bench.md</a>.</p>
    </main>
  );
}
