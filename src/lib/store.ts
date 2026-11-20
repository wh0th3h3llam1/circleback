// Local source of truth for the graph (people, edges, messages, promises), persisted to data/store.json.
// SingleStore mirrors messages/people/promises for search and SQL; Cognee holds the per-pillar memory graph.
import fs from "node:fs";
import path from "node:path";
import type { Edge, EventItem, Message, Person, Pillar, Promise as PromiseRow, Tier, TimelineItem } from "./contracts";

export interface StoredMessage extends Message {
  vec?: number[];
}

export interface Db {
  people: Person[];
  edges: Edge[];
  messages: StoredMessage[];
  promises: PromiseRow[];
  telegram: { ownerChatId?: number; links: Record<string, number> }; // personId -> chatId
  pinnedInner: string[];
  airbyteImported?: string[]; // row keys already imported from Airbyte-synced tables
  goal?: string; // the user's career goal
  events?: EventItem[];
  timeline?: (TimelineItem & { personIds: string[] })[];
}

const FILE = path.join(process.cwd(), "data", "store.json");
const g = globalThis as unknown as { __cbdb?: Db };

export function db(): Db {
  if (!g.__cbdb) {
    if (fs.existsSync(FILE)) g.__cbdb = JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
    else g.__cbdb = { people: [], edges: [], messages: [], promises: [], telegram: { links: {} }, pinnedInner: [] };
  }
  return g.__cbdb;
}

export function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db()));
}

export function reset(next: Db) {
  g.__cbdb = next;
  save();
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "p";

export function findPerson(name: string): Person | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  const people = db().people;
  return (
    people.find((p) => p.name.toLowerCase() === n) ||
    people.find((p) => p.name.toLowerCase().split(" ")[0] === n) ||
    people.find((p) => n.split(" ")[0] === p.name.toLowerCase().split(" ")[0] && n.split(" ").length > 1 && p.name.toLowerCase().includes(n.split(" ").slice(-1)[0]))
  );
}

// twinwire people-tier-rules: points over the last 90 days, older points fade.
export function recomputeTiers() {
  const d = db();
  const now = Date.now();
  const fade = (iso: string) => {
    const days = (now - new Date(iso).getTime()) / 86400000;
    return days > 90 ? 0 : 1 - days / 120;
  };
  const pts: Record<string, number> = {};
  for (const m of d.messages) {
    for (const id of m.personIds) pts[id] = (pts[id] || 0) + (m.source === "seed" && m.text.startsWith("[calendar]") ? 3 : 2) * fade(m.ts);
  }
  for (const p of d.promises) pts[p.personId] = (pts[p.personId] || 0) + 2;
  for (const p of d.people) {
    if (p.id === "me") continue;
    p.points = Math.round((pts[p.id] || 0) * 10) / 10;
    let tier: Tier = "known";
    if (d.pinnedInner.includes(p.id)) tier = "inner";
    // twinwire rules say close 20+ / good 8+ over a full 90 days of data; scaled down for a few weeks of notes.
    else if (p.points >= Number(process.env.TIER_CLOSE || 6)) tier = "close";
    else if (p.points >= Number(process.env.TIER_GOOD || 3)) tier = "good";
    p.tier = p.met ? tier : "known";
    const last = d.messages.filter((m) => m.personIds.includes(p.id)).map((m) => m.ts).sort().pop();
    if (last) p.lastContact = last;
  }
}

export const tierWeight: Record<Tier, number> = { inner: 1, close: 0.75, good: 0.5, known: 0.25 };

export function primaryPillar(p: Person): Pillar {
  return p.pillars[0] || "work";
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
