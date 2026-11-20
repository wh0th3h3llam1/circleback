import { NextResponse } from "next/server";
import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const pid = new URL(req.url).searchParams.get("personId");
  const msgs = db()
    .messages.filter((m) => !pid || m.personIds.includes(pid))
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 30)
    .map((m) => {
      const { vec, ...rest } = m;
      void vec;
      return rest;
    });
  return NextResponse.json(msgs);
}
