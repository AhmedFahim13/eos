// lib/tryon/falModels.ts — the paid models on fal (server side). FASHN is a try-on specialist that
// transfers the garment's pixels; Nano Banana Pro (Google's Gemini image model) follows written
// instructions, so EOS tells it what the piece is and how it is worn.
import type { Slot } from "@/lib/catalog/slots";

export type FalModel = "fashn" | "banana";

export interface PieceBrief {
  slot: Slot;
  /** e.g. "maroon georgette saree" */
  description: string;
  /** Established design names, e.g. ["Jamdani", "Half silk"]. */
  styles: string[];
}

const HOW_WORN: Partial<Record<Slot, string>> = {
  saree: "Drape the saree in the Nivi style with the pallu over the left shoulder, reaching the feet, with the matching blouse shown in the product photo.",
  set3: "Dress the person in all three pieces as shown: the kameez, the matching bottom and the dupatta or orna.",
  set2: "Dress the person in both pieces as shown: the kameez or top and the matching bottom.",
  kurti: "Keep the kurti's full length as in the product photo; it is a long tunic, not a short top. Keep the person's own bottom wear.",
  top: "Replace only the upper-body garment; keep the person's own bottom wear.",
  bottom: "Replace only the bottom wear; keep the person's own top.",
};

export function bananaPrompt(p: PieceBrief): string {
  const named = p.styles.length ? ` (${p.styles.join(", ")})` : "";
  return [
    `Image 1 is a photo of a person. Image 2 is a product photo of a ${p.description}${named} from a Bangladeshi brand.`,
    "Dress the person in image 1 in exactly this garment.",
    HOW_WORN[p.slot] ?? "",
    "Reproduce the garment's colours, weave, print, embroidery and border faithfully.",
    "If the product photo shows the garment folded, on a hanger or on a mannequin, show how it looks when worn.",
    "Keep the person's face, skin tone, hair, body shape, pose, hands and the background unchanged, with the same framing as image 1.",
    "Return one realistic photograph.",
  ].filter(Boolean).join(" ");
}

const FASHN_CATEGORY = (slot: Slot) => (slot === "top" || slot === "kurti" ? "tops" : slot === "bottom" ? "bottoms" : "one-pieces");

/** The fal endpoint and request body for one try-on. */
export function falRequest(model: FalModel, person: string, garment: string, brief: PieceBrief): { url: string; body: object } {
  if (model === "banana") {
    return {
      url: "https://fal.run/fal-ai/nano-banana-pro/edit",
      body: { prompt: bananaPrompt(brief), image_urls: [person, garment], num_images: 1, output_format: "jpeg", resolution: "1K", aspect_ratio: "auto" },
    };
  }
  return {
    url: "https://fal.run/fal-ai/fashn/tryon/v1.6",
    body: { model_image: person, garment_image: garment, category: FASHN_CATEGORY(brief.slot), mode: "performance" },
  };
}

/** Calls fal and returns the result image as a data URL, or an error message. */
export async function callFal(key: string, model: FalModel, person: string, garment: string, brief: PieceBrief, fetchImpl: typeof fetch = fetch): Promise<{ image: string } | { error: string; status: number }> {
  const { url, body } = falRequest(model, person, garment, brief);
  const res = await fetchImpl(url, { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return { error: /balance|locked|exhausted|credit|402/i.test(detail) ? "fal.ai balance is used up." : `Try-on failed (${res.status}).`, status: 502 };
  }
  const j = await res.json();
  const out: string | undefined = j?.image?.url || j?.images?.[0]?.url;
  if (!out) return { error: "No image came back.", status: 502 };
  if (out.startsWith("data:")) return { image: out };
  const img = await fetchImpl(out);
  if (!img.ok) return { error: "Couldn't fetch the result.", status: 502 };
  const ct = img.headers.get("content-type") || "image/jpeg";
  return { image: `data:${ct};base64,${Buffer.from(await img.arrayBuffer()).toString("base64")}` };
}
