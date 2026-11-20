"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AirbyteStatus, BrainGraph, EventItem, GraphData, Nudge, Opportunity, OpportunitiesResponse, Person, Promise as PromiseRow, SponsorStatus, TrailStep } from "@/lib/contracts";
import Avatar from "./Avatar";
import EventLink from "./EventLink";
import { usePoll, useSpeech } from "./hooks";
import { IconArrowUp, IconBrain, IconCalendar, IconCheck, IconChevron, IconMic, IconTelegram, IconX } from "./icons";
import { getJson, isOverdue, postJson, shortDate } from "./ui";
import { Trail } from "./Why";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function HomeView() {
  const router = useRouter();
  const graph = usePoll<GraphData>("/api/graph", 20000);
  const nudges = usePoll<Nudge[]>("/api/nudges", 20000);
  const promises = usePoll<PromiseRow[]>("/api/promises", 20000);
  const [hello, setHello] = useState("");
  const [goal, setGoal] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftGoal, setDraftGoal] = useState("");
  const [data, setData] = useState<OpportunitiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Opportunity | null>(null);
  const [prompt, setPrompt] = useState("");
  const [kept, setKept] = useState<Set<string>>(new Set());
  const speech = useSpeech((t) => setPrompt(t));

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
    setHello(greeting());
    getJson<{ goal: string }>("/api/goal")
      .then((g) => setGoal(g.goal || ""))
      .catch(() => {});
    load(false);
  }, [load]);

  const people = useMemo(() => new Map((graph.data?.people ?? []).map((p) => [p.id, p])), [graph.data]);
  const items = useMemo(() => [...(data?.items ?? [])].sort((a, b) => b.score - a.score), [data]);
  const best = items.filter((o) => o.kind === "referral" || o.kind === "reach_out").slice(0, 3);
  const events = items.filter((o) => o.kind === "event");
  const reconnect = items.filter((o) => o.kind === "reconnect");
  const drift = (nudges.data ?? []).filter((n) => n.kind === "drift" && !reconnect.some((o) => o.person?.id === n.personId));
  const promiseFor = (n: Nudge) => (promises.data ?? []).find((p) => p.status === "open" && p.personId === n.personId && n.text.includes(p.text));
  const warm = (nudges.data ?? []).filter((n) => n.kind === "promise" && !kept.has(promiseFor(n)?.id ?? "")).slice(0, 5);

  const saveGoal = async () => {
    const g = draftGoal.trim();
    setEditing(false);
    if (!g || g === goal) return;
    setGoal(g);
    await postJson("/api/goal", { goal: g }).catch(() => {});
    load(true);
  };

  const keep = async (n: Nudge) => {
    const p = promiseFor(n);
    if (!p) return;
    setKept((s) => new Set(s).add(p.id));
    await postJson(`/api/promises/${p.id}/keep`).catch(() => {});
    nudges.refresh();
    promises.refresh();
  };

  const brainLine = (data?.brainSays ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "").replace(/\*/g, "").trim())
    .filter(Boolean);

  return (
    <div className="flex min-h-[calc(100dvh-56px)]">
      <div className="flex-1 min-w-0 px-4 md:px-8 pt-8 md:pt-12 pb-12">
        <div className="mx-auto w-full max-w-[680px] flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <h1 className="serif text-[34px] md:text-[38px] leading-tight" style={{ color: "#1d2b26" }}>
              {hello || "Hello"}
            </h1>
            {editing ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveGoal();
                }}
              >
                <label htmlFor="goal-input" className="sr-only">
                  Your career goal
                </label>
                <input id="goal-input" autoFocus className="field !py-1.5" value={draftGoal} onChange={(e) => setDraftGoal(e.target.value)} placeholder="PM role in AI or retail, Bay Area" />
                <button type="submit" className="btn btn-dark !py-1.5 !px-3 text-[13px]">
                  Save
                </button>
                <button type="button" className="btn !p-2" aria-label="Cancel" onClick={() => setEditing(false)}>
                  <IconX size={14} />
                </button>
              </form>
            ) : (
              <p className="text-[14px] text-[var(--muted)]">
                Goal: <span style={{ color: "var(--text)" }}>{goal || "not set"}</span> ·{" "}
                <button
                  type="button"
                  className="underline underline-offset-4 hover:text-[var(--teal)]"
                  onClick={() => {
                    setDraftGoal(goal);
                    setEditing(true);
                  }}
                >
                  edit
                </button>
              </p>
            )}
            <BrainLine lines={brainLine} loading={loading} />
          </header>

          <form
            className="rounded-[12px] border bg-white p-3 flex flex-col gap-2 focus-within:border-[#c9d4cc]"
            style={{ borderColor: "var(--line)", boxShadow: "0 1px 2px rgba(23,48,42,.04), 0 6px 20px rgba(62,142,134,.06)" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (prompt.trim()) router.push(`/ask?q=${encodeURIComponent(prompt.trim())}`);
            }}
          >
            <label htmlFor="ask-input" className="sr-only">
              What would you like to do today?
            </label>
            <textarea
              id="ask-input"
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (prompt.trim()) router.push(`/ask?q=${encodeURIComponent(prompt.trim())}`);
                }
              }}
              placeholder="What would you like to do today? Try “Who can get me into Sonance?”"
              className="w-full resize-none bg-transparent outline-none text-[15px] leading-relaxed placeholder:text-[#93a39b]"
            />
            <div className="flex items-center justify-end gap-2">
              {speech.supported && (
                <button type="button" className="btn !p-2 !border-transparent" aria-label={speech.listening ? "Stop dictation" : "Dictate"} onClick={speech.toggle} style={speech.listening ? { color: "var(--orange)" } : undefined}>
                  <IconMic size={16} />
                </button>
              )}
              <button type="submit" className="btn btn-dark !p-2 !rounded-[8px]" aria-label="Ask">
                <IconArrowUp size={16} />
              </button>
            </div>
          </form>

          {error && (
            <p className="text-[14px]">
              Couldn&apos;t load opportunities: {error}{" "}
              <button type="button" className="underline" onClick={() => load(true)}>
                Try again
              </button>
            </p>
          )}

          <Section title="Best moves" loading={loading} empty="No people matches yet. Import contacts in Sources.">
            {best.map((o) => {
              const via = o.path && o.path.length > 2 ? people.get(o.path[1]) : undefined;
              return (
                <button type="button" key={o.id} className="row" onClick={() => setOpen(o)}>
                  {o.person && <Avatar person={o.person} size={28} />}
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    <span className="font-medium">{o.person?.name}</span>
                    <span className="text-[var(--muted)]">
                      {via ? ` · via ${via.name.split(" ")[0]}` : ""} · {[o.person?.role, o.person?.org].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <Pill tone={o.kind === "referral" ? "orange" : "green"}>{o.kind === "referral" ? "Intro ready" : "Say hi"}</Pill>
                </button>
              );
            })}
          </Section>

          <Section title="Events" loading={loading} empty="No events yet. Paste a Luma or Partiful link in Sources.">
            {events.map((o) =>
              o.event ? (
                <button type="button" key={o.id} className="row" onClick={() => setOpen(o)}>
                  <span className="w-7 flex justify-center text-[#6b9bd0]" style={{ color: "var(--work)" }}>
                    <IconCalendar size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {o.event.title}
                    {o.event.seeded && <span className="tag-demo ml-2">demo</span>}
                  </span>
                  <span className="chip !text-[11px] !py-1">{o.event.source === "luma" ? "Luma" : "Partiful"}</span>
                  <span className="text-[12.5px] text-[var(--muted)] w-[62px] text-right">{o.event.start ? shortDate(o.event.start) : ""}</span>
                </button>
              ) : null,
            )}
          </Section>

          <Section title="Keep warm" loading={nudges.loading} empty="✅ All caught up">
            {warm.map((n, i) => {
              const p = people.get(n.personId);
              const over = isOverdue(n.due);
              return (
                <div key={i} className="row">
                  {p ? <Avatar person={p} size={28} /> : <span className="w-7" />}
                  <Link href={`/people/${n.personId}`} className="min-w-0 flex-1 truncate text-[14px] hover:underline underline-offset-4">
                    {n.text}
                  </Link>
                  {promiseFor(n) && (
                    <button type="button" className="text-[12.5px] text-[var(--muted)] hover:text-[var(--teal)] flex items-center gap-1" onClick={() => keep(n)}>
                      <IconCheck size={13} /> Mark kept
                    </button>
                  )}
                  <span className="text-[12.5px] w-[62px] text-right" style={{ color: over ? "var(--orange)" : "var(--muted)" }}>
                    {n.due ? shortDate(n.due) : ""}
                  </span>
                </div>
              );
            })}
          </Section>

          <Section title="Reconnect" loading={loading} empty="Nobody is drifting. Nice.">
            {reconnect.map((o) => (
              <button type="button" key={o.id} className="row" onClick={() => setOpen(o)}>
                {o.person && <Avatar person={o.person} size={28} />}
                <span className="min-w-0 flex-1 truncate text-[14px]">
                  <span className="font-medium">{o.person?.name}</span>
                  <span className="text-[var(--muted)]"> · {[o.person?.role, o.person?.org].filter(Boolean).join(", ")}</span>
                </span>
                <span className="text-[12.5px] text-[var(--muted)]">{o.why[0]?.replace(" since you last talked", "")}</span>
              </button>
            ))}
            {drift.map((n, i) => {
              const p = people.get(n.personId);
              return (
                <Link key={`d${i}`} href={`/people/${n.personId}`} className="row">
                  {p ? <Avatar person={p} size={28} /> : <span className="w-7" />}
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{p?.name ?? n.personId}</span>
                  <span className="text-[12.5px] text-[var(--muted)]">{n.text.split(" since")[0]}</span>
                </Link>
              );
            })}
          </Section>

          {data && data.trail.length > 0 && <HowDecided trail={data.trail} at={data.generatedAt} onRefresh={() => load(true)} loading={loading} />}
        </div>
      </div>

      <GettingStarted goal={goal} graph={graph.data} />

      {open && <Drawer o={open} people={people} onClose={() => setOpen(null)} />}
    </div>
  );
}

