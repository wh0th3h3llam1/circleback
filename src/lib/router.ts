// Decision model routing: a tiny SIE classifier (fastino/GLiNER2.5-Decide) decides per question whether a
// fast lookup is enough (SingleStore search + small model, ~2s) or it needs the deep path
// (Cognee graph recall + rerank + large model, ~10s).
import type { TrailStep } from "./contracts";

const BASE = process.env.SIE_BASE_URL || "https://api.superlinked.com";
const KEY = process.env.SIE_API_KEY || "";
export const DECIDER = "fastino/GLiNER2.5-Decide";
export const FAST_MODEL = process.env.SIE_FAST_MODEL || "Qwen/Qwen3.5-4B";
export const DEEP_MODEL = process.env.SIE_CHAT_MODEL || "Qwen/Qwen3.8-27B-FP8";

const FAST = "look up a fact about one person, company or date";
const DEEP = "recommend people, plan introductions or career strategy";

export async function decide(query: string): Promise<{ mode: "fast" | "deep"; confidence: number; step: TrailStep }> {
  const t = Date.now();
  try {
    const res = await fetch(`${BASE}/v1/extract/${DECIDER}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ text: query }], params: { labels: [FAST, DEEP] } }),
      signal: AbortSignal.timeout(8000),
    });
    const d = (await res.json()) as { items: { classifications: { label: string; score: number }[] }[] };
    const cls = d.items[0].classifications;
    const deep = cls.find((c) => c.label === DEEP)?.score ?? 0.5;
    const mode = deep >= 0.5 ? "deep" : "fast";
    const confidence = mode === "deep" ? deep : 1 - deep;
    return {
      mode,
      confidence,
      step: { sponsor: "SIE", label: `decide · GLiNER2.5-Decide`, detail: `${mode === "deep" ? "complex → large model + Cognee graph" : "simple lookup → small model"} (${Math.round(confidence * 100)}%)`, ms: Date.now() - t, real: true },
    };
  } catch (e) {
    return { mode: "deep", confidence: 0, step: { sponsor: "SIE", label: "decide", detail: `decider unavailable, defaulting to deep: ${(e as Error).message.slice(0, 80)}`, ms: Date.now() - t, real: false } };
  }
}
