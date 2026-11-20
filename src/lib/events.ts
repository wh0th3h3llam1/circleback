// Luma and Partiful event import from a public event link. Reads the page the way a browser preview would
// (Open Graph tags + Luma's embedded page data), never logs in, and treats page text as data only.
import type { EventItem, TrailStep } from "./contracts";
import * as cog from "./cognee";
import * as sie from "./sie";
import * as s2 from "./s2";
import { db, newId, save } from "./store";

/** Demo events have no public page; they open Circleback's own event page instead. */
export function withUrl(e: EventItem): EventItem {
  return e.url ? e : { ...e, url: `/events/${e.id}` };
}

export function eventText(e: EventItem) {
  return `Event: ${e.title}${e.start ? ` on ${e.start.slice(0, 16).replace("T", " ")}` : ""}${e.location ? ` at ${e.location}` : ""} (${e.source}). Hosts: ${e.hosts.join(", ") || "unknown"}. ${e.description || ""}`.slice(0, 3000);
}

const meta = (html: string, prop: string) =>
  new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i").exec(html)?.[1]?.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');

export async function importEvent(url: string): Promise<{ event: EventItem; trail: TrailStep[] }> {
  const u = new URL(url);
  const source: EventItem["source"] | undefined = /(^|\.)lu\.ma$|(^|\.)luma\.com$/.test(u.hostname) ? "luma" : /(^|\.)partiful\.com$/.test(u.hostname) ? "partiful" : undefined;
  if (!source) throw new Error("Paste a Luma (luma.com / lu.ma) or Partiful (partiful.com) event link");
  const trail: TrailStep[] = [];
  let t = Date.now();
  const res = await fetch(u.toString(), { headers: { "User-Agent": "Circleback/0.1 (event preview)" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${source} returned ${res.status}`);
  const html = await res.text();

  let title = meta(html, "og:title")?.replace(/\s*·\s*Luma$/, "") || u.pathname;
  let description = meta(html, "og:description") || "";
  let start: string | undefined;
  let location: string | undefined;
  let hosts: string[] = [];
  let attendees: number | undefined;
  const nd = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (nd) {
    try {
      const j = JSON.parse(nd);
      const data = j?.props?.pageProps?.initialData?.data ?? j?.props?.pageProps?.event ?? {};
      const ev = data.event ?? data;
      title = ev.name || title;
      start = ev.start_at || ev.startDate || start;
      location = ev.geo_address_info?.full_address || ev.geo_address_info?.address || ev.location?.name || location;
      hosts = (data.hosts || ev.hosts || []).map((h: { name?: string }) => h?.name).filter(Boolean);
      attendees = data.guest_count || ev.guest_count || undefined;
      description = data.description_mirror ? flattenMirror(data.description_mirror).slice(0, 2500) || description : description;
    } catch {
      /* fall back to Open Graph tags */
    }
  }
  const event: EventItem = { id: newId("ev"), source, url: u.toString(), title, start, location, hosts, description, attendees, seeded: false };
  trail.push({ sponsor: "Rules", label: `read ${source} page`, detail: `${title}${hosts.length ? ` · hosts: ${hosts.slice(0, 4).join(", ")}` : ""}`, ms: Date.now() - t, real: false });

  const d = db();
  d.events = [event, ...(d.events || []).filter((e) => e.url !== event.url)];
  const text = eventText(event);
  const msg = { id: newId("ev_msg"), source: "web" as const, pillar: "career" as const, text, personIds: [], ts: new Date().toISOString(), seeded: false };
  t = Date.now();
  try {
    const [vec] = await sie.embed([text]);
    d.messages.push({ ...msg, vec });
    if (s2.s2Enabled()) await s2.upsertMessage(msg, vec);
    trail.push({ sponsor: "SIE", label: "encode · bge-m3", detail: "event embedded, saved to SingleStore", ms: Date.now() - t, real: true });
  } catch (e) {
    d.messages.push(msg);
    trail.push({ sponsor: "SIE", label: "encode", detail: `failed: ${(e as Error).message.slice(0, 80)}`, ms: Date.now() - t, real: false });
  }
  save();
  if (cog.cogneeEnabled()) {
    t = Date.now();
    try {
      await cog.addText([text], [`source:${source}`, "pillar:career", "kind:event"]);
      await cog.cognify();
      trail.push({ sponsor: "Cognee", label: `remember · ${cog.BRAIN}`, detail: `node sets source:${source}, kind:event · career prompt`, ms: Date.now() - t, real: true });
    } catch (e) {
      trail.push({ sponsor: "Cognee", label: "remember", detail: `failed: ${(e as Error).message.slice(0, 80)}`, ms: Date.now() - t, real: false });
    }
  }
  return { event, trail };
}

function flattenMirror(n: unknown): string {
  if (!n || typeof n !== "object") return "";
  const o = n as { text?: string; content?: unknown[]; type?: string };
  const inner = Array.isArray(o.content) ? o.content.map(flattenMirror).join(o.type === "doc" ? "\n" : "") : "";
  return (o.text || "") + inner + (o.type === "paragraph" ? "\n" : "");
}
