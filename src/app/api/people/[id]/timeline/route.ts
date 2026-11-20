import { NextResponse } from "next/server";
import type { PersonTimeline, TimelineItem, TimelineKind } from "@/lib/contracts";
import { db } from "@/lib/store";
import { ensureSeeded } from "@/lib/boot";

export const dynamic = "force-dynamic";

const KIND_BY_SOURCE: Record<string, TimelineKind> = { telegram: "note", web: "note", voice: "voice", seed: "note", linkedin: "linkedin", gmail: "gmail", calendar: "calendar", meeting: "meeting", slack: "note" };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ensureSeeded();
  const { id } = await ctx.params;
  const d = db();
  const person = d.people.find((p) => p.id === id);
  if (!person) return NextResponse.json({ error: "not found" }, { status: 404 });

  const items: TimelineItem[] = [];
  const connectedOn = person.connectedOn || d.messages.find((m) => m.personIds.includes(id) && m.text.startsWith("Connected on LinkedIn"))?.ts;
  if (connectedOn) items.push({ id: `conn_${id}`, kind: "connected", date: connectedOn, title: "Connected on LinkedIn", synthetic: false });

  // Seed-pack items (calendar, Gmail, LinkedIn chats, Luma, meetings, promises, voice)
  for (const t of d.timeline || []) if (t.personIds.includes(id)) items.push({ id: t.id, kind: t.kind, date: t.date, title: t.title, body: t.body, status: t.status, location: t.location, synthetic: t.synthetic });

  // Notes captured in Circleback (Telegram, web, voice, seeded notes, generated chats), skipping ones already shown
  const seen = new Set(items.map((i) => `m_${i.id}`));
  for (const m of d.messages) {
    if (!m.personIds.includes(id) || seen.has(m.id) || m.id.startsWith("m_tl_") || m.text.startsWith("Connected on LinkedIn")) continue;
    const synthChat = m.text.startsWith("Synthetic chat");
    items.push({
      id: m.id,
      kind: synthChat ? "linkedin" : KIND_BY_SOURCE[m.source] || "note",
      date: m.ts,
      title: synthChat ? "LinkedIn messages" : m.text.startsWith("[calendar]") ? m.text.replace("[calendar] ", "") : m.source === "telegram" ? "Telegram note" : "Note",
      body: synthChat ? m.text.split("\n").slice(1).join("\n") : m.text.startsWith("[calendar]") ? undefined : m.text,
      synthetic: m.seeded,
    });
  }
  // Open promises captured in Circleback
  for (const p of d.promises) {
    if (p.personId !== id || (d.timeline || []).some((t) => t.kind === "promise" && t.title === p.text && t.personIds.includes(id))) continue;
    items.push({ id: p.id, kind: "promise", date: p.due ? new Date(p.due).toISOString() : new Date().toISOString(), title: p.text, body: p.direction === "i_owe" ? "You promised" : `${person.name.split(" ")[0]} promised`, status: p.status === "kept" ? "kept" : "open", synthetic: false });
  }

  items.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const counts: PersonTimeline["counts"] = {};
  for (const i of items) counts[i.kind] = (counts[i.kind] || 0) + 1;
  const out: PersonTimeline = {
    person,
    linkedinUrl: person.linkedinUrl,
    connectedOn,
    metAt: person.metAt,
    counts,
    openPromises: items.filter((i) => i.kind === "promise" && i.status === "open").length,
    items,
  };
  return NextResponse.json(out);
}
