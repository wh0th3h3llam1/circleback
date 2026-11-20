// Capture pipeline: note -> SIE extract (GLiNER2 + LLM JSON) -> people/promises -> SIE embed -> SingleStore + Cognee.
import type { IngestResult, Message, Person, Pillar, Promise as PromiseRow, Source } from "./contracts";
import { PILLARS } from "./contracts";
import * as sie from "./sie";
import * as cog from "./cognee";
import * as s2 from "./s2";
import { db, findPerson, newId, recomputeTiers, save, slug } from "./store";
import { Trail } from "./trail";

interface Extracted {
  people: { name: string; org?: string; role?: string; topics?: string[]; knows?: string[] }[];
  pillar: Pillar;
  promises: { person: string; text: string; direction: "i_owe" | "they_owe"; due?: string | null }[];
}

const SYSTEM = `You turn a short personal note into facts for a relationship memory.
Schema: {"people":[{"name":"full name as written","org":"","role":"","topics":["short topic"],"knows":["names of other people in the note they know"]}],
"pillar":"work|family|career|projects",
"promises":[{"person":"name","text":"what was promised, imperative, under 8 words","direction":"i_owe|they_owe","due":"YYYY-MM-DD or null"}]}
Rules: never include the note's author ("I", "me") as a person. Only facts stated in the note. Family and close friends -> family. Jobs, mentors, recruiters, roles -> career. Side projects, startups, investors -> projects. Day job and colleagues -> work.`;

export async function ingest(text: string, source: Source = "web", pillarHint?: Pillar): Promise<IngestResult> {
  const trail = new Trail();
  const d = db();
  const today = new Date().toISOString().slice(0, 10);

  const entities = await trail.tryRun(
    "SIE",
    "extract · GLiNER2",
    () => sie.extractEntities(text, ["person", "organization", "job title", "topic"]),
    (e) => (e.length ? e.map((x) => `${x.label}: ${x.text}`).join(" · ") : "no entities"),
    () => [] as sie.Entity[],
  );

  const ex = await trail.tryRun<Extracted>(
    "SIE",
    `chat · ${sie.SIE_MODELS.chat.split("/").pop()}`,
    () => sie.chatJson<Extracted>(SYSTEM, `Today is ${today}. Entities spotted: ${JSON.stringify(entities.map((e) => [e.label, e.text]))}\nNote: ${text}`),
    (r) => `pillar=${r.pillar} · ${r.people?.length || 0} people · ${r.promises?.length || 0} promises`,
    () => ({
      people: entities.filter((e) => e.label === "person").map((e) => ({ name: e.text })),
      pillar: pillarHint || "work",
      promises: [],
    }),
  );

  const pillar: Pillar = pillarHint || (PILLARS.includes(ex.pillar) ? ex.pillar : "work");
  const touched: Person[] = [];
  for (const raw of ex.people || []) {
    if (!raw.name || /^(i|me|myself)$/i.test(raw.name.trim())) continue;
    let p = findPerson(raw.name);
    if (!p) {
      let id = slug(raw.name);
      while (d.people.some((x) => x.id === id)) id += "-2";
      p = { id, name: raw.name.trim(), org: raw.org || undefined, role: raw.role || undefined, pillars: [pillar], topics: raw.topics || [], tier: "known", points: 0, met: true, telegramLinked: false, seeded: false };
      d.people.push(p);
      d.edges.push({ from: "me", to: p.id, kind: pillar === "family" ? "family" : "knows", strength: 0.5 });
    } else {
      if (!p.org && raw.org) p.org = raw.org;
      if (!p.role && raw.role) p.role = raw.role;
      if (!p.pillars.includes(pillar)) p.pillars.push(pillar);
      p.topics = Array.from(new Set([...p.topics, ...(raw.topics || [])])).slice(0, 8);
    }
    touched.push(p);
  }
  // relationships stated in the note
  for (const raw of ex.people || []) {
    const a = findPerson(raw.name || "");
    for (const k of raw.knows || []) {
      const b = findPerson(k);
      if (a && b && a.id !== b.id && !d.edges.some((e) => (e.from === a.id && e.to === b.id) || (e.from === b.id && e.to === a.id))) {
        d.edges.push({ from: a.id, to: b.id, kind: "knows", strength: 0.6, evidence: text.slice(0, 120) });
      }
    }
  }

  const message: Message = { id: newId("msg"), source, pillar, text, personIds: touched.map((p) => p.id), ts: new Date().toISOString(), seeded: false };
  const promises: PromiseRow[] = [];
  for (const pr of ex.promises || []) {
    const p = findPerson(pr.person || "");
    if (!p || !pr.text) continue;
    promises.push({ id: newId("pr"), personId: p.id, text: pr.text, direction: pr.direction === "they_owe" ? "they_owe" : "i_owe", due: pr.due || undefined, status: "open", sourceMessageId: message.id });
  }

  const vec = await trail.tryRun(
    "SIE",
    "encode · bge-m3",
    async () => (await sie.embed([text]))[0],
    (v) => `${v.length}-dim vector`,
    () => undefined as unknown as number[],
  );

  d.messages.push({ ...message, vec });
  d.promises.push(...promises);
  recomputeTiers();
  save();

  if (s2.s2Enabled()) {
    await trail.tryRun(
      "SingleStore",
      "write · messages, people, promises",
      async () => {
        await s2.upsertMessage(message, vec);
        await s2.upsertPeople(touched);
        await s2.upsertPromises(promises);
        await s2.audit("ingest", { messageId: message.id, people: touched.map((p) => p.id) });
        return true;
      },
      () => "1 message (VECTOR 1024 + full-text) · audit_log row",
      () => false,
    );
  } else {
    trail.note("Local", "store", "SingleStore not configured; saved to local store");
  }

  if (cog.cogneeEnabled()) {
    await trail.tryRun(
      "Cognee",
      `remember · ${cog.BRAIN}`,
      async () => {
        const names = touched.map((p) => `${p.name}${p.org ? ` (${p.role ? p.role + ", " : ""}${p.org})` : ""}`).join("; ");
        await cog.addText([`${message.ts.slice(0, 10)} ${text}${names ? `\nPeople: ${names}` : ""}`], [`source:${source}`, `pillar:${pillar}`]);
        await cog.cognify();
        return true;
      },
      () => `node sets source:${source}, pillar:${pillar} · career prompt · cognify running`,
      () => false,
    );
  }

  return { message, people: touched, promises, trail: trail.steps };
}
