// Synthetic LinkedIn-style chats between Me and a sample of the imported connections, for the demo.
// Every thread is clearly labeled: seeded=true, text starts with "Synthetic chat", node set source:synthetic.
import type { Message, Person, Promise as PromiseRow, TrailStep } from "./contracts";
import * as sie from "./sie";
import * as s2 from "./s2";
import * as cog from "./cognee";
import { db, newId, recomputeTiers, save } from "./store";

interface Thread {
  id: string;
  messages: { from: "me" | "them"; text: string; daysAfterConnect: number }[];
  promise?: { text: string; direction: "i_owe" | "they_owe"; dueInDays: number } | null;
}

const SYSTEM = `You write realistic, natural LinkedIn direct-message threads between "Me" and one connection each.
Me is a software engineer and product builder, currently at the Personal Agents Hackathon in San Francisco, looking for a product role building AI agents.
For each person, write 2-4 short messages (1-2 sentences each), alternating sides, in a casual professional tone, varied:
- simple openers: "Hi!", "Hey, great to connect", "How are you doing?", "Thanks for accepting"
- "great meeting you at <event>" for people connected in November 2026 (met at the hackathon or SF AI events)
- light career talk that fits THEIR role and company: asking about their team, whether they're hiring, a coffee chat, a referral, congrats on a new role, sharing a demo
- some threads stay small talk only; some end without a reply from them
Never invent salaries, private facts, or anything negative. No emojis except an occasional one. No placeholders.
Occasionally (about 1 in 4) one side promises something concrete (send resume, share demo, intro to a teammate, grab coffee next week): put it in "promise".
Reply with JSON only: {"threads":[{"id":"<id as given>","messages":[{"from":"me|them","text":"...","daysAfterConnect":0}],"promise":null}]}`;

/** One SIE call over all synthetic threads: pull out concrete commitments ("I'll send my resume") as promises. */
export async function extractSyntheticPromises(): Promise<{ promises: number; trail: TrailStep[] }> {
  const d = db();
  const threads = d.messages.filter((m) => m.text.startsWith("Synthetic chat") && !d.promises.some((p) => p.sourceMessageId === m.id));
  const t = Date.now();
  const r = await sie.chatJson<{ promises: { idx: number; text: string; direction: "i_owe" | "they_owe"; dueInDays: number }[] }>(
    `Find concrete commitments in these chat threads. "Me" is the owner. Schema: {"promises":[{"idx":0,"text":"imperative, under 8 words","direction":"i_owe|they_owe","dueInDays":3}]}. i_owe = Me promised; they_owe = the other person promised. Skip vague pleasantries.`,
    threads.map((m, i) => `#${i}\n${m.text}`).join("\n\n"),
    2000,
  );
  const now = Date.now();
  const added: PromiseRow[] = [];
  for (const p of r.promises || []) {
    const m = threads[p.idx];
    if (!m || !p.text) continue;
    added.push({ id: newId("pr"), personId: m.personIds[0], text: p.text, direction: p.direction === "they_owe" ? "they_owe" : "i_owe", due: new Date(now + (p.dueInDays ?? 5) * 86400000).toISOString().slice(0, 10), status: "open", sourceMessageId: m.id });
  }
  d.promises.push(...added);
  recomputeTiers();
  save();
  if (s2.s2Enabled()) await s2.upsertPromises(added);
  return { promises: added.length, trail: [{ sponsor: "SIE", label: "extract promises", detail: `${added.length} promises from ${threads.length} threads`, ms: Date.now() - t, real: true }] };
}

