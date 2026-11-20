"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GraphData, Opportunity, OpportunitiesResponse, TrailStep } from "@/lib/contracts";
import Avatar from "./Avatar";
import KeepWarm from "./KeepWarm";
import { usePoll } from "./hooks";
import { IconBrain, IconCalendar, IconChevron, IconEdit, IconRoute, IconSync, IconTelegram, IconUsers, IconWave, IconX } from "./icons";
import { getJson, postJson, shortDate } from "./ui";
import { Trail } from "./Why";

const KIND: Record<Opportunity["kind"], { label: string; icon: typeof IconRoute; color: string }> = {
  referral: { label: "Referral path", icon: IconRoute, color: "var(--orange)" },
  reach_out: { label: "Reach out", icon: IconUsers, color: "var(--green)" },
  event: { label: "Event", icon: IconCalendar, color: "#7d8f3f" },
  reconnect: { label: "Reconnect", icon: IconWave, color: "var(--teal)" },
};

const STEPS = ["Reading your goal", "Asking your Cognee brain", "Searching notes in SingleStore", "Ranking people with SIE", "Drafting intros"];

export default function OpportunitiesView() {
  const graph = usePoll<GraphData>("/api/graph", 15000);
  const [goal, setGoal] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [draftGoal, setDraftGoal] = useState("");
  const [data, setData] = useState<OpportunitiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState<Opportunity | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const r = await getJson<OpportunitiesResponse>(`/api/opportunities${refresh ? "?refresh=1" : ""}`);
      setData(r);
      if (r.goal) setGoal(r.goal);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getJson<{ goal: string }>("/api/goal")
      .then((g) => setGoal(g.goal || ""))
      .catch(() => {});
    load(false);
  }, [load]);

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 3500);
    return () => clearInterval(id);
  }, [loading]);

  const saveGoal = async () => {
    const g = draftGoal.trim();
    setEditing(false);
    if (!g || g === goal) return;
    setGoal(g);
    try {
      await postJson("/api/goal", { goal: g });
    } catch {
      /* keep local */
    }
    load(true);
  };

  const items = useMemo(() => [...(data?.items ?? [])].sort((a, b) => b.score - a.score), [data]);
  const people = useMemo(() => new Map((graph.data?.people ?? []).map((p) => [p.id, p])), [graph.data]);

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 md:px-8 pt-6 md:pt-10 pb-10 flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="label">Your career agent</p>
        <h1 className="text-[26px] md:text-[32px] font-semibold tracking-tight leading-tight">
          Opportunities in <span style={{ color: "var(--teal)" }}>your network</span>
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] text-[var(--muted)]">Goal</span>
          {editing ? (
            <form
              className="flex gap-2 flex-1 min-w-0 w-full sm:min-w-[240px]"
              onSubmit={(e) => {
                e.preventDefault();
                saveGoal();
              }}
            >
              <label htmlFor="goal-input" className="sr-only">
                Your career goal
              </label>
              <input id="goal-input" autoFocus className="field !rounded-full !py-2" value={draftGoal} onChange={(e) => setDraftGoal(e.target.value)} placeholder="PM role in AI or retail, Bay Area" />
              <button type="submit" className="btn btn-dark !py-2">
                Save
              </button>
              <button type="button" className="btn !py-2" onClick={() => setEditing(false)} aria-label="Cancel">
                <IconX size={14} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="chip !text-[13px] !py-2 !px-3.5 max-w-full !whitespace-normal text-left"
              onClick={() => {
                setDraftGoal(goal);
                setEditing(true);
              }}
            >
              {goal || "Set your career goal"} <IconEdit size={13} />
            </button>
          )}
          <button type="button" className="btn !py-2 !px-3 text-[12px] ml-auto" onClick={() => load(true)} disabled={loading}>
            <IconSync size={14} /> {loading ? "Thinking…" : "Refresh"}
          </button>
        </div>
      </header>

      <div aria-live="polite" className="flex flex-col gap-6">
        {loading && (
          <div className="glass p-5 flex flex-col gap-3 rise">
            <div className="flex items-center gap-3">
              <span className="thinking" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="text-[15px]">Your agent is reading your brain…</span>
            </div>
            <ol className="flex flex-col gap-1.5 text-[13px]">
              {STEPS.map((s, i) => (
                <li key={s} style={{ color: i <= step ? "var(--text)" : "#9fb3a8" }}>
                  {i < step ? "✓" : i === step ? "•" : "·"} {s}
                </li>
              ))}
            </ol>
          </div>
        )}

        {error && !loading && (
          <div className="glass p-5">
            <p className="text-[14px]">Couldn&apos;t load opportunities: {error}</p>
            <button type="button" className="btn mt-3" onClick={() => load(true)}>
              Try again
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            {data.brainSays && (
              <figure className="glass p-5 rise">
                <figcaption className="label flex items-center gap-2 mb-2" style={{ color: "var(--green)" }}>
                  <IconBrain size={14} /> Cognee recall · your brain says
                </figcaption>
                <blockquote className="text-[14.5px] leading-relaxed flex flex-col gap-1">
                  {data.brainSays
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean)
                    .slice(0, 6)
                    .map((l, i) => (
                      <p key={i}>{inlineMd(l.replace(/^[-*]\s+/, "• "))}</p>
                    ))}
                </blockquote>
              </figure>
            )}

            {items.length === 0 && <p className="text-[14px] text-[var(--muted)]">No opportunities yet. Add people or events in Sources, then refresh.</p>}

            <div className="flex flex-col gap-3">
              {items.map((o, i) => (
                <OpportunityCard key={o.id} o={o} rank={i} people={people} onSend={() => setSheet(o)} />
              ))}
            </div>

            {data.trail.length > 0 && <HowDecided trail={data.trail} generatedAt={data.generatedAt} />}
          </>
        )}
      </div>

      <KeepWarm graph={graph.data} />

      {sheet && sheet.draft && <DraftSheet o={sheet} toName={people.get(sheet.draft.toPersonId)?.name ?? sheet.draft.toPersonId} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** Minimal **bold** / *italic* rendering for Cognee's markdown-ish answers. */
function inlineMd(s: string) {
  return s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
      <em key={i} className="text-[var(--muted)]">
        {part.slice(1, -1)}
      </em>
    ) : (
      part
    ),
  );
}

