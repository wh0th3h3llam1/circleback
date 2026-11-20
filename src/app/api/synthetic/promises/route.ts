import { NextResponse } from "next/server";
import { extractSyntheticPromises } from "@/lib/synthetic";
import { invalidateOpportunities } from "@/lib/opportunities";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  try {
    const r = await extractSyntheticPromises();
    invalidateOpportunities();
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
