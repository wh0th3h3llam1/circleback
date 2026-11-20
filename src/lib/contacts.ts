// Fast import for structured contact rows (LinkedIn Connections export, Sheets, CSV) synced by Airbyte.
// Maps columns straight to people (no LLM per row), embeds all notes in one SIE batch,
// writes to SingleStore, and adds one Cognee memory batch for the career pillar.
import type { Message, Person, TrailStep } from "./contracts";
import * as sie from "./sie";
import * as s2 from "./s2";
import * as cog from "./cognee";
import { db, findPerson, newId, recomputeTiers, save, slug } from "./store";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Finds the contact columns whatever the source named them ("First Name", "first_name", "FirstName"...). */
export function contactColumns(cols: string[]) {
  const by = new Map(cols.map((c) => [norm(c), c]));
  const pick = (...keys: string[]) => keys.map((k) => by.get(k)).find(Boolean);
  const m = {
    first: pick("firstname", "first", "givenname"),
    last: pick("lastname", "last", "surname", "familyname"),
    name: pick("name", "fullname"),
    company: pick("company", "organization", "org", "companyname"),
    position: pick("position", "title", "jobtitle", "role"),
    connectedOn: pick("connectedon", "connected", "date"),
    url: pick("url", "profileurl", "linkedinurl"),
    notes: pick("notes", "note", "comment"),
  };
  const ok = !!(m.first || m.name) && !!(m.company || m.position);
  return { ...m, ok };
}

export async function importContacts(table: string, cols: string[], rows: Record<string, unknown>[], keyCol?: string) {
  const c = contactColumns(cols);
  const d = db();
  d.airbyteImported = d.airbyteImported || [];
  const trail: TrailStep[] = [];
  const str = (r: Record<string, unknown>, k?: string) => (k && r[k] != null ? String(r[k]).trim() : "");

  const touched: Person[] = [];
  const msgs: Message[] = [];
  let skipped = 0;
  const t0 = Date.now();
  rows.forEach((r, i) => {
    const key = `${table}:${keyCol ? str(r, keyCol) : i}`;
    const name = str(r, c.name) || [str(r, c.first), str(r, c.last)].filter(Boolean).join(" ");
    if (!name || d.airbyteImported!.includes(key)) {
      skipped++;
      return;
    }
    const company = str(r, c.company);
    const position = str(r, c.position);
    const notes = str(r, c.notes);
    let p = findPerson(name);
    if (!p) {
      let id = slug(name);
      while (d.people.some((x) => x.id === id)) id += "-2";
      p = { id, name, org: company || undefined, role: position || undefined, pillars: ["career"], topics: [], tier: "known", points: 0, met: true, telegramLinked: false, seeded: false, summary: notes || undefined };
      d.people.push(p);
      d.edges.push({ from: "me", to: p.id, kind: "knows", strength: 0.4 });
    } else {
      p.org = p.org || company || undefined;
      p.role = p.role || position || undefined;
      if (!p.pillars.includes("career")) p.pillars.push("career");
    }
    // Notes that name someone already in the circle become an edge, so intro paths can use them.
    for (const other of d.people) {
      if (other.id === p.id || other.id === "me") continue;
      if (notes && notes.toLowerCase().includes(other.name.toLowerCase()) && !d.edges.some((e) => (e.from === p!.id && e.to === other.id) || (e.from === other.id && e.to === p!.id))) {
        d.edges.push({ from: p.id, to: other.id, kind: "knows", strength: 0.7, evidence: notes.slice(0, 120) });
      }
    }
    const when = str(r, c.connectedOn);
    const ts = when && !Number.isNaN(Date.parse(when)) ? new Date(when).toISOString() : new Date().toISOString();
    msgs.push({
      id: newId("li"),
      source: "linkedin",
      pillar: "career",
      text: `Connected on LinkedIn with ${name}${position ? `, ${position}` : ""}${company ? ` at ${company}` : ""}.${notes ? " " + notes : ""}`,
      personIds: [p.id],
      ts,
      seeded: false,
    });
    touched.push(p);
    d.airbyteImported!.push(key);
  });
  trail.push({ sponsor: "Rules", label: "map columns", detail: `${touched.length} contacts mapped (${skipped} skipped/already imported) · no LLM per row`, ms: Date.now() - t0, real: false });

  if (msgs.length) {
    let vecs: number[][] = [];
    const t1 = Date.now();
    try {
      for (let i = 0; i < msgs.length; i += 64) vecs.push(...(await sie.embed(msgs.slice(i, i + 64).map((m) => m.text))));
      trail.push({ sponsor: "SIE", label: "encode batch · bge-m3", detail: `${vecs.length} vectors`, ms: Date.now() - t1, real: true });
    } catch (e) {
      vecs = [];
      trail.push({ sponsor: "SIE", label: "encode batch", detail: `failed: ${(e as Error).message.slice(0, 100)}`, ms: Date.now() - t1, real: false });
    }
    msgs.forEach((m, i) => d.messages.push({ ...m, vec: vecs[i] }));
    recomputeTiers();
    save();

    if (s2.s2Enabled()) {
      const t2 = Date.now();
      try {
        await s2.bulkUpsertMessages(msgs, vecs);
        await s2.bulkUpsertPeople(touched);
        trail.push({ sponsor: "SingleStore", label: "write · messages, people", detail: `${msgs.length} notes + ${touched.length} people`, ms: Date.now() - t2, real: true });
      } catch (e) {
        trail.push({ sponsor: "SingleStore", label: "write", detail: `failed: ${(e as Error).message.slice(0, 100)}`, ms: Date.now() - t2, real: false });
      }
    }
    if (cog.cogneeEnabled()) {
      const t3 = Date.now();
      try {
        // Group contacts into documents of 30 lines so cognify extracts a graph from ~N/30 docs instead of N tiny ones.
        // Only name, role, company and date go to Cognee (no emails, no profile URLs).
        const docs: string[] = [];
        for (let i = 0; i < msgs.length; i += 30) {
          docs.push(
            "My LinkedIn connections (Me is connected to each person below):\n" +
              msgs
                .slice(i, i + 30)
                .map((m) => `- ${m.ts.slice(0, 10)}: ${m.text.replace("Connected on LinkedIn with ", "")}`)
                .join("\n"),
          );
        }
        for (let i = 0; i < docs.length; i += 10) await cog.addText(docs.slice(i, i + 10), ["source:linkedin", "pillar:career"]);
        await cog.cognify();
        trail.push({ sponsor: "Cognee", label: `remember · ${cog.BRAIN}`, detail: `${msgs.length} contacts in ${docs.length} documents · node sets source:linkedin, pillar:career · career prompt`, ms: Date.now() - t3, real: true });
      } catch (e) {
        trail.push({ sponsor: "Cognee", label: "remember", detail: `failed: ${(e as Error).message.slice(0, 100)}`, ms: Date.now() - t3, real: false });
      }
    }
  } else {
    save();
  }
  return { imported: touched.length, trail };
}
