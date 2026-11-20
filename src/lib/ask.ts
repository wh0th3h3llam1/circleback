// "Who's my best call?" — hybrid search + Cognee graph recall + SIE rerank + tie strength + intro paths.
import type { Answer, Candidate, Evidence, Person, Pillar } from "./contracts";
import { PILLARS } from "./contracts";
import * as sie from "./sie";
import * as cog from "./cognee";
import * as s2 from "./s2";
import { db, tierWeight, type StoredMessage } from "./store";
import { Trail } from "./trail";
import type { TrailStep } from "./contracts";
import { FAST_MODEL, DEEP_MODEL, DECIDER } from "./router";

const W = { relevance: 0.42, tie: 0.18, reach: 0.15, recency: 0.1, memory: 0.15 };

function detectPillars(query: string): Pillar[] {
  const q = query.toLowerCase();
  if (/\b(mom|dad|family|sister|brother|thanksgiving|birthday)\b/.test(q)) return ["family"];
  return ["work", "career", "projects"]; // Family stays out of work/career questions (twinwire privacy rule).
}

export async function ask(query: string, opts: { fast?: boolean; preTrail?: TrailStep[] } = {}): Promise<Answer> {
  const trail = new Trail();
  if (opts.preTrail) trail.steps.push(...opts.preTrail);
  const d = db();
  const pillars = detectPillars(query);
  if (!pillars.includes("family")) trail.note("Rules", "privacy filter", "Family notes kept out of this answer and the draft");

  const byId = new Map(d.people.map((p) => [p.id, p]));
  const allowedMsgs = d.messages.filter((m) => pillars.includes(m.pillar));

  // 1. Graph memory (Cognee) runs in parallel with SIE work. The fast path skips it.
  const memoryP = cog.cogneeEnabled() && !opts.fast
    ? trail.tryRun(
        "Cognee",
        `recall · ${cog.BRAIN} · node sets ${pillars.map((p) => "pillar:" + p).join(", ")}`,
        () => cog.recall(query, { nodeSets: pillars.map((p) => `pillar:${p}`) }),
        (a) => (a ? a.replace(/\s+/g, " ").slice(0, 140) : "no memory hits"),
        () => "",
      )
    : Promise.resolve("");

  // 2. Query vector
  const qvec = await trail.tryRun(
    "SIE",
    "encode query · bge-m3",
    async () => (await sie.embed([query]))[0],
    (v) => `${v.length}-dim vector`,
    () => undefined as unknown as number[],
  );

  // 3. Message search: SingleStore hybrid, else local cosine
  let hits: { id: string; score: number }[] = [];
  if (qvec && s2.s2Enabled()) {
    hits = await trail.tryRun(
      "SingleStore",
      "hybrid search · messages",
      async () => {
        const r = await s2.hybridSearch(qvec, query, pillars, 8);
        trail.note("SingleStore", "query", r.sql, true);
        return r.hits;
      },
      (h) => `${h.length} notes · top ${h[0]?.score.toFixed(3) ?? "-"}`,
      () => localSearch(qvec, allowedMsgs),
      "local vector search",
    );
  } else if (qvec) {
    const t = Date.now();
    hits = localSearch(qvec, allowedMsgs);
    trail.steps.push({ sponsor: "Local", label: "vector search · messages", detail: `${hits.length} notes (SingleStore not configured)`, ms: Date.now() - t, real: false });
  }
  const msgById = new Map(d.messages.map((m) => [m.id, m]));
  const hitMsgs = hits.map((h) => msgById.get(h.id)).filter((m): m is StoredMessage => !!m && pillars.includes(m.pillar));
  // Conversations (chat threads) carry the richest signal; make sure the nearest ones are considered too.
  if (qvec) {
    const convo = allowedMsgs.filter((m) => m.text.startsWith("Synthetic chat") || m.source === "telegram" || m.source === "web");
    const near = localSearch(qvec, convo).slice(0, 4).map((h) => msgById.get(h.id)).filter((m): m is StoredMessage => !!m && !hitMsgs.includes(m));
    hitMsgs.unshift(...near);
  }
  const hitRank = new Map<string, number>();
  hitMsgs.forEach((m, i) => m.personIds.forEach((pid) => hitRank.set(pid, Math.max(hitRank.get(pid) || 0, 1 - i / 10))));

  // 4. Candidate pool + rerank on profile docs
  let pool = d.people.filter((p) => p.id !== "me" && p.pillars.some((x) => pillars.includes(x)));
  // Large networks (a full LinkedIn import): keep your closer circle + second-degree people,
  // and only the ~40 "known" contacts whose notes are nearest to the query, before the SIE rerank.
  if (pool.length > 60 && qvec) {
    const t = Date.now();
    const best = new Map<string, number>();
    for (const m of allowedMsgs) {
      if (!m.vec || m.vec.length !== qvec.length) continue;
      const s = sie.cosine(qvec, m.vec);
      for (const pid of m.personIds) if (s > (best.get(pid) ?? -1)) best.set(pid, s);
    }
    const core = pool.filter((p) => !p.met || p.tier !== "known");
    const rest = pool
      .filter((p) => p.met && p.tier === "known")
      .sort((a, b) => (best.get(b.id) ?? -1) - (best.get(a.id) ?? -1))
      .slice(0, 40);
    trail.steps.push({ sponsor: "Local", label: "prefilter", detail: `${pool.length} people → ${core.length + rest.length} (closer circle + 40 nearest by vector)`, ms: Date.now() - t, real: false });
    pool = [...core, ...rest];
  }
  const profile = (p: Person) => {
    const notes = allowedMsgs
      .filter((m) => m.personIds.includes(p.id))
      .slice(-4)
      .map((m) => m.text)
      .join(" ");
    return `${p.name}${p.role ? ", " + p.role : ""}${p.org ? " at " + p.org : ""}. Topics: ${p.topics.join(", ")}. ${p.summary || ""} Notes: ${notes}`;
  };
  // Score each person on who they are (role, org, topics) and, more weakly, on the notes about them,
  // so a connector who merely mentioned an expert doesn't outrank the expert.
  const own = (p: Person) => `${p.name}${p.role ? ", " + p.role : ""}${p.org ? " at " + p.org : ""}. Topics: ${p.topics.join(", ")}. ${p.summary || ""}`;
  const both = await trail.tryRun(
    "SIE",
    "rerank · Qwen3-Reranker-4B",
    () => sie.rerank(query, [...pool.map(own), ...pool.map(profile)]),
    (s) => `${s.length / 2} people scored on profile + notes`,
    () => [...pool.map((p) => keywordScore(query, own(p))), ...pool.map((p) => keywordScore(query, profile(p)))],
  );
  const n = pool.length;
  const maxOwn = Math.max(...both.slice(0, n), 1e-6);
  const maxNotes = Math.max(...both.slice(n), 1e-6);
  const rel = pool.map((_, i) => 0.75 * (both[i] / maxOwn) + 0.25 * (both[n + i] / maxNotes));
  const maxRel = Math.max(...rel, 1e-6);

  const memory = await memoryP;
  const memLower = memory.toLowerCase();

  const now = Date.now();
  const scored: Candidate[] = pool.map((p, i) => {
    const relevance = Math.min(1, rel[i] / maxRel);
    const path = bestPath(p);
    const via = path.length > 2 ? byId.get(path[1]) : undefined;
    const tie = p.met ? tierWeight[p.tier] : via ? tierWeight[via.tier] * 0.6 : 0.1;
    const reach = p.met ? (p.tier === "known" ? 0.6 : 1) : via ? 0.55 * edgeStrength(via.id, p.id) + 0.25 : 0.1;
    const lastIso = p.lastContact || (via?.lastContact ?? undefined);
    const days = lastIso ? (now - new Date(lastIso).getTime()) / 86400000 : 90;
    const recency = Math.exp(-days / 30);
    const inMemory = memLower.includes(p.name.toLowerCase()) || memLower.includes(p.name.split(" ")[0].toLowerCase() + " ");
    const mem = Math.min(1, (inMemory ? 0.7 : 0) + (hitRank.get(p.id) || 0) * 0.5);
    // Lookups care about the match itself; recommendations weigh closeness and reachability too.
    const score = opts.fast
      ? 0.55 * relevance + 0.35 * (hitRank.get(p.id) || 0) + 0.05 * tie + 0.05 * recency
      : W.relevance * relevance + W.tie * tie + W.reach * reach + W.recency * recency + W.memory * mem;

    const why: string[] = [];
    if (p.role || p.org) why.push(`${p.role || ""}${p.role && p.org ? " at " : ""}${p.org || ""}`);
    if (via) why.push(`Reachable through ${via.name} (${via.tier})${edgeEvidence(via.id, p.id) ? ": " + edgeEvidence(via.id, p.id) : ""}`);
    else why.push(`Your ${p.tier} circle${lastIso ? ` · last contact ${Math.round(days)}d ago` : ""}`);
    if (inMemory) why.push("Cognee memory links them to this question");
    const owe = d.promises.filter((x) => x.personId === p.id && x.status === "open");
    if (owe.length) why.push(owe.map((x) => (x.direction === "i_owe" ? `You owe: ${x.text}` : `They owe you: ${x.text}`)).join(" · "));

    const evidence: Evidence[] = d.messages
      .filter((m) => m.personIds.includes(p.id) && pillars.includes(m.pillar))
      .sort((a, b) => (hitRank.has(p.id) && hitMsgs.includes(b) ? 1 : 0) - (hitMsgs.includes(a) ? 1 : 0) || b.ts.localeCompare(a.ts))
      .slice(0, 3)
      .map((m) => ({ messageId: m.id, text: m.text, source: m.source, ts: m.ts, pillar: m.pillar, seeded: m.seeded }));

    return { person: p, score: Math.round(score * 1000) / 1000, parts: { relevance, tie, reach, recency, memory: mem }, why, path, via, evidence };
  });
  scored.sort((a, b) => b.score - a.score);
  // Only people who are actually relevant make the shortlist (always keep at least one).
  const relevant = scored.filter((c) => c.parts.relevance >= 0.2);
  const top = (relevant.length ? relevant : scored).slice(0, 3);
  trail.note("Rules", "score", "0.42 relevance + 0.18 tie + 0.15 reach + 0.10 recency + 0.15 memory", false);

  // 5. Draft (to connector if the best person is second-degree)
  const best = top[0];
  let draftText = "";
  let reply: string | undefined;
  let toId = best?.person.id || "";
  if (best && opts.fast) {
    // Fast path: one small-model call answers the lookup directly; the draft is a template.
    toId = best.via ? best.via.id : best.person.id;
    const facts = [
      ...top.map((c) => `${c.person.name}: ${[c.person.role, c.person.org].filter(Boolean).join(" at ")}${c.via ? ` (not met; reachable via ${c.via.name})` : ""}`),
      ...hitMsgs.slice(0, 8).map((m) => `${m.ts.slice(0, 10)} note: ${m.text.slice(0, 600)}`),
    ].join("\n");
    reply = await trail.tryRun(
      "SIE",
      `answer · ${FAST_MODEL.split("/").pop()} (small)`,
      () =>
        sie.chat(
          [
            { role: "system", content: "Answer the user's question about their own network in 1-2 short sentences using only the facts. Name people with their role and company. If the facts don't answer it, say so." },
            { role: "user", content: `Question: ${query}\nFacts:\n${facts}` },
          ],
          { model: FAST_MODEL, maxTokens: 120, temperature: 0.1 },
        ),
      (t) => `${t.split(/\s+/).length} words`,
      () => `${best.person.name}${best.person.role || best.person.org ? ` (${[best.person.role, best.person.org].filter(Boolean).join(", ")})` : ""} is the closest match.`,
    );
    reply = reply.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    draftText = best.via
      ? `Hey ${best.via.name.split(" ")[0]}, would you be open to introducing me to ${best.person.name}?`
      : `Hey ${best.person.name.split(" ")[0]}, great to be connected! Would love to catch up this week.`;
  } else if (best) {
    const target = best.person;
    const via = best.via;
    toId = via ? via.id : target.id;
    const context = best.evidence.map((e) => `- ${e.text}`).join("\n");
    draftText = await trail.tryRun(
      "SIE",
      `draft · ${sie.SIE_MODELS.chat.split("/").pop()}`,
      () =>
        sie.chat(
          [
            {
              role: "system",
              content:
                "Write a short, warm, specific message in the user's voice (first person, casual, 2-4 sentences, no emojis, no subject line, no placeholders). Use only the facts given. Output only the message text.",
            },
            {
              role: "user",
              content: via
                ? `Goal: ${query}\nAsk ${via.name} (${via.tier} circle) for an intro to ${target.name} (${target.role || ""} ${target.org || ""}).\nFacts:\n${context}`
                : `Goal: ${query}\nMessage ${target.name} (${target.role || ""} ${target.org || ""}) directly.\nFacts:\n${context}`,
            },
          ],
          { maxTokens: 220, temperature: 0.5 },
        ),
      (t) => `${t.split(/\s+/).length} words to ${byId.get(toId)?.name}`,
      () =>
        via
          ? `Hey ${via.name.split(" ")[0]}, hope you're well! I'm working on ${query.replace(/\?$/, "")}. Would you be up for introducing me to ${target.name}? Happy to send a blurb.`
          : `Hey ${target.name.split(" ")[0]}, I'm working on ${query.replace(/\?$/, "")} and thought of you. Free for a quick call this week?`,
    );
    draftText = draftText.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  }

  const linked = !!d.telegram.links[toId] || !!d.telegram.ownerChatId;
  if (s2.s2Enabled()) s2.audit("ask", { query, top: top.map((c) => [c.person.id, c.score]) }).catch(() => {});

  return {
    query,
    pillar: best ? (best.person.pillars.find((p) => pillars.includes(p)) as Pillar) : undefined,
    candidates: top,
    draft: { toPersonId: toId, text: draftText, channel: linked ? "telegram" : "copy" },
    memoryAnswer: memory || undefined,
    reply,
    route: { mode: opts.fast ? "fast" : "deep", confidence: 0, decider: DECIDER, model: opts.fast ? FAST_MODEL : DEEP_MODEL },
    trail: trail.steps,
  };

  function edgeStrength(a: string, b: string) {
    const e = d.edges.find((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a));
    return e?.strength ?? 0;
  }
  function edgeEvidence(a: string, b: string) {
    return d.edges.find((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a))?.evidence;
  }
  function bestPath(p: Person): string[] {
    if (p.met) return ["me", p.id];
    let best: { id: string; s: number } | undefined;
    for (const e of d.edges) {
      const other = e.to === p.id ? e.from : e.from === p.id ? e.to : undefined;
      if (!other || other === "me") continue;
      const c = byId.get(other);
      if (!c || !c.met) continue;
      const s = e.strength * tierWeight[c.tier];
      if (!best || s > best.s) best = { id: other, s };
    }
    return best ? ["me", best.id, p.id] : ["me", p.id];
  }
}

function localSearch(qvec: number[], msgs: StoredMessage[]) {
  return msgs
    .filter((m) => m.vec && m.vec.length === qvec.length)
    .map((m) => ({ id: m.id, score: sie.cosine(qvec, m.vec!) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function keywordScore(q: string, doc: string) {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const dl = doc.toLowerCase();
  return words.filter((w) => dl.includes(w)).length / Math.max(words.length, 1);
}

export { PILLARS };
