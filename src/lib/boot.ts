// First-run seeding and the demo reset.
import { PILLARS } from "./contracts";
import { seedDb } from "./seed";
import { db, recomputeTiers, reset, save } from "./store";
import * as sie from "./sie";
import * as s2 from "./s2";
import * as cog from "./cognee";
import { eventText } from "./events";

const g = globalThis as unknown as { __cbboot?: Promise<void> };

export function ensureSeeded(): Promise<void> {
  if (!g.__cbboot) {
    g.__cbboot = (async () => {
      if (db().people.length === 0) await reseed({ cognee: false });
    })();
  }
  return g.__cbboot;
}

export async function reseed(opts: { cognee: boolean }) {
  const keep = db().telegram;
  const next = seedDb();
  next.telegram = keep || { links: {} };
  for (const p of next.people) p.telegramLinked = !!next.telegram.links[p.id];
  reset(next);
  recomputeTiers();

  const log: string[] = [];
  // Embed all seeded notes with SIE (one batch).
  try {
    const vecs = await sie.embed(next.messages.map((m) => m.text));
    next.messages.forEach((m, i) => (m.vec = vecs[i]));
    log.push(`SIE embedded ${vecs.length} notes`);
  } catch (e) {
    log.push(`SIE embed failed: ${(e as Error).message.slice(0, 120)}`);
  }
  save();

  if (s2.s2Enabled()) {
    try {
      await s2.clearCore();
      for (const m of next.messages) await s2.upsertMessage(m, m.vec);
      await s2.upsertPeople(next.people);
      await s2.upsertPromises(next.promises);
      log.push(`SingleStore loaded ${next.messages.length} notes, ${next.people.length} people, ${next.promises.length} promises`);
    } catch (e) {
      log.push(`SingleStore load failed: ${(e as Error).message.slice(0, 160)}`);
    }
  }

  if (opts.cognee && cog.cogneeEnabled()) {
    try {
      for (const pillar of PILLARS) {
        const texts = next.messages
          .filter((m) => m.pillar === pillar)
          .map((m) => {
            const names = m.personIds
              .map((id) => next.people.find((p) => p.id === id))
              .filter(Boolean)
              .map((p) => `${p!.name}${p!.role || p!.org ? ` (${[p!.role, p!.org].filter(Boolean).join(", ")})` : ""}${p!.met ? "" : " [not met yet]"}`)
              .join("; ");
            return `${m.ts.slice(0, 10)} [${pillar}] ${m.text}\nPeople: ${names}`;
          });
        const profiles = next.people
          .filter((p) => p.pillars[0] === pillar && p.id !== "me")
          .map((p) => `${p.name}: ${[p.role, p.org].filter(Boolean).join(" at ")}. Topics: ${p.topics.join(", ")}. ${p.summary || ""}${p.met ? "" : " Me has not met them yet."}`);
        if (texts.length) await cog.addText(texts, ["source:notes", `pillar:${pillar}`]);
        if (profiles.length) await cog.addText(profiles, ["source:profiles", `pillar:${pillar}`]);
      }
      if (next.goal) await cog.addText([`Me's career goal: ${next.goal}`], ["source:goal", "pillar:career"]);
      for (const ev of next.events || []) await cog.addText([eventText(ev)], [`source:${ev.source}`, "pillar:career", "kind:event"]);
      await cog.cognify();
      log.push(`Cognee: loaded notes, profiles, goal and events into one brain (${cog.BRAIN}) with node sets; cognify started with the career prompt`);
    } catch (e) {
      log.push(`Cognee load failed: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  return { ok: true, log };
}