function BrainLine({ lines, loading }: { lines: string[]; loading: boolean }) {
  const [more, setMore] = useState(false);
  if (loading)
    return (
      <p className="text-[13.5px] text-[var(--muted)] flex items-center gap-2">
        <span className="thinking" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        Reading your brain… (Cognee · SingleStore · SIE)
      </p>
    );
  if (!lines.length) return null;
  return (
    <div className="text-[13.5px] text-[var(--muted)] leading-relaxed" aria-live="polite">
      <span className="inline-flex items-center gap-1.5" style={{ color: "var(--teal)" }}>
        <IconBrain size={14} /> Your brain:
      </span>{" "}
      {more ? (
        <ul className="mt-1 flex flex-col gap-1">
          {lines.slice(0, 6).map((l, i) => (
            <li key={i}>· {l}</li>
          ))}
        </ul>
      ) : (
        <span>{lines[0].length > 120 ? lines[0].slice(0, 118) + "…" : lines[0]}</span>
      )}{" "}
      <button type="button" className="underline underline-offset-4 hover:text-[var(--teal)]" onClick={() => setMore((m) => !m)}>
        {more ? "Less" : "Read more"}
      </button>
    </div>
  );
}

function Section({ title, loading, empty, children }: { title: string; loading: boolean; empty: string; children: React.ReactNode }) {
  const kids = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <section aria-label={title}>
      <h2 className="section-h">{title}</h2>
      {loading && kids.length === 0 ? (
        <div className="flex flex-col gap-2.5 py-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="skel w-7 h-7 !rounded-full" />
              <span className="skel h-3.5 flex-1" style={{ maxWidth: 360 - i * 60 }} />
            </div>
          ))}
        </div>
      ) : kids.length === 0 ? (
        <p className="text-[13.5px] text-[var(--muted)] py-1">{empty}</p>
      ) : (
        <div className="flex flex-col">{children}</div>
      )}
    </section>
  );
}

