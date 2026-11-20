// The career agent: reads the single Cognee brain + SingleStore + SIE ranking and turns them into opportunities.
import type { EventItem, Opportunity, OpportunitiesResponse, TrailStep } from "./contracts";
import { ask } from "./ask";
import * as sie from "./sie";
import { db } from "./store";
import { withUrl } from "./events";

const g = globalThis as unknown as { __opps?: { key: string; value: OpportunitiesResponse } };

export function invalidateOpportunities() {
  g.__opps = undefined;
}

export async function opportunities(refresh = false): Promise<OpportunitiesResponse> {
  const d = db();
  const goal = d.goal || "Find my next career opportunity";
  const key = `${goal}|${d.messages.length}|${(d.events || []).length}|${d.people.length}`;
  if (!refresh && g.__opps?.key === key) return g.__opps.value;

  const trail: TrailStep[] = [];
  const byId = new Map(d.people.map((p) => [p.id, p]));

  // 1. People: the ask pipeline over the goal (SingleStore hybrid search + Cognee recall + SIE rerank + tie strength).
  const a = await ask(`Career goal: ${goal}. Who in my network is my best path to this?`);
  trail.push(...a.trail);
  const items: Opportunity[] = a.candidates.map((c, i) => {
    const via = c.via;
    const draft = i === 0 ? a.draft : templateDraft(goal, c.person.name, via?.name);
    return {
      id: `p_${c.person.id}`,
      kind: via ? "referral" : "reach_out",
      title: via ? `Ask ${via.name.split(" ")[0]} for an intro to ${c.person.name}` : `Reach out to ${c.person.name}`,
      why: c.why.slice(0, 3),
      score: c.score,
      person: c.person,
      path: c.path,
      draft: { toPersonId: via ? via.id : c.person.id, text: typeof draft === "string" ? draft : draft.text },
    };
  });

  // 2. Events: rank Luma / Partiful events against the goal with the SIE reranker.
  const events = d.events || [];
  if (events.length) {
    const t = Date.now();
    let scores: number[];
    try {
      scores = await sie.rerank(goal, events.map((e) => `${e.title}. Hosts: ${e.hosts.join(", ")}. ${e.description || ""}`));
      trail.push({ sponsor: "SIE", label: "rerank events · Qwen3-Reranker-4B", detail: `${events.length} events scored against your goal`, ms: Date.now() - t, real: true });
    } catch {
      scores = events.map(() => 0.5);
      trail.push({ sponsor: "SIE", label: "rerank events", detail: "fallback: unranked", ms: Date.now() - t, real: false });
    }
    const max = Math.max(...scores, 1e-6);
    events
      .map((e, i) => ({ e, s: scores[i] / max }))
      .sort((x, y) => y.s - x.s)
      .slice(0, 2)
      .forEach(({ e, s }) => items.push(eventOpp(e, s)));
  }

  // 3. Reconnect: career people going quiet.
  const now = Date.now();
  d.people
    .filter((p) => p.met && p.id !== "me" && p.pillars.some((x) => x === "career" || x === "work") && ["inner", "close", "good"].includes(p.tier) && p.lastContact)
    .map((p) => ({ p, days: Math.round((now - new Date(p.lastContact!).getTime()) / 86400000) }))
    .filter(({ days }) => days >= 14)
    .sort((x, y) => y.days - x.days)
    .slice(0, 2)
    .forEach(({ p, days }) =>
      items.push({
        id: `r_${p.id}`,
        kind: "reconnect",
        title: `Reconnect with ${p.name}`,
        why: [`${days} days since you last talked`, `${p.role || ""}${p.org ? " at " + p.org : ""}`.trim(), `${p.tier} circle`].filter(Boolean),
        score: 0.4,
        person: p,
        path: ["me", p.id],
        draft: { toPersonId: p.id, text: `Hey ${p.name.split(" ")[0]}, it's been a few weeks! I'm focusing on ${goal.toLowerCase()}. Would love 20 minutes to get your take.` },
      }),
    );

  function eventOpp(e: EventItem, s: number): Opportunity {
    const hostsInNetwork = e.hosts.map((h) => d.people.find((p) => p.name.toLowerCase() === h.toLowerCase())).filter(Boolean);
    const connectors = hostsInNetwork.flatMap((h) => (h!.met ? [h!] : d.edges.filter((x) => x.to === h!.id || x.from === h!.id).map((x) => byId.get(x.to === h!.id ? x.from : x.to)).filter((p) => p && p.met && p.id !== "me")));
    const why = [
      e.description ? e.description.split(/(?<=\.)\s/)[0] : "",
      hostsInNetwork.length ? `Hosted by ${hostsInNetwork.map((h) => h!.name).join(", ")}, already in your graph` : e.hosts.length ? `Hosted by ${e.hosts.slice(0, 3).join(", ")}` : "",
      connectors.length ? `${connectors[0]!.name} can introduce you there` : "",
    ].filter(Boolean);
    return {
      id: `e_${e.id}`,
      kind: "event",
      title: `Go to ${e.title}`,
      why: why.slice(0, 3),
      score: 0.3 + 0.5 * s,
      event: withUrl(e),
      person: hostsInNetwork[0] || undefined,
      draft: connectors[0] ? { toPersonId: connectors[0].id, text: `Hey ${connectors[0].name.split(" ")[0]}, are you going to ${e.title}? I'd love an intro to ${e.hosts[0]} there.` } : undefined,
    };
  }

  items.sort((x, y) => y.score - x.score);
  const value: OpportunitiesResponse = { goal, brainSays: a.memoryAnswer, items, trail, generatedAt: new Date().toISOString() };
  g.__opps = { key, value };
  return value;
}

function templateDraft(goal: string, target: string, via?: string) {
  return via
    ? `Hey ${via.split(" ")[0]}, I'm working toward ${goal.toLowerCase()}. Would you be open to introducing me to ${target}?`
    : `Hey ${target.split(" ")[0]}, I'm working toward ${goal.toLowerCase()} and thought of you. Open to a quick chat this week?`;
}
