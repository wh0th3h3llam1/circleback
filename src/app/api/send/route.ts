import { NextResponse } from "next/server";
import type { TrailStep } from "@/lib/contracts";
import { db } from "@/lib/store";
import { sendMessage, telegramEnabled } from "@/lib/telegram";
import * as s2 from "@/lib/s2";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { personId, text } = (await req.json()) as { personId?: string; text?: string };
  const d = db();
  const p = d.people.find((x) => x.id === personId);
  if (!p || !text?.trim()) return NextResponse.json({ error: "personId and text are required" }, { status: 400 });
  const trail: TrailStep[] = [];
  const t = Date.now();
  const direct = d.telegram.links[p.id];
  const owner = d.telegram.ownerChatId;
  if (!telegramEnabled() || (!direct && !owner)) {
    return NextResponse.json({
      ok: false,
      channel: "copy",
      trail: [{ sponsor: "Telegram", label: "send", detail: `${p.name} is not linked on Telegram; copy the draft instead`, ms: 0, real: false }],
    });
  }
  try {
    if (direct) {
      await sendMessage(direct, text.trim());
      trail.push({ sponsor: "Telegram", label: "sendMessage", detail: `Delivered to ${p.name} on Telegram`, ms: Date.now() - t, real: true });
    } else {
      await sendMessage(owner!, `📨 Draft for ${p.name} (not on Telegram yet, so forward or paste it):\n\n${text.trim()}`);
      trail.push({ sponsor: "Telegram", label: "sendMessage", detail: `${p.name} is not linked, so the draft went to your Telegram to forward`, ms: Date.now() - t, real: true });
    }
    if (s2.s2Enabled()) await s2.audit("send", { personId: p.id, direct: !!direct }).catch(() => {});
    return NextResponse.json({ ok: true, channel: "telegram", trail });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, ok: false, channel: "copy", trail }, { status: 502 });
  }
}