function Pill({ tone, children }: { tone: "orange" | "green"; children: React.ReactNode }) {
  return (
    <span
      className="text-[11.5px] font-medium rounded-full px-2.5 py-1 whitespace-nowrap"
      style={tone === "orange" ? { background: "#FCEBDD", color: "#B5561B" } : { background: "#E2F1E8", color: "#1D6B42" }}
    >
      {children}
    </span>
  );
}

function HowDecided({ trail, at, onRefresh, loading }: { trail: TrailStep[]; at: string; onRefresh: () => void; loading: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-t pt-4" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
        <button type="button" className="flex items-center gap-1.5 hover:text-[var(--teal)]" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s" }}>
            <IconChevron size={14} />
          </span>
          How the agent decided · {trail.length} steps · {new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </button>
        <button type="button" className="ml-auto underline underline-offset-4 hover:text-[var(--teal)]" onClick={onRefresh} disabled={loading}>
          {loading ? "Thinking…" : "Refresh"}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <Trail steps={trail} />
        </div>
      )}
    </section>
  );
}

function GettingStarted({ goal, graph }: { goal: string; graph?: GraphData }) {
  const status = usePoll<SponsorStatus>("/api/status", 60000);
  const events = usePoll<EventItem[]>("/api/events", 30000);
  const airbyte = usePoll<AirbyteStatus>("/api/airbyte", 60000);
  const brain = usePoll<BrainGraph>("/api/brain", 60000);
  const steps = [
    { label: "Import LinkedIn connections", done: (graph?.people.length ?? 0) > 100, href: "/sources" },
    { label: "Link Telegram", done: !!status.data?.telegram, href: "/sources" },
    { label: "Add an event from Luma or Partiful", done: (events.data ?? []).some((e) => !e.seeded), href: "/sources" },
    { label: "Connect Gmail via Airbyte", done: (airbyte.data?.connections.length ?? 0) > 0, href: "/sources" },
    { label: "Set your career goal", done: !!goal, href: "/" },
  ];
  const n = steps.filter((s) => s.done).length;
  return (
    <aside className="hidden xl:flex flex-col w-[300px] shrink-0 border-l px-5 py-8 gap-6 sticky top-14 h-[calc(100dvh-56px)]" style={{ borderColor: "var(--line)", background: "var(--side)" }} aria-label="Getting started">
      <div>
        <h2 className="text-[15px] font-semibold">Getting started</h2>
        <p className="text-[12.5px] text-[var(--muted)] mt-0.5">
          {n} of {steps.length} steps completed{n >= 3 ? ". Great start!" : "."}
        </p>
        <div className="h-[3px] rounded-full mt-3" style={{ background: "var(--line)" }}>
          <div className="h-full rounded-full" style={{ width: `${(n / steps.length) * 100}%`, background: "var(--green)" }} />
        </div>
        <ul className="mt-4 flex flex-col gap-1">
          {steps.map((s) => (
            <li key={s.label}>
              <Link href={s.href} className="flex items-center gap-2.5 py-1.5 text-[13.5px] hover:text-[var(--teal)]" style={{ color: s.done ? "var(--muted)" : "var(--text)" }}>
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full shrink-0"
                  style={s.done ? { background: "var(--green)", color: "#fff" } : { border: "1.5px solid #cbd5ce" }}
                >
                  {s.done && <IconCheck size={11} />}
                </span>
                <span className={s.done ? "line-through decoration-[#b8c4bd]" : ""}>{s.label}</span>
                <span className="sr-only">{s.done ? "(done)" : "(to do)"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Link href="/brain" className="mt-auto rounded-[12px] border bg-white p-4 flex items-end gap-3 hover:border-[#cdd8d0] transition-colors overflow-hidden relative" style={{ borderColor: "var(--line)" }}>
        <div className="relative z-10 flex-1">
          <div className="text-[10.5px] tracking-[0.08em] uppercase text-[var(--muted)]">Your brain</div>
          <div className="text-[13.5px] font-medium mt-1 leading-snug">
            {brain.data ? `${brain.data.counts.entities} entities` : "Loading…"}
            <br />
            <span className="text-[var(--muted)] font-normal">single Cognee brain</span>
          </div>
          <span aria-hidden="true" className="inline-block mt-2 text-[var(--teal)]">
            →
          </span>
        </div>
        <MiniGlobe />
      </Link>
    </aside>
  );
}

function MiniGlobe() {
  const pts = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ a: (i * 137.5 * Math.PI) / 180, r: 0.25 + ((i * 37) % 70) / 100 })), []);
  return (
    <svg width="96" height="96" viewBox="-50 -50 100 100" aria-hidden="true" className="shrink-0 -mr-2 -mb-2">
      <circle r="44" fill="#EEF3EE" stroke="#D9E2DB" />
      <ellipse rx="44" ry="15" fill="none" stroke="#D9E2DB" />
      <ellipse rx="18" ry="44" fill="none" stroke="#D9E2DB" />
      {pts.map((p, i) => (
        <circle key={i} cx={Math.round(Math.cos(p.a) * p.r * 400) / 10} cy={Math.round(Math.sin(p.a) * p.r * 400) / 10} r={i % 7 === 0 ? 3 : 2} fill={["#1F4A40", "#C9A24A", "#3E8E86", "#E9772E"][i % 4]} opacity={0.85} />
      ))}
      <circle r="5" fill="#1F4A40" />
    </svg>
  );
}

