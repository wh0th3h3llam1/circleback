"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GraphData, Message, Person, PersonPatch, Pillar, Promise as PromiseRow } from "@/lib/contracts";
import Avatar from "./Avatar";
import { usePoll } from "./hooks";
import { IconBack, IconCalendar, IconChevron, IconEdit, IconMic, IconNote, IconTelegram, IconX } from "./icons";
import { PILLARS, PILLAR_COLOR, PILLAR_LABEL, isOverdue, postJson, shortDate, tierLabel, timeAgo } from "./ui";

const SOURCE_ICON = { telegram: IconTelegram, voice: IconMic, web: IconNote, seed: IconCalendar, slack: IconNote, linkedin: IconNote } as const;

export default function PersonView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const graph = usePoll<GraphData>("/api/graph", 5000);
  const msgs = usePoll<Message[]>(id ? `/api/messages?personId=${encodeURIComponent(id)}` : null, 8000);
  const proms = usePoll<PromiseRow[]>("/api/promises", 8000);
  const [editing, setEditing] = useState(false);

  const person = graph.data?.people.find((p) => p.id === id);
  const byId = new Map((graph.data?.people ?? []).map((p) => [p.id, p]));
  const mine = (proms.data ?? []).filter((p) => p.personId === id && p.status === "open");
  const links = (graph.data?.edges ?? []).filter((e) => (e.from === id || e.to === id) && e.from !== "me" && e.to !== "me");

  if (graph.loading) return <p className="p-8 text-[14px] text-[var(--muted)]">Loading…</p>;
  if (!person)
    return (
      <div className="p-8 flex flex-col gap-3 items-start">
        <p className="text-[15px]">We couldn&apos;t find that person.</p>
        <Link href="/people" className="btn">
          Back to people
        </Link>
      </div>
    );

  const askQ = person.topics.length ? `Who can help me with ${person.topics.slice(0, 2).join(" and ")}?` : `What should I talk to ${person.name} about?`;

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 md:px-8 pt-5 md:pt-10 pb-10 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <button type="button" className="w-10 h-10 grid place-items-center rounded-full glass !rounded-full" aria-label="Back" onClick={() => router.back()}>
          <IconBack size={18} />
        </button>
        <span className="text-[14px] font-medium">Person</span>
        <button type="button" className="w-10 h-10 grid place-items-center rounded-full glass !rounded-full" aria-label="Edit details" onClick={() => setEditing(true)}>
          <IconEdit size={18} />
        </button>
      </div>

      <section className="glass p-5 flex flex-col items-center text-center gap-2">
        <Avatar person={person} size={64} />
        <h1 className="text-[22px] font-semibold mt-1">{person.name}</h1>
        <p className="text-[14px] text-[var(--muted)]">{[person.role, person.org].filter(Boolean).join(" · ") || "No role yet"}</p>
        <div className="flex flex-wrap justify-center gap-1.5 mt-1">
          <span className="chip">{tierLabel(person)}</span>
          {person.pillars.map((p) => (
            <span key={p} className="chip" style={{ color: PILLAR_COLOR[p] }}>
              {PILLAR_LABEL[p]}
            </span>
          ))}
          {person.telegramLinked && <span className="chip" style={{ color: "var(--green)" }}>On Telegram</span>}
          {person.seeded && <span className="tag-demo self-center">demo data</span>}
        </div>
        <div className="grid grid-cols-3 w-full mt-3 text-[12px]">
          <div>
            <div className="text-[var(--muted)]">Last talked</div>
            <div className="font-semibold text-[14px] mt-0.5">{person.lastContact ? timeAgo(person.lastContact) : "—"}</div>
          </div>
          <div>
            <div className="text-[var(--muted)]">Points</div>
            <div className="font-semibold text-[14px] mt-0.5">{person.points}</div>
          </div>
          <div>
            <div className="text-[var(--muted)]">Open promises</div>
            <div className="font-semibold text-[14px] mt-0.5" style={{ color: mine.length ? "var(--orange)" : undefined }}>
              {mine.length}
            </div>
          </div>
        </div>
      </section>

      {person.summary && <p className="text-[14px] text-[#2d4a41] px-1">{person.summary}</p>}

      <section className="flex flex-col gap-2" aria-labelledby="know-h">
        <h2 id="know-h" className="label">
          What you know
        </h2>
        {person.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {person.topics.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        )}
        {links.map((e) => {
          const other = byId.get(e.from === id ? e.to : e.from);
          if (!other) return null;
          return (
            <Link key={`${e.from}-${e.to}`} href={`/people/${other.id}`} className="glass flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <Avatar person={other} size={28} />
              <span className="flex-1">
                Knows <b className="font-semibold">{other.name}</b>
                {e.evidence ? <span className="text-[var(--muted)]"> · {e.evidence}</span> : null}
              </span>
            </Link>
          );
        })}
        {(msgs.data ?? []).map((m) => {
          const Icon = SOURCE_ICON[m.source] ?? IconNote;
          return (
            <div key={m.id} className="glass flex gap-3 px-4 py-3">
              <span className="w-7 h-7 grid place-items-center rounded-full bg-white shrink-0" style={{ color: "var(--teal)" }}>
                <Icon size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] leading-snug">{m.text}</p>
                <div className="text-[12px] text-[var(--muted)] mt-1 flex gap-2 items-center">
                  {shortDate(m.ts)} · {m.source}
                  {m.seeded && <span className="tag-demo">demo data</span>}
                </div>
              </div>
            </div>
          );
        })}
        {msgs.data && msgs.data.length === 0 && <p className="text-[13px] text-[var(--muted)]">No notes yet. Add one with the edit button.</p>}
      </section>

      {mine.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="prom-h">
          <h2 id="prom-h" className="label">
            Promises
          </h2>
          {mine.map((p) => (
            <div key={p.id} className="glass px-4 py-3 flex items-center gap-3" style={{ border: p.direction === "i_owe" ? "1px solid var(--orange)" : undefined }}>
              <span className="flex-1 text-[14px]">
                <span style={{ color: p.direction === "i_owe" ? "var(--orange)" : "var(--teal)" }}>{p.direction === "i_owe" ? "You promised: " : "They promised: "}</span>
                {p.text}
              </span>
              {p.due && (
                <span className="text-[12px]" style={{ color: isOverdue(p.due) ? "var(--orange)" : "var(--muted)" }}>
                  {isOverdue(p.due) ? "was due " : "due "}
                  {shortDate(p.due)}
                </span>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="next-h">
        <h2 id="next-h" className="label">
          Next step
        </h2>
        <Link href={`/ask?q=${encodeURIComponent(askQ)}`} className="flex items-center justify-between rounded-[16px] px-4 py-3.5 text-[14px] font-medium" style={{ background: "var(--teal)", color: "var(--teal-ink)" }}>
          {person.met ? `Ask about ${person.topics[0] ?? person.name.split(" ")[0]}` : `Find the best intro to ${person.name.split(" ")[0]}`}
          <IconChevron size={16} />
        </Link>
        <button type="button" className="glass flex items-center justify-between px-4 py-3 text-[14px]" onClick={() => setEditing(true)}>
          Edit details or add a note
          <IconEdit size={16} />
        </button>
      </section>

      {editing && <EditSheet person={person} onClose={() => setEditing(false)} onSaved={() => (graph.refresh(), msgs.refresh())} />}
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
