import { NextResponse } from "next/server";
import { seedHackathonDemo } from "@/lib/demo";
import { ensureSeeded } from "@/lib/boot";
import { invalidateOpportunities } from "@/lib/opportunities";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  await ensureSeeded();
  try {
    const r = await seedHackathonDemo();
    invalidateOpportunities();
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
