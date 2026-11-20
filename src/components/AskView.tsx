"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Answer, IngestResult } from "@/lib/contracts";
import AnswerCard from "./AnswerCard";
import { useSpeech } from "./hooks";
import { IconArrowUp, IconCheck, IconMic } from "./icons";
import { LAST_ANSWER_KEY, postJson } from "./ui";
import { WhySources } from "./Why";

type Item =
  | { id: number; kind: "q"; text: string; mode: "ask" | "note" }
  | { id: number; kind: "a"; answer: Answer }
  | { id: number; kind: "saved"; result: IngestResult }
  | { id: number; kind: "err"; text: string };

const EXAMPLES = [
  "I want to build voice agents. Who's my best call?",
  "I'm looking for a PM role in retail",
  "Who can help me raise a seed round?",
];

let nextId = 1;

export default function AskView() {
  const params = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"ask" | "note">("ask");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech((t) => setText(t));

  const run = async (query: string, m: "ask" | "note", cached?: Answer) => {
    const q = query.trim();
    if (!q) return;
    setItems((it) => [...it, { id: nextId++, kind: "q", text: q, mode: m }]);
    if (cached) {
      setItems((it) => [...it, { id: nextId++, kind: "a", answer: cached }]);
      return;
    }
    setBusy(true);
    try {
      if (m === "ask") {
        const a = await postJson<Answer>("/api/ask", { query: q });
        try {
          sessionStorage.setItem(LAST_ANSWER_KEY, JSON.stringify(a));
        } catch {
          /* storage unavailable */
        }
        setItems((it) => [...it, { id: nextId++, kind: "a", answer: a }]);
      } else {
        const r = await postJson<IngestResult>("/api/ingest", { text: q, source: "web" });
        setItems((it) => [...it, { id: nextId++, kind: "saved", result: r }]);
      }
    } catch (e) {
      setItems((it) => [...it, { id: nextId++, kind: "err", text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = params.get("q");
    if (!q) return;
    let cached: Answer | undefined;
    try {
      const raw = sessionStorage.getItem(LAST_ANSWER_KEY);
      const a = raw ? (JSON.parse(raw) as Answer) : undefined;
      if (a && a.query === q) cached = a;
    } catch {
      /* ignore */
    }
    run(q, "ask", cached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, busy]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !text.trim()) return;
    const t = text;
    setText("");
    run(t, mode);
  };

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 md:px-8 pt-6 md:pt-10 flex flex-col min-h-[calc(100dvh-140px)] md:min-h-dvh">
      <h1 className="text-[26px] md:text-[30px] font-semibold tracking-tight">Ask your circle</h1>
      <p className="text-[14px] text-[var(--muted)] mt-1">Say what you&apos;re working on. Circleback finds who can help, or who can introduce you.</p>

      <div className="flex flex-col gap-4 mt-6 flex-1" aria-live="polite">
        {items.length === 0 && !busy && (
          <div className="flex flex-col gap-2">
            <div className="label">Try</div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((s) => (
                <button key={s} type="button" className="chip !text-[13px] !py-2" onClick={() => run(s, "ask")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((it) => {
          if (it.kind === "q")
            return (
              <div key={it.id} className="self-end max-w-[85%] rise">
                {it.mode === "note" && <div className="label text-right mb-1">Saved note</div>}
                <div className="rounded-[18px] rounded-br-[6px] px-4 py-2.5 text-[14px]" style={{ background: "var(--teal)", color: "var(--teal-ink)" }}>
                  {it.text}
                </div>
              </div>
            );
          if (it.kind === "a") return <AnswerCard key={it.id} answer={it.answer} />;
          if (it.kind === "saved")
            return (
              <article key={it.id} className="glass p-4 rise">
                <div className="flex items-center gap-2 text-[14px] font-semibold">
                  <span className="w-6 h-6 grid place-items-center rounded-full" style={{ background: "var(--green)", color: "#fff" }}>
                    <IconCheck size={14} />
                  </span>
                  Saved · {it.result.message.pillar}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {it.result.people.length === 0 && <span className="text-[13px] text-[var(--muted)]">No people found in that note.</span>}
                  {it.result.people.map((p) => (
                    <Link key={p.id} href={`/people/${p.id}`} className="chip">
                      {p.name}
                      {p.org ? ` · ${p.org}` : ""}
                    </Link>
                  ))}
                </div>
                {it.result.promises.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 text-[13px]">
                    {it.result.promises.map((p) => (
                      <li key={p.id} style={{ color: "var(--orange)" }}>
                        {p.direction === "i_owe" ? "You owe" : "Owed to you"}: {p.text}
                        {p.due ? ` · due ${p.due}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                <WhySources trail={it.result.trail} />
              </article>
            );
          return (
            <p key={it.id} role="alert" className="glass px-4 py-3 text-[14px]" style={{ color: "#a3452a" }}>
              That didn&apos;t work: {it.text}
            </p>
          );
        })}
        {busy && (
          <div className="glass px-4 py-3 text-[13px] text-[var(--muted)] flex items-center gap-3 self-start" role="status">
            <span className="thinking" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {mode === "ask" ? "Searching notes, memory and your circle…" : "Saving and sorting…"}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="sticky bottom-24 md:bottom-6 mt-6 mb-2">
        <div className="glass !rounded-[22px] p-2">
          <div className="flex gap-1 px-1 pb-1.5" role="radiogroup" aria-label="Mode">
            {(["ask", "note"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={`chip ${mode === m ? "on" : ""}`} onClick={() => setMode(m)}>
                {m === "ask" ? "Ask" : "Save a note"}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <label htmlFor="ask-input" className="sr-only">
              {mode === "ask" ? "Ask your circle" : "Mention someone"}
            </label>
            <textarea
              id="ask-input"
              rows={1}
              className="flex-1 resize-none bg-transparent outline-none px-3 py-2.5 text-[15px] placeholder:text-[#7c938a] max-h-40"
              placeholder={mode === "ask" ? "What are you working on?" : "Met Lena at the AWS Loft, she runs voice AI at Sonance…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(e as unknown as React.FormEvent);
                }
              }}
            />
            {speech.supported && (
              <button type="button" onClick={speech.toggle} aria-label={speech.listening ? "Stop dictation" : "Dictate"} aria-pressed={speech.listening} className="w-10 h-10 grid place-items-center rounded-full shrink-0" style={{ background: speech.listening ? "var(--orange)" : "#eef3ef", color: speech.listening ? "#fff" : "var(--teal)" }}>
                <IconMic size={18} />
              </button>
            )}
            <button type="submit" aria-label={mode === "ask" ? "Ask" : "Save note"} disabled={busy} className="w-10 h-10 grid place-items-center rounded-full shrink-0" style={{ background: "var(--teal)", color: "var(--teal-ink)" }}>
              <IconArrowUp size={18} />
            </button>
          </div>
          <p className="text-[11px] text-[var(--muted)] px-3 pt-1">
            Or message <span className="mono">@mypersonalboibot</span> on Telegram. You approve every send.
          </p>
        </div>
      </form>
    </div>
  );
}
