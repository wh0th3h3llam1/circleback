// Demo seed for the Personal Agents Hackathon story: the user's own history (an application, a past hackathon,
// current research) plus the people involved. All rows are seeded=true. The judges themselves come from the
// real Luma page; this only adds the user's history with them.
import type { Edge, Message, Person, TrailStep } from "./contracts";
import * as sie from "./sie";
import * as s2 from "./s2";
import * as cog from "./cognee";
import { db, recomputeTiers, save } from "./store";

type P = Omit<Person, "tier" | "points" | "telegramLinked" | "seeded">;
const PEOPLE: P[] = [
  { id: "michael-moyo", name: "Michael Moyo", org: "Ocular AI", role: "CEO & Co-Founder", pillars: ["career"], topics: ["computer vision", "data infrastructure", "hiring ML engineers"], met: false, summary: "CEO of Ocular AI (YC W24). Ocular is hiring a Founding Machine Learning Engineer." },
  { id: "veljko-kovac", name: "Veljko Kovac", org: "Cognee", role: "Head of FDE", pillars: ["career", "work"], topics: ["agent memory", "knowledge graphs"], met: true, summary: "Judged the Hive Mind Hackathon where you placed 2nd." },
  { id: "daniel-svonava", name: "Daniel Svonava", org: "Superlinked", role: "Founder & CEO", pillars: ["career", "work"], topics: ["vector search", "inference"], met: true, summary: "Judged the Hive Mind Hackathon where you placed 2nd." },
  { id: "rahul-parundekar", name: "Rahul Parundekar", org: "Superlinked", role: "DevRel", pillars: ["career", "work"], topics: ["developer relations", "agents"], met: true, summary: "Judged the Hive Mind Hackathon where you placed 2nd." },
  { id: "sam-fraser", name: "Sam Fraser", org: "Arcee AI", role: "Product", pillars: ["career"], topics: ["long-running agents", "small language models", "efficient inference"], met: false, summary: "Works on long-running agent systems and efficient open-weight models at Arcee AI." },
];

const day = (iso: string) => new Date(iso).toISOString();
type N = [string, string, string[], string]; // date, text, people, source
const NOTES: N[] = [
  ["2026-11-18T17:00:00Z", "Applied to Ocular AI for the Founding Machine Learning Engineer role. Ocular's CEO is Michael Moyo.", ["michael-moyo"], "gmail"],
  ["2026-09-27T20:00:00Z", "Placed 2nd at the Hive Mind Hackathon. Judges were Veljko Kovac (Cognee), Daniel Svonava and Rahul Parundekar (Superlinked); talked with all three about our agent memory demo.", ["veljko-kovac", "daniel-svonava", "rahul-parundekar"], "web"],
  ["2026-11-10T18:00:00Z", "My SJSU graduate research: efficient LLM inference for agents (KV-cache reuse, small models for long-running agent loops).", [], "voice"],
  ["2026-11-12T18:00:00Z", "Sam Fraser at Arcee AI works on long-running agent systems and efficient small models, close to my SJSU inference research.", ["sam-fraser"], "web"],
];

export async function seedHackathonDemo(): Promise<{ people: number; notes: number; trail: TrailStep[] }> {
  const d = db();
  const trail: TrailStep[] = [];
  for (const p of PEOPLE) {
    const existing = d.people.find((x) => x.id === p.id || x.name === p.name);
    if (existing) Object.assign(existing, p, { id: existing.id });
    else d.people.push({ ...p, tier: "known", points: 0, telegramLinked: false, seeded: true });
    if (p.met && !d.edges.some((e) => e.from === "me" && e.to === p.id)) d.edges.push({ from: "me", to: p.id, kind: "knows", strength: 0.6, evidence: "Hive Mind Hackathon judge" } as Edge);
  }
  const msgs: Message[] = NOTES.map(([ts, text, ids, source], i) => ({ id: `demo_${i}`, source: source as Message["source"], pillar: "career", text, personIds: ids, ts: day(ts), seeded: true }));
  d.messages = d.messages.filter((m) => !m.id.startsWith("demo_"));
  d.timeline = (d.timeline || []).filter((t) => !t.id.startsWith("demo_"));
  d.timeline.push(
    { id: "demo_tl_app", kind: "gmail", date: day("2026-11-18T17:00:00Z"), title: "Application: Founding Machine Learning Engineer, Ocular AI", body: "You applied on Nov 18.", synthetic: true, personIds: ["michael-moyo"] },
    ...["veljko-kovac", "daniel-svonava", "rahul-parundekar"].map((id) => ({ id: `demo_tl_hive_${id}`, kind: "luma" as const, date: day("2026-09-27T20:00:00Z"), title: "Hive Mind Hackathon · you placed 2nd", body: "Judge at Hive Mind. You talked about your agent memory demo.", synthetic: true, personIds: [id] })),
    { id: "demo_tl_sam", kind: "note", date: day("2026-11-12T18:00:00Z"), title: "Research overlap", body: "Sam works on long-running agents and efficient small models. Your SJSU research is efficient LLM inference for agents.", synthetic: true, personIds: ["sam-fraser"] },
  );
  const t = Date.now();
  const vecs = await sie.embed(msgs.map((m) => m.text));
  msgs.forEach((m, i) => d.messages.push({ ...m, vec: vecs[i] }));
  d.goal = "Land a founding ML or agent-systems role; I research efficient LLM inference at SJSU";
  recomputeTiers();
  save();
  trail.push({ sponsor: "SIE", label: "encode", detail: `${msgs.length} notes`, ms: Date.now() - t, real: true });
  if (s2.s2Enabled()) await s2.bulkUpsertMessages(msgs, vecs);
  if (cog.cogneeEnabled()) {
    await cog.addText(msgs.map((m) => `${m.ts.slice(0, 10)} ${m.text}`), ["source:demo", "pillar:career"]);
    await cog.cognify();
  }
  return { people: PEOPLE.length, notes: msgs.length, trail };
}
