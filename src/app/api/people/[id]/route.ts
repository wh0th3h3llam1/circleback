import { NextResponse } from "next/server";
import type { PersonPatch, Pillar } from "@/lib/contracts";
import { PILLARS } from "@/lib/contracts";
import { db, recomputeTiers, save } from "@/lib/store";
import { ingest } from "@/lib/ingest";
import * as s2 from "@/lib/s2";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = db().people.find((x) => x.id === id);
  return p ? NextResponse.json(p) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = db();
  const p = d.people.find((x) => x.id === id);
  if (!p || p.id === "me") return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = (await req.json()) as PersonPatch;
  if (body.name?.trim()) p.name = body.name.trim();
  if (body.org !== undefined) p.org = body.org.trim() || undefined;
  if (body.role !== undefined) p.role = body.role.trim() || undefined;
  if (body.pillars?.length) p.pillars = body.pillars.filter((x): x is Pillar => PILLARS.includes(x));
  if (body.inner !== undefined) {
    d.pinnedInner = d.pinnedInner.filter((x) => x !== id);
    if (body.inner) d.pinnedInner.push(id);
  }
  recomputeTiers();
  save();
  if (body.note?.trim()) await ingest(`${body.note.trim()} (about ${p.name})`, "web", p.pillars[0]);
  if (s2.s2Enabled()) await s2.upsertPeople([p]).catch(() => {});
  return NextResponse.json(d.people.find((x) => x.id === id));
}
