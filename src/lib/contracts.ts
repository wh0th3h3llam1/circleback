// Shared contracts between the API (src/app/api, src/lib) and the UI (src/components, src/app/page.tsx).
// Owner: backend. UI imports types only.

export type Pillar = "work" | "family" | "career" | "projects";
export const PILLARS: Pillar[] = ["work", "family", "career", "projects"];

// Closeness tiers, from twinwire people-tier-rules: points over the last 90 days.
export type Tier = "inner" | "close" | "good" | "known";

export type Source = "seed" | "telegram" | "voice" | "web" | "slack" | "linkedin" | "gmail" | "calendar" | "meeting";

export interface Person {
  id: string; // "me" is the user
  name: string;
  org?: string;
  role?: string;
  pillars: Pillar[];
  topics: string[];
  tier: Tier;
  points: number;
  met: boolean; // false = second-degree, known only through someone else
  lastContact?: string; // ISO
  telegramLinked: boolean;
  seeded: boolean; // demo data, labeled in UI
  summary?: string;
  linkedinUrl?: string;
  connectedOn?: string;
  metAt?: string;
}

export interface Edge {
  from: string; // person id ("me" allowed)
  to: string;
  kind: "knows" | "colleague" | "family" | "mentor" | "cofounder" | "friend";
  strength: number; // 0..1
  evidence?: string;
}

export interface Message {
  id: string;
  source: Source;
  pillar: Pillar;
  text: string;
  personIds: string[];
  ts: string; // ISO
  seeded: boolean;
}

export interface Promise {
  id: string;
  personId: string;
  text: string;
  direction: "i_owe" | "they_owe";
  due?: string; // ISO date
  status: "open" | "kept";
  sourceMessageId: string;
}

// One line in the operator log / audit trail. real=false means a local fallback ran instead of the sponsor.
export interface TrailStep {
  sponsor: "SIE" | "Cognee" | "SingleStore" | "Telegram" | "Airbyte" | "Rules" | "Local";
  label: string;
  detail: string;
  ms: number;
  real: boolean;
}

export interface Evidence {
  messageId: string;
  text: string;
  source: Source;
  ts: string;
  pillar: Pillar;
  seeded: boolean;
}

export interface Candidate {
  person: Person;
  score: number; // 0..1
  parts: { relevance: number; tie: number; reach: number; recency: number; memory: number };
  why: string[]; // short human reasons
  path: string[]; // person ids from "me" to target, e.g. ["me","maya","lena"]
  via?: Person; // the connector when not direct
  evidence: Evidence[];
}

export interface Answer {
  query: string;
  pillar?: Pillar;
  candidates: Candidate[];
  draft: { toPersonId: string; text: string; channel: "telegram" | "copy" };
  memoryAnswer?: string; // Cognee recall answer
  reply?: string; // direct answer (fast path, small model)
  route?: { mode: "fast" | "deep"; confidence: number; decider: string; model: string };
  trail: TrailStep[];
}

export interface GraphData {
  people: Person[];
  edges: Edge[];
  counts: { messages: number; promisesOpen: number };
}

export interface Nudge {
  kind: "promise" | "drift";
  personId: string;
  text: string;
  due?: string;
}

export interface IngestResult {
  message: Message;
  people: Person[]; // people created or touched
  promises: Promise[];
  trail: TrailStep[];
}

export interface SponsorStatus {
  sie: boolean;
  cognee: boolean;
  singlestore: boolean;
  telegram: boolean;
  airbyte: boolean;
}

export interface PersonPatch {
  name?: string;
  org?: string;
  role?: string;
  pillars?: Pillar[];
  inner?: boolean; // pin to / unpin from the inner circle
  note?: string; // adds a note (runs the normal capture pipeline)
}

export interface AirbyteStatus {
  reachable: boolean;
  authed: boolean;
  version?: string;
  connections: { id: string; name: string; status: string; lastSync?: string }[];
  imported: number; // people/notes imported into Circleback from Airbyte syncs
  error?: string;
}

// ---- Person timeline (every interaction with one person) ----
export type TimelineKind = "connected" | "luma" | "linkedin" | "gmail" | "calendar" | "meeting" | "voice" | "promise" | "note";
export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  date: string; // ISO
  title: string;
  body?: string; // multi-line allowed ("You: ...\nRosa: ...")
  status?: "kept" | "slipped" | "open" | "upcoming" | "past";
  location?: string;
  synthetic: boolean; // from the synthetic seed pack
}
export interface PersonTimeline {
  person: Person;
  linkedinUrl?: string;
  connectedOn?: string;
  metAt?: string;
  counts: Partial<Record<TimelineKind, number>>;
  openPromises: number;
  items: TimelineItem[]; // oldest first
}
// GET /api/people/[id]/timeline -> PersonTimeline

// ---- Career brain (single Cognee brain per user) ----
export interface BrainNode {
  id: string;
  name: string;
  type: string; // Cognee node type, e.g. "Entity", "EntityType"; entityType holds Person / Company / Role / Event / Skill ...
  entityType?: string;
  description?: string;
}
export interface BrainGraph {
  dataset: string;
  nodeSets: string[]; // node_set tags used when adding memories
  nodes: BrainNode[];
  edges: { source: string; target: string; label: string }[];
  counts: { entities: number; relations: number; documents: number };
  error?: string;
}

export interface EventItem {
  id: string;
  source: "luma" | "partiful";
  url: string;
  title: string;
  start?: string;
  location?: string;
  hosts: string[];
  description?: string;
  attendees?: number;
  seeded: boolean;
}

export interface Opportunity {
  id: string;
  kind: "referral" | "reach_out" | "event" | "reconnect";
  title: string; // e.g. "Ask Chloe for an intro to Marcus Wu (hiring PMs)"
  why: string[];
  score: number; // 0..1
  person?: Person;
  path?: string[];
  event?: EventItem;
  draft?: { toPersonId: string; text: string };
}

export interface OpportunitiesResponse {
  goal: string;
  brainSays?: string; // Cognee recall answer over the single brain
  items: Opportunity[];
  trail: TrailStep[];
  generatedAt: string;
}

// API routes
// GET  /api/brain               -> BrainGraph (the real Cognee graph of the user's single brain)
// GET  /api/goal  · POST /api/goal {goal} -> { goal }
// GET  /api/events              -> EventItem[]
// POST /api/events/import {url} -> { event: EventItem; trail: TrailStep[] }  (Luma or Partiful link)
// GET  /api/opportunities[?refresh=1] -> OpportunitiesResponse (cached until refresh or new data)
// GET  /api/graph               -> GraphData
// POST /api/ingest {text, source?, pillar?} -> IngestResult
// POST /api/ask {query}         -> Answer
// POST /api/send {personId, text} -> { ok: boolean; channel: "telegram" | "copy"; trail: TrailStep[] }
// GET  /api/nudges              -> Nudge[]
// GET  /api/status              -> SponsorStatus
// GET  /api/messages?personId=  -> Message[] (newest first)
// GET  /api/promises            -> Promise[]
// PATCH /api/people/[id] PersonPatch -> Person
// POST /api/promises/[id]/keep  -> Promise (marks kept)
// GET  /api/airbyte             -> AirbyteStatus
// POST /api/airbyte/sync        -> { started: string[]; imported: number; trail: TrailStep[] }
