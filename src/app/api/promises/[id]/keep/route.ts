import { NextResponse } from "next/server";
import { db, save } from "@/lib/store";
import * as s2 from "@/lib/s2";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pr = db().promises.find((x) => x.id === id);
  if (!pr) return NextResponse.json({ error: "not found" }, { status: 404 });
  pr.status = "kept";
  save();
  if (s2.s2Enabled()) await s2.upsertPromises([pr]).catch(() => {});
  return NextResponse.json(pr);
}
