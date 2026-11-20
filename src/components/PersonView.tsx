"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GraphData, Message, Person, PersonPatch, PersonTimeline, Pillar, Promise as PromiseRow, TimelineKind } from "@/lib/contracts";
import Timeline, { KindChips } from "./Timeline";
import Avatar from "./Avatar";
import { usePoll } from "./hooks";
import { IconBack, IconCalendar, IconChevron, IconEdit, IconMic, IconNote, IconTelegram, IconX } from "./icons";
import { PILLARS, PILLAR_LABEL, postJson, shortDate, tierLabel } from "./ui";

const SOURCE_ICON: Partial<Record<string, typeof IconNote>> = { telegram: IconTelegram, voice: IconMic, web: IconNote, seed: IconCalendar, slack: IconNote, linkedin: IconNote, calendar: IconCalendar };

export default function PersonView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const graph = usePoll<GraphData>("/api/graph", 15000);
  const tl = usePoll<PersonTimeline>(id ? `/api/people/${encodeURIComponent(id)}/timeline` : null, 20000);
  const msgs = usePoll<Message[]>(id ? `/api/messages?personId=${encodeURIComponent(id)}` : null, 0);
  const proms = usePoll<PromiseRow[]>("/api/promises", 15000);
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<Set<TimelineKind>>(new Set());

  const person = tl.data?.person ?? graph.data?.people.find((p) => p.id === id);
  const mine = (proms.data ?? []).filter((p) => p.personId === id && p.status === "open");
  const openPromises = tl.data ? tl.data.openPromises : mine.length;
  const items = tl.data?.items ?? [];

  if (!person && (graph.loading || tl.loading)) return <p className="p-8 text-[14px] text-[var(--muted)]">Loading…</p>;
  if (!person)
    return (
      <div className="p-8 flex flex-col gap-3 items-start">
        <p className="text-[15px]">We couldn&apos;t find that person.</p>
        <Link href="/people" className="btn">
          Back to people
        </Link>
      </div>
    );

  const first = person.name.split(" ")[0];
  const connected = tl.data?.connectedOn;
  const subtitle = [
    [person.role, person.org].filter(Boolean).join(" at ") || "No role yet",
    connected ? `connected ${new Date(connected).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const askQ = `What should I know about ${person.name}, and how can ${first} help my career goal?`;
  const toggle = (k: TimelineKind) =>
    setFilter((f) => {
      const n = new Set(f);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 md:px-8 pt-5 md:pt-10 pb-12 flex flex-col gap-6 min-w-0">
      <button type="button" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--ink)] self-start" onClick={() => router.back()}>
        <IconBack size={14} /> Back
      </button>

      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-4 min-w-0">
          <Avatar person={person} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] md:text-[28px] font-semibold leading-tight break-words">{person.name}</h1>
              <span className="rounded-full border px-2 py-[1px] text-[11px] font-semibold tracking-wide uppercase" style={{ borderColor: "var(--green,#1d8a52)", color: "var(--green,#1d8a52)" }}>
                {tierLabel(person)}
              </span>
              {person.seeded && <span className="tag-demo">demo data</span>}
            </div>
            <p className="text-[14px] text-[var(--muted)] mt-1 break-words">
              {subtitle}
              {openPromises > 0 && <span style={{ color: "var(--orange,#E9772E)" }}> · {openPromises} open promise{openPromises === 1 ? "" : "s"}</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tl.data?.linkedinUrl && (
            <a href={tl.data.linkedinUrl} target="_blank" rel="noopener noreferrer" className="btn btn-dark !py-2 !px-3.5 text-[13px]">
              View LinkedIn profile ↗
            </a>
          )}
          <Link href={`/ask?q=${encodeURIComponent(askQ)}`} className="btn !py-2 !px-3.5 text-[13px]">
            Ask about {first} <IconChevron size={14} />
          </Link>
          <button type="button" className="btn !py-2 !px-3.5 text-[13px]" onClick={() => setEditing(true)}>
            <IconEdit size={14} /> Edit
          </button>
        </div>
        {tl.data && <KindChips counts={tl.data.counts} active={filter} onToggle={toggle} />}
      </header>

      {person.summary && <p className="text-[14px] text-[#2d4a41] -mt-2">{person.summary}</p>}

      <section className="flex flex-col gap-2 min-w-0" aria-labelledby="tl-h">
        <h2 id="tl-h" className="label">
          Your history with {first}
        </h2>
        {tl.loading && <p className="text-[13px] text-[var(--muted)]">Loading timeline…</p>}
        {tl.data && items.length > 0 && <Timeline items={items} filter={filter} />}
        {!tl.loading && items.length === 0 && (
          <div className="flex flex-col gap-2">
            {(msgs.data ?? []).map((m) => {
              const Icon = SOURCE_ICON[m.source] ?? IconNote;
              return (
                <div key={m.id} className="rounded-[12px] border border-[var(--line,#E8EBE6)] bg-white flex gap-3 px-4 py-3">
                  <span className="w-7 h-7 grid place-items-center rounded-full bg-[#F3F5F1] shrink-0" style={{ color: "var(--teal)" }}>
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] leading-snug whitespace-pre-line break-words">{m.text}</p>
                    <div className="text-[12px] text-[var(--muted)] mt-1 flex gap-2 items-center">
                      {shortDate(m.ts)} · {m.source}
                      {m.seeded && <span className="tag-demo">demo data</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {msgs.data && msgs.data.length === 0 && <p className="text-[13px] text-[var(--muted)]">No interactions yet. Add a note with Edit.</p>}
          </div>
        )}
      </section>

      {editing && <EditSheet person={person} onClose={() => setEditing(false)} onSaved={() => (graph.refresh(), msgs.refresh(), tl.refresh())} />}
    </div>
  );
}

function EditSheet({ person, onClose, onSaved }: { person: Person; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: person.name, org: person.org ?? "", role: person.role ?? "", pillars: person.pillars, inner: person.tier === "inner" && person.met, note: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (p: Pillar) => setForm((f) => ({ ...f, pillars: f.pillars.includes(p) ? f.pillars.filter((x) => x !== p) : [...f.pillars, p] }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setErr("Enter a name");
    if (!form.pillars.length) return setErr("Pick at least one pillar");
    setSaving(true);
    setErr(null);
    const patch: PersonPatch = { name: form.name.trim(), org: form.org.trim(), role: form.role.trim(), pillars: form.pillars, inner: form.inner };
    if (form.note.trim()) patch.note = form.note.trim();
    try {
      await postJson(`/api/people/${person.id}`, patch, "PATCH");
      onSaved();
      onClose();
    } catch (e2) {
      const m = (e2 as Error & { status?: number }).status === 404 ? "Editing isn't available yet." : (e2 as Error).message;
      setErr(m);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[rgba(23,48,42,0.25)] p-0 md:p-6" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-h"
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="glass !bg-[rgba(246,249,247,0.96)] w-full md:max-w-[460px] !rounded-b-none md:!rounded-[22px] p-5 flex flex-col gap-4 rise max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 id="edit-h" className="text-[17px] font-semibold">
            Edit {person.name.split(" ")[0]}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-[var(--muted)]">
            <IconX size={18} />
          </button>
        </div>
        {(["name", "role", "org"] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1.5 text-[13px]">
            <span className="text-[var(--muted)]">{k === "org" ? "Company" : k === "role" ? "Role" : "Name"}</span>
            <input className="field" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} autoComplete="off" />
          </label>
        ))}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[13px] text-[var(--muted)] mb-1.5">Pillars</legend>
          <div className="flex flex-wrap gap-1.5">
            {PILLARS.map((p) => (
              <button key={p} type="button" aria-pressed={form.pillars.includes(p)} className={`chip ${form.pillars.includes(p) ? "on" : ""}`} onClick={() => toggle(p)}>
                {PILLAR_LABEL[p]}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center justify-between gap-3 text-[14px]">
          <span>
            Inner circle
            <span className="block text-[12px] text-[var(--muted)]">Pinned people never drift down.</span>
          </span>
          <input type="checkbox" className="w-5 h-5 accent-[#1F4A40]" checked={form.inner} onChange={(e) => setForm((f) => ({ ...f, inner: e.target.checked }))} disabled={!person.met} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px]">
          <span className="text-[var(--muted)]">Add a note</span>
          <textarea className="field min-h-[80px]" placeholder={`Had coffee with ${person.name.split(" ")[0]}, promised to send the deck Friday`} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </label>
        {err && (
          <p role="alert" className="text-[13px]" style={{ color: "#a3452a" }}>
            {err}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-dark" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
