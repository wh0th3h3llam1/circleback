import { seedDb } from "../src/lib/seed";
import * as sie from "../src/lib/sie";
import * as s2 from "../src/lib/s2";
(async () => {
  const d = seedDb();
  let t = Date.now();
  await s2.ensureSchema();
  console.log("schema ok", Date.now() - t, "ms");
  const vecs = await sie.embed(d.messages.map((m) => m.text));
  t = Date.now();
  for (let i = 0; i < d.messages.length; i++) await s2.upsertMessage(d.messages[i], vecs[i]);
  await s2.upsertPeople(d.people); await s2.upsertPromises(d.promises);
  console.log("loaded", d.messages.length, "msgs in", Date.now() - t, "ms");
  const q = (await sie.embed(["who works on voice agents"]))[0];
  const r = await s2.hybridSearch(q, "voice agents", ["work", "career", "projects"], 5);
  console.log(r.sql); r.hits.forEach((h) => console.log(h.score.toFixed(3), h.vs.toFixed(3), h.ft.toFixed(2), d.messages.find((m) => m.id === h.id)?.text.slice(0, 70)));
  const n = await s2.dueNudges(); console.log("nudges", n.promises.length, "promises,", n.drift.length, "drift", n.drift.map((x) => x.name + ":" + x.days));
  process.exit(0);
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
