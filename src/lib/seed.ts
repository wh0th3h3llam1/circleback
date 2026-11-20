// Demo data: fictional people and notes across the four pillars. Every row is marked seeded=true and labeled "demo data" in the UI.
import type { Edge, EventItem, Person, Pillar, Promise as PromiseRow } from "./contracts";
import type { Db, StoredMessage } from "./store";

const daysAgo = (n: number, h = 10) => {
  const d = new Date(Date.now() - n * 86400000);
  d.setUTCHours(h, 0, 0, 0);
  return d.toISOString();
};
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

type P = Omit<Person, "tier" | "points" | "telegramLinked" | "seeded" | "lastContact">;
const people: P[] = [
  { id: "maya", name: "Maya Chen", org: "Lumen Labs", role: "Staff engineer", pillars: ["work", "career"], topics: ["payments infra", "realtime systems"], met: true, summary: "Former teammate for 4 years; now staff engineer at Lumen Labs." },
  { id: "arjun", name: "Arjun Rao", org: "Orbit", role: "Cofounder", pillars: ["projects"], topics: ["go-to-market", "fundraising"], met: true, summary: "Cofounder on the side project." },
  { id: "mom", name: "Mom", pillars: ["family"], topics: ["family"], met: true },
  { id: "sam", name: "Sam Rivera", role: "College friend", pillars: ["family"], topics: ["climbing", "music"], met: true, summary: "College roommate, closest friend." },
  { id: "priya", name: "Priya Nair", org: "Northwind Health", role: "VP Engineering", pillars: ["career"], topics: ["engineering leadership", "healthcare", "mentoring"], met: true, summary: "Former manager and career mentor." },
  { id: "diego", name: "Diego Alvarez", org: "Lumen Labs", role: "Infra engineer", pillars: ["work"], topics: ["kubernetes", "observability"], met: true },
  { id: "jordan", name: "Jordan Lee", role: "Product designer (freelance)", pillars: ["projects"], topics: ["design systems", "3D UI"], met: true },
  { id: "hannah", name: "Hannah Kim", org: "Fieldstone Talent", role: "Technical recruiter", pillars: ["career"], topics: ["AI hiring", "startups"], met: true },
  { id: "tom", name: "Tom Becker", role: "Angel investor", pillars: ["projects", "career"], topics: ["pre-seed", "consumer AI"], met: true },
  { id: "aisha", name: "Aisha Bello", org: "Corvid Research", role: "ML researcher", pillars: ["work", "projects"], topics: ["retrieval", "embeddings", "evals"], met: true, summary: "Met at a retrieval hackathon in October." },
  { id: "ravi", name: "Ravi Menon", role: "Zoning lawyer", pillars: ["projects"], topics: ["real estate law"], met: true },
  { id: "chloe", name: "Chloe Martin", org: "Atlas Retail", role: "Product manager", pillars: ["career"], topics: ["retail", "checkout", "product management"], met: true },
  { id: "ben", name: "Ben Ortiz", role: "Community organizer", pillars: ["work"], topics: ["developer community", "events"], met: true },
  // Second-degree: known only through someone in your circle.
  { id: "lena", name: "Lena Park", org: "Sonance", role: "Head of Voice AI", pillars: ["work", "career"], topics: ["voice agents", "speech", "realtime audio", "design partners"], met: false, summary: "Maya's former teammate; leads voice AI at Sonance." },
  { id: "marcus", name: "Marcus Wu", org: "Atlas Retail", role: "Head of Product", pillars: ["career"], topics: ["retail", "product management", "hiring PMs"], met: false, summary: "Chloe's manager; worked with Priya years ago." },
  { id: "nora", name: "Nora Feld", org: "Tidewater Ventures", role: "Partner", pillars: ["projects"], topics: ["seed investing", "AI agents"], met: false, summary: "Tom's co-investor." },
];

const edges: Edge[] = [
  { from: "maya", to: "lena", kind: "colleague", strength: 0.9, evidence: "Worked together at Lumen Labs for 3 years" },
  { from: "maya", to: "diego", kind: "colleague", strength: 0.6 },
  { from: "priya", to: "marcus", kind: "colleague", strength: 0.6, evidence: "Worked together at Northwind" },
  { from: "chloe", to: "marcus", kind: "colleague", strength: 0.8, evidence: "Marcus is Chloe's manager" },
  { from: "tom", to: "nora", kind: "knows", strength: 0.8, evidence: "Co-invested twice" },
  { from: "arjun", to: "jordan", kind: "knows", strength: 0.6 },
  { from: "aisha", to: "lena", kind: "knows", strength: 0.3, evidence: "Spoke on the same panel once" },
];

