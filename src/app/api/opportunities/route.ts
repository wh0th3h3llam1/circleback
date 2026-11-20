import { NextResponse } from "next/server";
import { opportunities } from "@/lib/opportunities";
import { ensureSeeded } from "@/lib/boot";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET(req: Request) {
  await ensureSeeded();
  try {
    return NextResponse.json(await opportunities(new URL(req.url).searchParams.get("refresh") === "1"));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
