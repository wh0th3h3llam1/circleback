import { NextResponse } from "next/server";
import * as cog from "@/lib/cognee";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const nodeSets = ["source:notes", "source:profiles", "source:goal", "source:linkedin", "source:luma", "source:partiful", "source:telegram", "source:web", "pillar:career", "pillar:work", "pillar:projects", "kind:event"];
  try {
    return NextResponse.json(await cog.brainGraph(nodeSets));
  } catch (e) {
    return NextResponse.json({ dataset: cog.BRAIN, nodeSets, nodes: [], edges: [], counts: { entities: 0, relations: 0, documents: 0 }, error: (e as Error).message.slice(0, 200) });
  }
}
