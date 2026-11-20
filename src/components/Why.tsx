"use client";

import { useId, useState } from "react";
import type { Candidate, TrailStep } from "@/lib/contracts";
import { IconChevron } from "./icons";
import { shortDate } from "./ui";

const SPONSOR_COLOR: Record<TrailStep["sponsor"], string> = {
  SIE: "#3E8E86",
  Cognee: "#8A9A4B",
  SingleStore: "#C9A24A",
  Telegram: "#2f7fb5",
  Airbyte: "#615EFF",
  Rules: "#5f7a70",
  Local: "#8aa096",
};

export function Trail({ steps }: { steps: TrailStep[] }) {
  if (!steps.length) return null;
  return (
    <ol className="flex flex-col gap-1.5">
      {steps.map((s, i) => (
        <li key={i} className="grid grid-cols-[86px_minmax(0,1fr)_auto] gap-2 items-baseline text-[12px]">
          <span className="mono text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: SPONSOR_COLOR[s.sponsor] }}>
            {s.sponsor}
          </span>
          <span className="min-w-0">
            <span className="font-medium">{s.label}</span>
            <span className="text-[var(--muted)]"> · {s.detail}</span>
            {!s.real && s.sponsor !== "Rules" && <span className="tag-demo ml-1.5">fallback</span>}
          </span>
          <span className="mono text-[10.5px] text-[var(--muted)]">{s.ms ? `${s.ms}ms` : ""}</span>
        </li>
      ))}
    </ol>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)_32px] items-center gap-2 text-[12px]">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="h-1.5 rounded-full bg-[#e3eae5] overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${Math.round(v * 100)}%`, background: "var(--teal)" }} />
      </span>
      <span className="mono text-[11px] text-right">{Math.round(v * 100)}</span>
    </div>
  );
}

export function WhySources({ candidate, memory, trail, defaultOpen = false }: { candidate?: Candidate; memory?: string; trail: TrailStep[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-t border-[var(--line)] pt-3 mt-1">
      <button type="button" className="flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--text)]" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <IconChevron size={14} style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s" }} />
        Why{candidate ? ` ${candidate.person.name.split(" ")[0]}` : ""} · sources
      </button>
      {open && (
        <div id={id} className="mt-3 flex flex-col gap-4 rise">
          {candidate && (
            <>
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {candidate.why.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden="true" style={{ color: "var(--orange)" }}>
                      •
                    </span>
                    {w}
                  </li>
                ))}
              </ul>
              {candidate.evidence.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="label">Evidence</div>
                  {candidate.evidence.map((e) => (
                    <blockquote key={e.messageId} className="text-[13px] rounded-[12px] bg-white/70 border border-[var(--line)] px-3 py-2">
                      “{e.text}”
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--muted)]">
                        <span className="mono">
                          {e.source} · {shortDate(e.ts)} · {e.pillar}
                        </span>
                        {e.seeded && <span className="tag-demo">demo data</span>}
                      </div>
                    </blockquote>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <div className="label">Score · {Math.round(candidate.score * 100)}</div>
                <Bar label="Relevance" v={candidate.parts.relevance} />
                <Bar label="Tie" v={candidate.parts.tie} />
                <Bar label="Reach" v={candidate.parts.reach} />
                <Bar label="Recency" v={candidate.parts.recency} />
                <Bar label="Memory" v={candidate.parts.memory} />
              </div>
            </>
          )}
          {memory && (
            <div>
              <div className="label mb-1.5">Cognee recall</div>
              <p className="text-[13px] whitespace-pre-line text-[#2d4a41] rounded-[12px] bg-white/70 border border-[var(--line)] px-3 py-2">{memory.replace(/\*\*/g, "").replace(/^#+\s*/gm, "")}</p>
            </div>
          )}
          <div>
            <div className="label mb-1.5">Audit trail</div>
            <Trail steps={trail} />
          </div>
        </div>
      )}
    </div>
  );
}
