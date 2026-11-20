import { NextResponse } from "next/server";
import { reseed } from "@/lib/boot";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/seed?cognee=1 resets demo data (keeps Telegram links), embeds it, and loads it into SingleStore and (optionally) Cognee.
export async function POST(req: Request) {
  const u = new URL(req.url);
  try {
    return NextResponse.json(await reseed({ cognee: u.searchParams.get("cognee") === "1" }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
