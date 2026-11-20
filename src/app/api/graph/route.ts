import { NextResponse } from "next/server";
import type { GraphData } from "@/lib/contracts";
import { db } from "@/lib/store";
import { ensureSeeded } from "@/lib/boot";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const d = db();
  const data: GraphData = {
    people: d.people,
    edges: d.edges,
    counts: { messages: d.messages.length, promisesOpen: d.promises.filter((p) => p.status === "open").length },
  };
  return NextResponse.json(data);
}