function Drawer({ o, people, onClose }: { o: Opportunity; people: Map<string, Person>; onClose: () => void }) {
  const [text, setText] = useState(o.draft?.text ?? "");
  const [state, setState] = useState<{ busy: boolean; msg?: string; ok?: boolean; trail?: TrailStep[] }>({ busy: false });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const toName = o.draft ? (people.get(o.draft.toPersonId)?.name ?? o.draft.toPersonId) : "";
  const focus = o.person?.name ?? o.event?.title;
  const meet = o.event ? o.event.hosts.map((h) => [...people.values()].find((p) => p.name.toLowerCase() === h.toLowerCase())).filter((p): p is Person => !!p) : [];

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
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(23,48,42,.18)" }} onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-h"
        className="h-full w-full max-w-[440px] bg-white border-l overflow-y-auto p-6 flex flex-col gap-5 outline-none rise"
        style={{ borderColor: "var(--line)", boxShadow: "-12px 0 40px rgba(23,48,42,.10)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {o.person ? <Avatar person={o.person} size={40} /> : <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--sage-soft)", color: "var(--teal)" }}><IconCalendar size={18} /></span>}
          <div className="min-w-0 flex-1">
            <h2 id="drawer-h" className="text-[17px] font-semibold leading-snug">
              {o.title}
            </h2>
            <p className="text-[13px] text-[var(--muted)]">
              {o.event
                ? [o.event.start ? shortDate(o.event.start) : "", o.event.location, o.event.source === "luma" ? "Luma" : "Partiful"].filter(Boolean).join(" · ")
                : [o.person?.role, o.person?.org].filter(Boolean).join(" · ")}
              {o.event?.seeded && <span className="tag-demo ml-2">demo</span>}
            </p>
          </div>
          <button type="button" className="btn !p-2" onClick={onClose} aria-label="Close">
            <IconX size={14} />
          </button>
        </div>

        {o.path && o.path.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap" aria-label={`Path: ${o.path.map((id) => (id === "me" ? "You" : people.get(id)?.name ?? id)).join(" to ")}`}>
            {o.path.map((id, i) => {
              const p = people.get(id);
              return (
                <span key={id + i} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden="true" className="inline-block h-[2px] w-7 rounded-full" style={{ background: "var(--orange)" }} />}
                  <span className="flex items-center gap-1.5 rounded-full border pl-0.5 pr-2.5 py-0.5" style={{ borderColor: "var(--line)" }}>
                    {p ? <Avatar person={p} size={24} /> : <Avatar name={id} size={24} />}
                    <span className="text-[12.5px]">{id === "me" ? "You" : (p?.name ?? id).split(" ")[0]}</span>
                  </span>
                </span>
              );
            })}
          </div>
        )}

        {o.why.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-[13.5px]">
            {o.why.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-[var(--muted)]">
                  ·
                </span>
                {w}
              </li>
            ))}
          </ul>
        )}

        {meet.length > 0 && (
          <div>
            <h3 className="section-h">Who to meet</h3>
            {meet.map((p) => (
              <Link key={p.id} href={`/people/${p.id}`} className="row">
                <Avatar person={p} size={26} />
                <span className="text-[13.5px] font-medium">{p.name}</span>
                <span className="text-[12.5px] text-[var(--muted)] truncate">{[p.role, p.org].filter(Boolean).join(", ")}</span>
              </Link>
            ))}
          </div>
        )}

        {o.draft && (
          <div className="flex flex-col gap-2">
            <label htmlFor="draft-text" className="section-h">
              Message to {toName}
            </label>
            <textarea id="draft-text" className="field min-h-[130px] leading-relaxed text-[14px]" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="btn btn-orange !py-2" onClick={send} disabled={state.busy || !text.trim()}>
                <IconTelegram size={15} /> {state.busy ? "Sending…" : "Send via Telegram"}
              </button>
              <button
                type="button"
                className="btn !py-2"
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
        )}

        <div className="flex gap-2 flex-wrap">
          {o.event && (
            <EventLink url={o.event.url || `/events/${o.event.id}`} className="btn btn-dark !py-2">
              <IconCalendar size={15} /> Open event
            </EventLink>
          )}
          {focus && (
            <Link href={`/brain?focus=${encodeURIComponent(focus)}`} className="btn !py-2">
              <IconBrain size={15} /> View in brain
            </Link>
          )}
          {o.person && (
            <Link href={`/people/${o.person.id}`} className="btn !py-2">
              Profile
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
