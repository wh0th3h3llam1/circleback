import { NextResponse } from "next/server";
import { db } from "@/lib/store";
import { ensureSeeded } from "@/lib/boot";
import { withUrl } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  return NextResponse.json((db().events || []).map(withUrl));
}
