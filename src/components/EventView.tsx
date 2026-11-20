"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { EventItem, GraphData, Person } from "@/lib/contracts";
import Avatar from "./Avatar";
import { usePoll } from "./hooks";
import { IconBack, IconCalendar } from "./icons";

function fmt(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function EventView() {
  const { id } = useParams<{ id: string }>();
  const events = usePoll<EventItem[]>("/api/events");
  const graph = usePoll<GraphData>("/api/graph");
  const ev = events.data?.find((e) => e.id === id);
  const people = graph.data?.people ?? [];
  const byName = (n: string) => people.find((p) => p.name.toLowerCase() === n.toLowerCase());
  const hosts = ev?.hosts ?? [];
  const desc = (ev?.description ?? "").toLowerCase();
  const meet: Person[] = ev
    ? [
        ...hosts.map(byName).filter((p): p is Person => !!p),
        ...people.filter((p) => p.id !== "me" && p.org && p.org.length > 3 && desc.includes(p.org.toLowerCase())),
      ].filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i).slice(0, 8)
    : [];
  const external = ev?.url && /^https?:\/\//.test(ev.url);

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 py-8 md:py-12">
      <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--ink)]">
        <IconBack size={14} /> Back
      </Link>

      {!events.data && !events.error && <p className="mt-8 text-[var(--muted)]">Loading event…</p>}
      {events.error && <p className="mt-8 text-[var(--muted)]">Couldn&apos;t load events: {events.error}</p>}
      {events.data && !ev && (
        <div className="mt-8">
          <h1 className="text-[24px] font-semibold">Event not found</h1>
          <p className="mt-2 text-[var(--muted)]">
            It may have been removed. <Link href="/sources" className="underline">Add an event</Link> from Luma or Partiful.
          </p>
        </div>
      )}

      {ev && (
        <article className="mt-6 flex flex-col gap-6">
          <header>
            <div className="flex items-center gap-2 flex-wrap text-[12px]">
              <span className="chip">{ev.source === "luma" ? "Luma" : "Partiful"}</span>
              {ev.seeded && <span className="chip !border-dashed text-[var(--muted)]">Demo data</span>}
            </div>
            <h1 className="mt-3 text-[28px] leading-tight font-semibold">{ev.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-[14px] text-[var(--muted)]">
              <IconCalendar size={15} /> {fmt(ev.start) || "Date to be announced"}
              {ev.location ? ` · ${ev.location}` : ""}
              {ev.attendees ? ` · ${ev.attendees} going` : ""}
            </p>
            {external && (
              <a href={ev.url} target="_blank" rel="noopener noreferrer" className="btn btn-dark mt-4 inline-flex">
                Open on {ev.source === "luma" ? "Luma" : "Partiful"} ↗
              </a>
            )}
            {!external && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(`site:${ev.source === "luma" ? "luma.com" : "partiful.com"} ${ev.title.replace(/\s*\(demo\)\s*/i, "")}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-dark inline-flex"
                >
                  Find on {ev.source === "luma" ? "Luma" : "Partiful"} ↗
                </a>
                <a href={ev.source === "luma" ? "https://luma.com/discover" : "https://partiful.com"} target="_blank" rel="noopener noreferrer" className="btn inline-flex">
                  Browse {ev.source === "luma" ? "Luma events" : "Partiful"} ↗
                </a>
                <span className="text-[12px] text-[var(--muted)]">No public page is saved for this event yet.</span>
              </div>
            )}
          </header>

          {ev.description && (
            <section>
              <h2 className="label mb-2">About</h2>
              <p className="text-[15px] leading-relaxed whitespace-pre-line">{ev.description}</p>
            </section>
          )}

          <section>
            <h2 className="label mb-2">Hosts</h2>
            <ul className="flex flex-col gap-2">
              {hosts.length === 0 && <li className="text-[var(--muted)] text-[14px]">No hosts listed.</li>}
              {hosts.map((h) => {
                const p = byName(h);
                return (
                  <li key={h} className="flex items-center gap-3">
                    <Avatar person={p} name={h} size={32} />
                    {p ? (
                      <Link href={`/people/${p.id}`} className="font-medium hover:underline">
                        {h}
                      </Link>
                    ) : (
                      <span className="font-medium">{h}</span>
                    )}
                    {p && <span className="text-[13px] text-[var(--muted)]">{[p.role, p.org].filter(Boolean).join(" · ")}</span>}
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="label mb-2">Who to meet there</h2>
            {meet.length === 0 ? (
              <p className="text-[14px] text-[var(--muted)]">Nobody from your graph is linked to this event yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--line,#E8EBE6)]">
                {meet.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center gap-3">
                    <Avatar person={p} size={32} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/people/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-[13px] text-[var(--muted)] truncate">{[p.role, p.org].filter(Boolean).join(" · ")}</div>
                    </div>
                    <Link href={`/ask?q=${encodeURIComponent(`Who can introduce me to ${p.name}?`)}`} className="btn !py-1.5 !px-3 text-[12px]">
                      Get an intro
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </article>
      )}
    </div>
  );
}