function OpportunityCard({ o, rank, people, onSend }: { o: Opportunity; rank: number; people: Map<string, import("@/lib/contracts").Person>; onSend: () => void }) {
  const k = KIND[o.kind];
  const Icon = k.icon;
  const top = rank === 0;
  const focusName = o.person?.name ?? o.event?.title;
  return (
    <article className="glass p-5 flex flex-col gap-3 rise" style={top ? { borderColor: "var(--green)", borderWidth: 1.5 } : undefined}>
      <div className="flex items-center gap-2">
        <span className="chip !text-[11px]" style={{ color: k.color }}>
          <Icon size={13} /> {k.label}
        </span>
        {top && (
          <span className="chip !text-[11px]" style={{ background: "var(--green)", color: "#fff", borderColor: "var(--green)" }}>
            Best move
          </span>
        )}
        <span className="ml-auto text-[12px] mono text-[var(--muted)]">{Math.round(o.score * 100)}</span>
      </div>

      <h3 className="text-[17px] font-semibold leading-snug">{o.title}</h3>

      {o.path && o.path.length > 1 && <PathRow path={o.path} people={people} />}

      {o.kind !== "referral" && o.person && (
        <div className="flex items-center gap-3">
          <Avatar person={o.person} size={34} />
          <div className="min-w-0">
            <Link href={`/people/${o.person.id}`} className="text-[14px] font-medium hover:underline underline-offset-4">
              {o.person.name}
            </Link>
            <div className="text-[12px] text-[var(--muted)] truncate">{[o.person.role, o.person.org].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
      )}

      {o.event && (
        <div className="rounded-[14px] bg-white/70 border border-white px-3.5 py-3 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-medium">{o.event.title}</span>
            <span className="chip !text-[11px] !py-1">{o.event.source === "luma" ? "Luma" : "Partiful"}</span>
            {o.event.seeded && <span className="tag-demo">demo data</span>}
          </div>
          <div className="text-[12.5px] text-[var(--muted)]">
            {[o.event.start ? shortDate(o.event.start) : "", o.event.location, o.event.hosts.length ? `Hosts: ${o.event.hosts.slice(0, 3).join(", ")}` : ""].filter(Boolean).join(" · ")}
          </div>
        </div>
      )}

      {o.why.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-[13.5px]">
          {o.why.slice(0, 3).map((w, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true" style={{ color: k.color }}>
                •
              </span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {o.draft ? (
          <button type="button" className={`btn ${o.kind === "referral" ? "btn-orange" : "btn-dark"} !py-2`} onClick={onSend}>
            <IconTelegram size={15} /> {o.kind === "referral" ? "Send intro request" : "Send message"}
          </button>
        ) : o.event ? (
          <a href={o.event.url} target="_blank" rel="noreferrer" className="btn btn-dark !py-2">
            <IconCalendar size={15} /> Open event
          </a>
        ) : null}
        {o.event && o.draft && (
          <a href={o.event.url} target="_blank" rel="noreferrer" className="btn !py-2">
            Open event
          </a>
        )}
        {focusName && (
          <Link href={`/brain?focus=${encodeURIComponent(focusName)}`} className="btn !py-2">
            <IconBrain size={15} /> View in brain
          </Link>
        )}
      </div>
    </article>
  );
}

function PathRow({ path, people }: { path: string[]; people: Map<string, import("@/lib/contracts").Person> }) {
  return (
    <div className="flex items-center gap-1 flex-wrap" aria-label={`Path: ${path.map((id) => people.get(id)?.name ?? (id === "me" ? "You" : id)).join(" to ")}`}>
      {path.map((id, i) => {
        const p = people.get(id);
        return (
          <span key={id + i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true" className="inline-block h-[2px] w-6 md:w-10 rounded-full" style={{ background: "var(--orange)" }} />}
            <span className="flex items-center gap-1.5 rounded-full bg-white/80 border border-white pl-0.5 pr-2.5 py-0.5">
              {p ? <Avatar person={p} size={26} /> : <Avatar name={id} size={26} />}
              <span className="text-[12.5px]">{id === "me" ? "You" : (p?.name ?? id).split(" ")[0]}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

function HowDecided({ trail, generatedAt }: { trail: TrailStep[]; generatedAt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="glass p-4">
      <button type="button" className="flex items-center gap-2 w-full text-left text-[14px] font-medium" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s" }}>
          <IconChevron size={16} />
        </span>
        How the agent decided
        <span className="ml-auto text-[12px] text-[var(--muted)] font-normal">
          {trail.length} steps · {new Date(generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
      </button>
      {open && (
        <div className="mt-3">
          <Trail steps={trail} />
        </div>
      )}
    </section>
  );
}

function DraftSheet({ o, toName, onClose }: { o: Opportunity; toName: string; onClose: () => void }) {
  const [text, setText] = useState(o.draft?.text ?? "");
  const [state, setState] = useState<{ busy: boolean; msg?: string; ok?: boolean; trail?: TrailStep[] }>({ busy: false });
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async () => {
    if (!o.draft || !text.trim()) return;
    setState({ busy: true });
    try {
      const r = await postJson<{ ok: boolean; channel: string; trail: TrailStep[] }>("/api/send", { personId: o.draft.toPersonId, text });
      setState({ busy: false, ok: r.ok, msg: r.ok ? "Sent on Telegram" : "Not linked on Telegram. Copy the draft instead.", trail: r.trail });
    } catch (e) {
      setState({ busy: false, ok: false, msg: (e as Error).message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-3" style={{ background: "rgba(23,48,42,.28)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="draft-h" className="glass !bg-[var(--glass-strong)] w-full max-w-[560px] p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h2 id="draft-h" className="text-[16px] font-semibold">
            Message to {toName}
          </h2>
          <button type="button" className="btn !p-2 ml-auto" onClick={onClose} aria-label="Close">
            <IconX size={14} />
          </button>
        </div>
        <p className="text-[13px] text-[var(--muted)]">{o.title}</p>
        <label htmlFor="draft-text" className="sr-only">
          Draft
        </label>
        <textarea id="draft-text" ref={ref} className="field min-h-[140px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn btn-orange" onClick={send} disabled={state.busy || !text.trim()}>
            <IconTelegram size={15} /> {state.busy ? "Sending…" : "Send via Telegram"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              navigator.clipboard?.writeText(text).catch(() => {});
              setState((s) => ({ ...s, msg: "Copied" }));
            }}
          >
            Copy
          </button>
        </div>
        {state.msg && (
          <p role="status" className="text-[13px]" style={{ color: state.ok ? "var(--green)" : undefined }}>
            {state.msg}
          </p>
        )}
        {state.trail && state.trail.length > 0 && <Trail steps={state.trail} />}
      </div>
    </div>
  );
}
