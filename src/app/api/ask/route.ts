import { NextResponse } from "next/server";
import { ask } from "@/lib/ask";
import { ensureSeeded } from "@/lib/boot";
import { decide } from "@/lib/router";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The decision model routes each question: simple lookups take the fast path (small model, no graph recall),
// recommendations and intro planning take the deep path (Cognee graph + large model). ?mode=fast|deep overrides.
export async function POST(req: Request) {
  await ensureSeeded();
  const body = (await req.json()) as { query?: string; mode?: "fast" | "deep" };
  if (!body.query?.trim()) return NextResponse.json({ error: "query is required" }, { status: 400 });
  try {
    const q = body.query.trim();
    const r = body.mode ? { mode: body.mode, confidence: 1, step: { sponsor: "Rules" as const, label: "route", detail: `forced ${body.mode}`, ms: 0, real: false } } : await decide(q);
    const a = await ask(q, { fast: r.mode === "fast", preTrail: [r.step] });
    a.route = { ...a.route!, confidence: r.confidence };
    return NextResponse.json(a);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
