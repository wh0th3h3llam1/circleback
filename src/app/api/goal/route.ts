import { NextResponse } from "next/server";
import { db, save } from "@/lib/store";
import { ensureSeeded } from "@/lib/boot";
import * as cog from "@/lib/cognee";
import { invalidateOpportunities } from "@/lib/opportunities";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  return NextResponse.json({ goal: db().goal || "" });
}

export async function POST(req: Request) {
  const { goal } = (await req.json()) as { goal?: string };
  if (!goal?.trim()) return NextResponse.json({ error: "goal is required" }, { status: 400 });
  db().goal = goal.trim();
  save();
  invalidateOpportunities();
  if (cog.cogneeEnabled()) cog.addText([`Me's career goal: ${goal.trim()}`], ["source:goal", "pillar:career"]).then(() => cog.cognify()).catch(() => {});
  return NextResponse.json({ goal: db().goal });
}