export async function generateSyntheticChats(count = 40): Promise<{ threads: number; promises: number; trail: TrailStep[] }> {
  const d = db();
  const trail: TrailStep[] = [];
  // Real imported connections (not demo people), prefer recent ones, then a deterministic spread of the rest.
  const already = new Set(d.messages.filter((m) => m.text.startsWith("Synthetic chat")).flatMap((m) => m.personIds));
  const imported = d.people.filter((p) => !p.seeded && p.org && p.role && p.id !== "me" && !already.has(p.id));
  const connectedOn = (p: Person) => d.messages.find((m) => m.source === "linkedin" && m.personIds.includes(p.id) && m.text.startsWith("Connected"))?.ts || new Date().toISOString();
  const byRecent = [...imported].sort((a, b) => connectedOn(b).localeCompare(connectedOn(a)));
  const recent = byRecent.slice(0, Math.ceil(count / 2));
  const rest = byRecent.slice(Math.ceil(count / 2)).filter((_, i) => i % 23 === 0).slice(0, count - recent.length);
  const pick = [...recent, ...rest];

  const threads: { p: Person; t: Thread }[] = [];
  const batches: Person[][] = [];
  for (let i = 0; i < pick.length; i += 8) batches.push(pick.slice(i, i + 8));
  const t0 = Date.now();
  const results = await Promise.all(
    batches.map(async (b) => {
      const people = b.map((p) => ({ id: p.id, name: p.name, role: p.role, company: p.org, connected: connectedOn(p).slice(0, 10) }));
      try {
        const r = await sie.chatJson<{ threads: Thread[] }>(SYSTEM, `People:\n${JSON.stringify(people)}`, 2600);
        return r.threads || [];
      } catch {
        return [] as Thread[];
      }
    }),
  );
  for (const t of results.flat()) {
    const p = pick.find((x) => x.id === t.id);
    if (p && t.messages?.length) threads.push({ p, t });
  }
  trail.push({ sponsor: "SIE", label: `generate · ${sie.SIE_MODELS.chat.split("/").pop()}`, detail: `${threads.length} synthetic threads for ${pick.length} connections`, ms: Date.now() - t0, real: true });

  const msgs: Message[] = [];
  const promises: PromiseRow[] = [];
  const now = Date.now();
  for (const { p, t } of threads) {
    const base = new Date(connectedOn(p)).getTime();
    const lastDays = Math.max(...t.messages.map((m) => m.daysAfterConnect || 0));
    const ts = new Date(Math.min(now, base + lastDays * 86400000)).toISOString();
    const first = p.name.split(" ")[0];
    const text =
      `Synthetic chat (demo) on LinkedIn with ${p.name}, ${p.role} at ${p.org}:\n` +
      t.messages.map((m) => `${m.from === "me" ? "Me" : first}: ${m.text}`).join("\n");
    const msg: Message = { id: newId("syn"), source: "linkedin", pillar: "career", text, personIds: [p.id], ts, seeded: true };
    msgs.push(msg);
    if (t.promise?.text) {
      promises.push({
        id: newId("pr"),
        personId: p.id,
        text: t.promise.text,
        direction: t.promise.direction === "they_owe" ? "they_owe" : "i_owe",
        due: new Date(now + (t.promise.dueInDays ?? 5) * 86400000).toISOString().slice(0, 10),
        status: "open",
        sourceMessageId: msg.id,
      });
    }
  }

  let vecs: number[][] = [];
  const t1 = Date.now();
  try {
    for (let i = 0; i < msgs.length; i += 64) vecs.push(...(await sie.embed(msgs.slice(i, i + 64).map((m) => m.text))));
    trail.push({ sponsor: "SIE", label: "encode batch · bge-m3", detail: `${vecs.length} vectors`, ms: Date.now() - t1, real: true });
  } catch {
    vecs = [];
  }
  msgs.forEach((m, i) => d.messages.push({ ...m, vec: vecs[i] }));
  d.promises.push(...promises);
  recomputeTiers();
  save();

  if (s2.s2Enabled()) {
    const t2 = Date.now();
    await s2.bulkUpsertMessages(msgs, vecs);
    await s2.bulkUpsertPeople(threads.map((x) => x.p));
    for (const pr of promises) await s2.upsertPromises([pr]);
    trail.push({ sponsor: "SingleStore", label: "write", detail: `${msgs.length} threads, ${promises.length} promises`, ms: Date.now() - t2, real: true });
  }
  if (cog.cogneeEnabled()) {
    const t3 = Date.now();
    const docs: string[] = [];
    for (let i = 0; i < msgs.length; i += 8) docs.push(msgs.slice(i, i + 8).map((m) => `${m.ts.slice(0, 10)} ${m.text}`).join("\n\n"));
    await cog.addText(docs, ["source:synthetic", "source:linkedin_chat", "pillar:career"]);
    await cog.cognify();
    trail.push({ sponsor: "Cognee", label: `remember · ${cog.BRAIN}`, detail: `${msgs.length} threads in ${docs.length} documents · node sets source:synthetic, source:linkedin_chat`, ms: Date.now() - t3, real: true });
  }
  return { threads: msgs.length, promises: promises.length, trail };
}
