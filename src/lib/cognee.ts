// Cognee Cloud: ONE brain (dataset) per user. Every memory is tagged with node sets
// (source:linkedin, source:luma, pillar:career, ...) so recall can be scoped without splitting the graph,
// and cognify runs with a career-specific extraction prompt.
import type { BrainGraph, BrainNode } from "./contracts";

const BASE = process.env.COGNEE_BASE_URL || "";
const KEY = process.env.COGNEE_API_KEY || "";
export const BRAIN = process.env.COGNEE_BRAIN || "circleback_brain_me";

export const cogneeEnabled = () => BASE.length > 0 && KEY.length > 0;
/** Kept for older call sites: every pillar now lives in the same brain. */
export const datasetFor = (_p?: string) => BRAIN;

export const CAREER_PROMPT = `You build a career relationship graph for ONE person, the owner of this memory, who is always the node named "Me".
Extract only facts stated in the text. Use people's full names and exact company names.
Node types: Person, Company, Role, Opportunity, Event, Skill.
Relationship names (snake_case): works_at, worked_with, knows, mentors, reports_to, hiring_for, leads, has_skill, interested_in,
attending, hosts, speaks_at, sponsors, met_at, connected_on_linkedin, can_introduce, offered_intro, promised.
Rules:
- "I", "me", "my" refer to the node "Me".
- A hiring signal ("X is hiring PMs for checkout") becomes an Opportunity node (e.g. "PM role, Atlas Retail checkout") linked by hiring_for from the company and from the hiring person.
- If someone offers or is able to introduce Me to someone, add can_introduce from that person to the target person.
- Events (meetups, hackathons, mixers) are Event nodes; hosts/speakers/sponsors link to them.
- Keep the owner's career goal as an interested_in edge from Me.`;

async function call<T>(method: string, path: string, body?: unknown, timeoutMs = 30000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "X-Api-Key": KEY, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      redirect: "follow",
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Cognee ${path} ${res.status}: ${text.slice(0, 300)}`);
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  } finally {
    clearTimeout(t);
  }
}

/** Add memories to the single brain, tagged with node sets. */
export async function addText(texts: string[], nodeSet: string[]) {
  return call("POST", "/api/v1/add_text", { textData: texts, datasetName: BRAIN, nodeSet });
}

/** Build/refresh the graph with the career extraction prompt. */
export async function cognify() {
  return call("POST", "/api/v1/cognify", { datasets: [BRAIN], runInBackground: true, customPrompt: CAREER_PROMPT });
}

/** Ask the brain. nodeSets scopes the graph search to memories tagged with those node sets. */
export async function recall(query: string, opts: { nodeSets?: string[]; system?: string; timeoutMs?: number } = {}): Promise<string> {
  const d = await call<unknown>(
    "POST",
    "/api/v1/recall",
    {
      query,
      datasets: [BRAIN],
      searchType: "GRAPH_COMPLETION",
      ...(opts.nodeSets?.length ? { nodeName: opts.nodeSets } : {}),
      systemPrompt:
        opts.system ||
        "You are a career agent reading the owner's relationship memory. Name the most relevant people (and events), one short reason each, and say through whom the owner can reach someone they haven't met. Use only the provided context.",
      topK: 15,
    },
    opts.timeoutMs ?? 25000,
  );
  return flatten(d).slice(0, 1400);
}

export async function listDatasets(): Promise<{ id: string; name: string }[]> {
  return call("GET", "/api/v1/datasets/");
}

const SKIP = new Set(["DocumentChunk", "TextSummary", "TextDocument", "Timestamp", "Interval", "NodeSet"]);

/** The brain's real knowledge graph from Cognee, trimmed to entities and their relations. */
export async function brainGraph(nodeSets: string[]): Promise<BrainGraph> {
  const ds = (await listDatasets()).find((d) => d.name === BRAIN);
  if (!ds) return { dataset: BRAIN, nodeSets, nodes: [], edges: [], counts: { entities: 0, relations: 0, documents: 0 }, error: "Brain not created yet" };
  const g = await call<{ nodes: { id: string; label?: string; type?: string; properties?: Record<string, unknown> }[]; edges: { source: string; target: string; label: string }[] }>(
    "GET",
    `/api/v1/datasets/${ds.id}/graph?max_nodes=600`,
    undefined,
    30000,
  );
  const typeOf = new Map<string, string>();
  const nameOf = new Map<string, string>();
  for (const n of g.nodes) {
    typeOf.set(n.id, n.type || "");
    nameOf.set(n.id, String(n.properties?.name ?? n.label ?? n.id));
  }
  // Entity -> EntityType edges ("is_a") tell us whether an entity is a Person, Company, ...
  const entityType = new Map<string, string>();
  for (const e of g.edges) if (typeOf.get(e.target) === "EntityType" && typeOf.get(e.source) === "Entity") entityType.set(e.source, nameOf.get(e.target) || "");
  const nodes: BrainNode[] = g.nodes
    .filter((n) => n.type === "Entity")
    .map((n) => ({ id: n.id, name: nameOf.get(n.id)!, type: n.type!, entityType: cap(entityType.get(n.id)), description: n.properties?.description ? String(n.properties.description) : undefined }));
  const keep = new Set(nodes.map((n) => n.id));
  const edges = g.edges.filter((e) => keep.has(e.source) && keep.has(e.target) && e.source !== e.target);
  return {
    dataset: BRAIN,
    nodeSets,
    nodes,
    edges,
    counts: { entities: nodes.length, relations: edges.length, documents: g.nodes.filter((n) => n.type === "TextDocument").length },
  };
}

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : undefined);
void SKIP;

function flatten(d: unknown): string {
  if (d == null) return "";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map(flatten).filter(Boolean).join("\n");
  if (typeof d === "object") {
    const o = d as Record<string, unknown>;
    for (const k of ["answer", "result", "search_result", "text", "content", "completion"]) {
      if (k in o) return flatten(o[k]);
    }
    return Object.values(o).map(flatten).filter(Boolean).join("\n");
  }
  return String(d);
}
