import { NextResponse } from "next/server";
import { generateSyntheticChats } from "@/lib/synthetic";
import { ensureSeeded } from "@/lib/boot";
import { invalidateOpportunities } from "@/lib/opportunities";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/synthetic/chats?count=40 — demo data: synthetic chat threads with imported connections (labeled).
export async function POST(req: Request) {
  await ensureSeeded();
  const count = Math.min(80, Number(new URL(req.url).searchParams.get("count") || 40));
  try {
    const r = await generateSyntheticChats(count);
    invalidateOpportunities();
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