type M = [number, Pillar, string, string[]]; // daysAgo, pillar, text, people
const notes: M[] = [
  [2, "work", "Coffee with Maya. She said her old teammate Lena Park now leads voice AI at Sonance and is looking for design partners building voice agents. Maya offered to intro me anytime.", ["maya", "lena"]],
  [9, "work", "[calendar] 1:1 with Maya Chen, catch-up on realtime systems.", ["maya"]],
  [30, "work", "[calendar] Lunch with Maya and Diego at Lumen Labs.", ["maya", "diego"]],
  [5, "projects", "Arjun and I agreed I'd send him the pitch deck draft by Friday before the Tidewater call.", ["arjun"]],
  [1, "projects", "[calendar] Standup with Arjun about the Orbit demo.", ["arjun"]],
  [12, "projects", "[calendar] Design review with Jordan for the 3D switchboard.", ["jordan"]],
  [6, "projects", "Jordan wants to try a copper-wire look for the graph. Arjun loves it.", ["jordan", "arjun"]],
  [3, "family", "Call with Mom, she wants us all home for Thanksgiving. Promised to book my flight this week.", ["mom"]],
  [24, "family", "Climbing with Sam. He just moved to Oakland.", ["sam"]],
  [21, "career", "Dinner with Priya. She thinks I'm ready for a staff role. She worked with Marcus Wu at Northwind years ago.", ["priya", "marcus"]],
  [40, "career", "[calendar] Quarterly mentoring session with Priya Nair.", ["priya"]],
  [15, "career", "Hannah from Fieldstone pinged about AI infra roles at early startups. Said she would send a shortlist.", ["hannah"]],
  [18, "career", "Met Chloe Martin at the retail tech meetup. She's a PM at Atlas Retail; her manager Marcus Wu is hiring PMs for the checkout team.", ["chloe", "marcus"]],
  [26, "projects", "Tom Becker said he'd introduce us to Nora Feld at Tidewater once we have a demo.", ["tom", "nora"]],
  [33, "projects", "[calendar] Coffee with Tom Becker about pre-seed.", ["tom"]],
  [27, "work", "Met Aisha Bello at the retrieval hackathon. She works on embeddings and evals at Corvid Research. I promised to share our eval notebook.", ["aisha"]],
  [60, "projects", "Ravi Menon explained zoning rules for the co-working space idea.", ["ravi"]],
  [14, "work", "Ben Ortiz runs the SF agents meetup and wants speakers for December.", ["ben"]],
  [4, "work", "Diego fixed the observability dashboards; owes me the runbook doc.", ["diego"]],
  [8, "work", "Maya mentioned Sonance is piloting realtime voice agents with healthcare clinics.", ["maya", "lena"]],
];

const promises: Omit<PromiseRow, "sourceMessageId">[] = [
  { id: "pr_deck", personId: "arjun", text: "Send the pitch deck draft", direction: "i_owe", due: inDays(1), status: "open" },
  { id: "pr_flight", personId: "mom", text: "Book the Thanksgiving flight", direction: "i_owe", due: inDays(3), status: "open" },
  { id: "pr_eval", personId: "aisha", text: "Share the eval notebook", direction: "i_owe", due: inDays(-20), status: "open" },
  { id: "pr_short", personId: "hannah", text: "Send the AI infra role shortlist", direction: "they_owe", due: inDays(-5), status: "open" },
  { id: "pr_runbook", personId: "diego", text: "Send the runbook doc", direction: "they_owe", due: inDays(2), status: "open" },
];

export function seedDb(): Db {
  const me: Person = { id: "me", name: "You", pillars: ["work", "family", "career", "projects"], topics: [], tier: "inner", points: 0, met: true, telegramLinked: false, seeded: true };
  const ps: Person[] = [me, ...people.map((p) => ({ ...p, tier: "known" as const, points: 0, telegramLinked: false, seeded: true }))];
  const messages: StoredMessage[] = notes.map(([d, pillar, text, ids], i) => ({
    id: `seed_${i}`,
    source: "seed",
    pillar,
    text,
    personIds: ids,
    ts: daysAgo(d),
    seeded: true,
  }));
  const pr: PromiseRow[] = promises.map((p) => ({
    ...p,
    sourceMessageId: messages.find((m) => m.personIds.includes(p.personId))?.id || "seed_0",
  }));
  const meEdges: Edge[] = ps
    .filter((p) => p.id !== "me" && p.met)
    .map((p) => ({ from: "me", to: p.id, kind: p.pillars.includes("family") ? "family" : "knows", strength: 0.5 }));
  const events: EventItem[] = [
    {
      id: "ev_retail",
      source: "partiful",
      url: "",
      title: "Retail Product Mixer (demo)",
      start: new Date(Date.now() + 4 * 86400000).toISOString(),
      location: "Atlas Retail office, SoMa",
      hosts: ["Chloe Martin", "Marcus Wu"],
      description: "Atlas Retail's product team hosts PMs and designers. The checkout team is hiring product managers; Marcus Wu will talk about AI agents in checkout.",
      attendees: 64,
      seeded: true,
    },
    {
      id: "ev_voice",
      source: "luma",
      url: "",
      title: "Voice AI Builders Night (demo)",
      start: new Date(Date.now() + 6 * 86400000).toISOString(),
      location: "Sonance HQ, Mission Bay",
      hosts: ["Lena Park"],
      description: "Sonance demos realtime voice agents and looks for design partners and product hires. Lightning talks on speech and agent UX.",
      attendees: 120,
      seeded: true,
    },
  ];
  return {
    people: ps,
    edges: [...meEdges, ...edges],
    messages,
    promises: pr,
    telegram: { links: {} },
    pinnedInner: ["maya", "arjun", "mom", "sam"],
    goal: "Land a product role building AI agents, ideally voice agents or AI in retail checkout",
    events,
  };
}
