import { NextResponse } from "next/server";
import { importSeedPack } from "@/lib/seedpack";
import { ensureSeeded } from "@/lib/boot";
import { invalidateOpportunities } from "@/lib/opportunities";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  await ensureSeeded();
  try {
    const r = await importSeedPack();
    invalidateOpportunities();
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
