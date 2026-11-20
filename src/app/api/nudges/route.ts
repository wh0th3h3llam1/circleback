import { NextResponse } from "next/server";
import type { Nudge } from "@/lib/contracts";
import { db } from "@/lib/store";
import { ensureSeeded } from "@/lib/boot";
import * as s2 from "@/lib/s2";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const d = db();
  const name = (id: string) => d.people.find((p) => p.id === id)?.name || id;
  if (s2.s2Enabled()) {
    try {
      const r = await s2.dueNudges();
      const out: Nudge[] = [
        ...r.promises.map((p) => ({
          kind: "promise" as const,
          personId: p.person_id,
          text: `${p.direction === "i_owe" ? `You owe ${name(p.person_id)}` : `${name(p.person_id)} owes you`}: ${p.text}`,
          due: p.due || undefined,
        })),
        ...r.drift.map((p) => ({ kind: "drift" as const, personId: p.id, text: `${p.days} days since ${p.name} (${p.tier})` })),
      ];
      return NextResponse.json(out, { headers: { "x-source": "singlestore" } });
    } catch {
      /* fall through to local */
    }
  }
  const soon = Date.now() + 7 * 86400000;
  const promises: Nudge[] = d.promises
    .filter((p) => p.status === "open" && (!p.due || new Date(p.due).getTime() <= soon))
    .sort((a, b) => (a.due || "9").localeCompare(b.due || "9"))
    .slice(0, 6)
    .map((p) => ({
      kind: "promise",
      personId: p.personId,
      text: `${p.direction === "i_owe" ? `You owe ${name(p.personId)}` : `${name(p.personId)} owes you`}: ${p.text}`,
      due: p.due,
    }));
  const drift: Nudge[] = d.people
    .filter((p) => p.met && p.id !== "me" && p.lastContact)
    .map((p) => ({ p, days: Math.round((Date.now() - new Date(p.lastContact!).getTime()) / 86400000) }))
    .filter(({ p, days }) => (p.tier === "inner" && days >= 14) || (p.tier === "close" && days >= 21))
    .sort((a, b) => b.days - a.days)
    .slice(0, 4)
    .map(({ p, days }) => ({ kind: "drift", personId: p.id, text: `${days} days since ${p.name} (${p.tier})` }));
  return NextResponse.json([...promises, ...drift], { headers: { "x-source": "local" } });
}
