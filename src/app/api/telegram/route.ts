import { NextResponse } from "next/server";
import { handleUpdate } from "@/lib/telegram";
import { ensureSeeded } from "@/lib/boot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (req.headers.get("x-bot-secret") !== (process.env.BOT_SECRET || "local-bot")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await ensureSeeded();
  try {
    return NextResponse.json({ result: await handleUpdate(await req.json()) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
