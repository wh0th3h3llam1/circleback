import { NextResponse } from "next/server";
import { ingest } from "@/lib/ingest";
import { ensureSeeded } from "@/lib/boot";
import type { Pillar, Source } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  await ensureSeeded();
  const body = (await req.json()) as { text?: string; source?: Source; pillar?: Pillar };
  if (!body.text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });
  try {
    return NextResponse.json(await ingest(body.text.trim(), body.source || "web", body.pillar));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
