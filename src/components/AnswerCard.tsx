"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Answer, Candidate, Person, TrailStep } from "@/lib/contracts";
import Avatar from "./Avatar";
import { IconBars, IconTelegram } from "./icons";
import { postJson, tierLabel } from "./ui";
import { WhySources } from "./Why";

type SendResult = { ok: boolean; channel: "telegram" | "copy"; trail: TrailStep[]; error?: string };

export function contextTitle(q: string): string {
  let t = q
    .replace(/\?+$/, "")
    .replace(/who('?s| is)? (my )?best (call|person)[^.]*$/i, "")
    .replace(/^(i (want|need|am looking|'m looking) (to )?|i'm |looking for |who can help me (with )?|who should i (ask|talk to) about )/i, "")
    .replace(/[.\s]+$/, "")
    .trim();
  if (!t) t = q.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function pathText(c: Candidate, people: Map<string, Person>) {
  return c.path.map((id) => (id === "me" ? "You" : people.get(id)?.name.split(" ")[0] ?? (id === c.person.id ? c.person.name.split(" ")[0] : id))).join(" → ");
}

export default function AnswerCard({ answer, onPick }: { answer: Answer; onPick?: (c: Candidate) => void }) {
  const [active, setActive] = useState(0);
  const people = useMemo(() => {
    const m = new Map<string, Person>();
    for (const c of answer.candidates) {
      m.set(c.person.id, c.person);
      if (c.via) m.set(c.via.id, c.via);
    }
    return m;
  }, [answer.candidates]);
  const top = answer.candidates[0];
  const cur = answer.candidates[active] ?? top;
  const [draft, setDraft] = useState(answer.draft.text);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<SendResult | null>(null);
  const [copied, setCopied] = useState(false);
  const recipient = people.get(answer.draft.toPersonId);
  const chips = (top?.person.topics ?? []).slice(0, 3);

  const send = async () => {
    setSending(true);
    try {
      const r = await postJson<SendResult>("/api/send", { personId: answer.draft.toPersonId, text: draft });
      setSent(r);
    } catch (e) {
      setSent({ ok: false, channel: "copy", trail: [], error: (e as Error).message });
    } finally {
      setSending(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (!top) {
    return (
      <div className="glass p-5 text-[14px]">
        No one in your circle matches that yet. Try mentioning someone first, or ask more broadly.
      </div>
    );
  }

  return (
    <article className="glass p-4 md:p-5 flex flex-col gap-4 rise" aria-live="polite">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="label flex items-center gap-1.5" style={{ color: "var(--green)" }}>
            <IconBars size={14} /> Live context
          </div>
          {answer.route && (
            <span
              className="chip !text-[11px] !py-1"
              title={`Routed by ${answer.route.decider} (${Math.round(answer.route.confidence * 100)}% sure) to ${answer.route.model}`}
              style={answer.route.mode === "deep" ? { background: "#1F4A40", color: "#EAF1EC", borderColor: "#1F4A40" } : undefined}
            >
              {answer.route.mode === "fast" ? "⚡ Fast lookup" : "🧠 Deep reasoning"} · {answer.route.model.split("/").pop()} · {Math.round(answer.route.confidence * 100)}%
            </span>
          )}
        </div>
        <h3 className="text-[18px] font-semibold mt-1.5 leading-snug">{contextTitle(answer.query)}</h3>
        {answer.reply && <p className="mt-2 text-[15px] leading-relaxed">{answer.reply}</p>}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {chips.map((c) => (
              <span key={c} className="chip">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)" }} aria-hidden="true" />
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="label">People, right now</div>
        {answer.candidates.map((c, i) => {
          const isTop = i === 0;
          const sel = i === active;
          return (
            <button
              key={c.person.id}
              type="button"
              onClick={() => {
                setActive(i);
                onPick?.(c);
              }}
              className="flex items-center gap-3 rounded-[16px] bg-white px-3 py-2.5 text-left transition-shadow"
              style={{ border: isTop ? "1.5px solid #3aa06a" : sel ? "1px solid var(--teal)" : "0.5px solid var(--line)" }}
              aria-pressed={sel}
            >
              <Avatar person={c.person} size={38} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold truncate">{c.person.name}</span>
                  {c.label && c.label !== "match" && c.label !== "intro" && (
                    <span
                      className="text-[10px] font-semibold tracking-[0.08em] uppercase rounded-full px-2 py-0.5"
                      style={{
                        background: c.label === "opportunity" ? "#FCE9DC" : c.label === "reconnect" ? "#E2F1EA" : "#E8E6F7",
                        color: c.label === "opportunity" ? "#B4541A" : c.label === "reconnect" ? "#1F6B4C" : "#5A4BB0",
                      }}
                    >
                      {c.label === "research" ? "Research match" : c.label}
                    </span>
                  )}
                </span>
                <span className="block text-[12px] text-[var(--muted)] truncate">
                  {c.via ? pathText(c, people) : [c.person.role, c.person.org].filter(Boolean).join(" · ") || tierLabel(c.person)}
                </span>
                {c.today && <span className="block text-[12px] mt-0.5 truncate" style={{ color: "#1F4A40" }}>{c.why.slice(0, 2).join(" · ")}</span>}
              </span>
              {isTop && c.via ? (
                <span className="chip" style={{ background: "var(--green)", color: "#fff", borderColor: "var(--green)", fontWeight: 600 }}>
                  Intro ready
                </span>
              ) : (
                <span className="chip" style={isTop ? { background: "var(--green)", color: "#fff", borderColor: "var(--green)", fontWeight: 600 } : undefined}>
                  Say hi
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="draft" className="label">
          {top.via ? `Ask ${recipient?.name.split(" ")[0] ?? ""} for the intro` : `Message ${recipient?.name.split(" ")[0] ?? ""}`}
        </label>
        <textarea id="draft" className="field min-h-[96px] resize-y leading-relaxed" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          {answer.draft.channel === "telegram" ? (
            <button type="button" className="btn btn-orange" onClick={send} disabled={sending || !draft.trim()}>
              <IconTelegram size={16} /> {sending ? "Sending…" : "Send via Telegram"}
            </button>
          ) : (
            <button type="button" className="btn btn-dark" onClick={copy}>
              {copied ? "Copied" : "Copy message"}
            </button>
          )}
          {answer.draft.channel === "telegram" && (
            <button type="button" className="btn" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          {recipient && (
            <Link href={`/people/${recipient.id}`} className="text-[13px] text-[var(--muted)] underline underline-offset-4 ml-auto">
              Open {recipient.name.split(" ")[0]}&apos;s profile
            </Link>
          )}
        </div>
        {answer.draft.channel === "copy" && <p className="text-[12px] text-[var(--muted)]">Not linked on Telegram yet. Copy it, or have them send /iam to the bot.</p>}
        {sent && (
          <p className="text-[13px] rise" role="status" style={{ color: sent.ok ? "var(--green)" : "#a3452a" }}>
            {sent.ok ? `Sent on Telegram. ${sent.trail[0]?.detail ?? ""}` : sent.error || sent.trail[0]?.detail || "Couldn't send. Copy it instead."}
          </p>
        )}
      </div>

      <WhySources candidate={cur} memory={answer.memoryAnswer} trail={[...answer.trail, ...(sent?.trail ?? [])]} />
    </article>
  );
}
