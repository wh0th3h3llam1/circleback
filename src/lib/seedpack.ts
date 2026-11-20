// Imports the synthetic seed pack (calendar, Gmail, LinkedIn chats, Luma, meeting notes, voice notes) built around the
// user's real LinkedIn connections. Everything is marked synthetic. Feeds person timelines, SingleStore search and Cognee.
import fs from "node:fs";
import path from "node:path";
import type { Message, Person, Promise as PromiseRow, Source, TimelineItem, TrailStep } from "./contracts";
import * as sie from "./sie";
import * as s2 from "./s2";
import * as cog from "./cognee";
import { db, newId, recomputeTiers, save } from "./store";

const DIR = process.env.SEED_PACK_DIR || path.join(process.cwd(), "seed-pack");
const read = <T>(f: string): T[] => {
  const p = path.join(DIR, f);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as T[]) : [];
};
const nameOf = (s: string) => s.replace(/<[^>]*>/, "").trim();
const h01 = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};

type TL = TimelineItem & { personIds: string[] };

export async function importSeedPack(): Promise<{ timeline: number; messages: number; promises: number; matched: number; trail: TrailStep[] }> {
  const d = db();
  const trail: TrailStep[] = [];
  const t0 = Date.now();
  const byName = new Map<string, Person>();
  for (const p of d.people) byName.set(p.name.toLowerCase().trim(), p);
  const pid = (name: string) => byName.get(nameOf(name).toLowerCase())?.id;

  // people.json: LinkedIn URL + connected/met dates
  let matched = 0;
  for (const r of read<{ fullName: string; linkedinUrl?: string; connectedOn?: string; metAt?: string }>("people.json")) {
    const p = byName.get(r.fullName.toLowerCase().trim());
    if (!p) continue;
    matched++;
    p.linkedinUrl = r.linkedinUrl || p.linkedinUrl;
    p.connectedOn = r.connectedOn || p.connectedOn;
    p.metAt = r.metAt || p.metAt;
  }

  const tl: TL[] = [];
  const msgs: Message[] = [];
  const promises: PromiseRow[] = [];
  const now = Date.now();
  const push = (item: Omit<TL, "id" | "synthetic">, msgSource?: Source, msgText?: string) => {
    if (!item.personIds.length) return;
    const id = newId("tl");
    tl.push({ ...item, id, synthetic: true });
    if (msgSource && msgText) msgs.push({ id: `m_${id}`, source: msgSource, pillar: "career", text: msgText, personIds: item.personIds, ts: item.date, seeded: true });
  };

  for (const c of read<{ title: string; start: string; attendees: string[]; location?: string; status?: string }>("calendar.json")) {
    const ids = c.attendees.map(pid).filter((x): x is string => !!x);
    push({ kind: "calendar", date: c.start, title: c.title, body: c.location ? `Calendar · ${c.location}` : "Calendar", location: c.location, status: c.status === "upcoming" ? "upcoming" : "past", personIds: ids });
  }
  for (const g of read<{ subject: string; participants: string[]; messages: { from: string; date: string; body: string }[] }>("gmail.json")) {
    const ids = g.participants.map(pid).filter((x): x is string => !!x);
    const body = g.messages.map((m) => `${nameOf(m.from) === "You" ? "You" : nameOf(m.from).split(" ")[0]}: ${m.body}`).join("\n");
    const date = g.messages[g.messages.length - 1]?.date || g.messages[0]?.date;
    push({ kind: "gmail", date, title: g.subject, body, personIds: ids }, "gmail", `Synthetic email "${g.subject}" with ${g.participants.map(nameOf).filter((n) => n !== "You").join(", ")}:\n${body}`);
  }
  for (const l of read<{ with: string; messages: { from: string; date: string; body: string }[] }>("linkedin.json")) {
    const id = pid(l.with);
    if (!id) continue;
    const body = l.messages.map((m) => `${m.from === "You" ? "You" : m.from.split(" ")[0]}: ${m.body}`).join("\n");
    push({ kind: "linkedin", date: l.messages[0]?.date, title: "LinkedIn messages", body, personIds: [id] }, "linkedin", `Synthetic LinkedIn chat with ${l.with}:\n${body}`);
  }
  for (const e of read<{ name: string; date: string; city?: string; met: string[] }>("luma.json")) {
    const ids = e.met.map(pid).filter((x): x is string => !!x);
    push({ kind: "luma", date: e.date, title: `Met at ${e.name}`, body: `Luma event${e.city ? ", " + e.city : ""}`, location: e.city, personIds: ids });
  }
  for (const m of read<{ title: string; date: string; attendees: string[]; summary: string; decisions: string[]; actionItems: { owner: string; text: string; due: string | null }[] }>("meetings.json")) {
    const ids = m.attendees.map(pid).filter((x): x is string => !!x);
    const body = [`Summary: ${m.summary}`, m.decisions.length ? `Decisions: ${m.decisions.join("; ")}` : "", m.actionItems.length ? `Action items:\n${m.actionItems.map((a) => `- ${a.owner === "You" ? "You" : a.owner}: ${a.text}`).join("\n")}` : ""].filter(Boolean).join("\n");
    push({ kind: "meeting", date: m.date, title: m.title, body, personIds: ids }, "meeting", `Synthetic meeting notes, ${m.title} (${m.date.slice(0, 10)}):\n${body}`);
    for (const a of m.actionItems) {
      if (!ids.length) continue;
      const due = a.due || new Date(new Date(m.date).getTime() + 7 * 86400000).toISOString();
      const past = new Date(due).getTime() < now;
      const status: "kept" | "slipped" | "open" = past ? (h01(a.text + m.date) < 0.6 ? "kept" : "slipped") : "open";
      push({ kind: "promise", date: due, title: a.text, body: status === "kept" ? `Kept on ${due.slice(0, 10)}` : status === "slipped" ? `Was due ${due.slice(0, 10)}. It slipped.` : `Due ${due.slice(0, 10)}`, status, personIds: [ids[0]] });
      if (status === "open") {
        promises.push({ id: newId("pr"), personId: ids[0], text: a.text, direction: a.owner === "You" ? "i_owe" : "they_owe", due: due.slice(0, 10), status: "open", sourceMessageId: tl[tl.length - 1].id });
      }
    }
  }
  for (const v of read<{ date: string; text: string }>("voice.json")) {
    const lower = v.text.toLowerCase();
    const ids = d.people.filter((p) => p.id !== "me" && p.name.includes(" ") && lower.includes(p.name.toLowerCase())).map((p) => p.id).slice(0, 3);
    push({ kind: "voice", date: v.date, title: "Your voice note", body: v.text, personIds: ids }, "voice", `Synthetic voice note: ${v.text}`);
  }
  trail.push({ sponsor: "Rules", label: "map seed pack", detail: `${tl.length} timeline items, ${msgs.length} searchable notes, ${promises.length} open promises, ${matched} people matched`, ms: Date.now() - t0, real: false });

  d.timeline = [...(d.timeline || []).filter((x) => !x.synthetic), ...tl];
  // replace any previous seed-pack messages/promises
  d.messages = d.messages.filter((m) => !m.id.startsWith("m_tl_"));
  d.promises.push(...promises);

  const vecs: number[][] = [];
  const t1 = Date.now();
  try {
    for (let i = 0; i < msgs.length; i += 64) vecs.push(...(await sie.embed(msgs.slice(i, i + 64).map((m) => m.text))));
    trail.push({ sponsor: "SIE", label: "encode batch · bge-m3", detail: `${vecs.length} vectors`, ms: Date.now() - t1, real: true });
  } catch (e) {
    trail.push({ sponsor: "SIE", label: "encode batch", detail: `failed: ${(e as Error).message.slice(0, 80)}`, ms: Date.now() - t1, real: false });
  }
  msgs.forEach((m, i) => d.messages.push({ ...m, vec: vecs[i] }));
  recomputeTiers();
  save();

  if (s2.s2Enabled()) {
    const t2 = Date.now();
    try {
      await s2.bulkUpsertMessages(msgs, vecs);
      await s2.bulkUpsertPeople(d.people.filter((p) => p.id !== "me"));
      for (let i = 0; i < promises.length; i += 50) await s2.upsertPromises(promises.slice(i, i + 50));
      trail.push({ sponsor: "SingleStore", label: "write", detail: `${msgs.length} notes, people tiers, ${promises.length} promises`, ms: Date.now() - t2, real: true });
    } catch (e) {
      trail.push({ sponsor: "SingleStore", label: "write", detail: `failed: ${(e as Error).message.slice(0, 80)}`, ms: Date.now() - t2, real: false });
    }
  }
  if (cog.cogneeEnabled()) {
    const t3 = Date.now();
    try {
      const bySrc: Record<string, Message[]> = {};
      for (const m of msgs) (bySrc[m.source] = bySrc[m.source] || []).push(m);
      let docs = 0;
      for (const [src, list] of Object.entries(bySrc)) {
        const chunks: string[] = [];
        for (let i = 0; i < list.length; i += 25) chunks.push(list.slice(i, i + 25).map((m) => m.text).join("\n\n"));
        for (let i = 0; i < chunks.length; i += 10) await cog.addText(chunks.slice(i, i + 10), [`source:${src}`, "source:synthetic", "pillar:career"]);
        docs += chunks.length;
      }
      await cog.cognify();
      trail.push({ sponsor: "Cognee", label: `remember · ${cog.BRAIN}`, detail: `${msgs.length} notes in ${docs} documents · node sets source:gmail/meeting/voice/linkedin + source:synthetic`, ms: Date.now() - t3, real: true });
    } catch (e) {
      trail.push({ sponsor: "Cognee", label: "remember", detail: `failed: ${(e as Error).message.slice(0, 80)}`, ms: Date.now() - t3, real: false });
    }
  }
  return { timeline: tl.length, messages: msgs.length, promises: promises.length, matched, trail };
}
