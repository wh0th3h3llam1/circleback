import { NextResponse } from "next/server";
import { importEvent } from "@/lib/events";
import { invalidateOpportunities } from "@/lib/opportunities";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { url } = (await req.json()) as { url?: string };
  if (!url?.trim()) return NextResponse.json({ error: "url is required" }, { status: 400 });
  try {
    const r = await importEvent(url.trim());
    invalidateOpportunities();
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
