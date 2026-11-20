"use client";

import { useMemo, useState } from "react";
import type { TimelineItem, TimelineKind } from "@/lib/contracts";

export const KIND_META: Record<TimelineKind, { label: string; color: string }> = {
  connected: { label: "Connected", color: "#8A938E" },
  luma: { label: "Luma event", color: "#D46A8C" },
  linkedin: { label: "LinkedIn", color: "#2E9C9C" },
  gmail: { label: "Gmail", color: "#5B8DEF" },
  voice: { label: "Voice note", color: "#D9A23A" },
  meeting: { label: "Meeting notes", color: "#8E7CD6" },
  calendar: { label: "Calendar", color: "#4FA36B" },
  promise: { label: "Promise", color: "#E9772E" },
  note: { label: "Note", color: "#7FA08F" },
};

const KIND_ORDER: TimelineKind[] = ["connected", "luma", "linkedin", "gmail", "voice", "meeting", "calendar", "promise", "note"];

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  kept: { label: "Kept", bg: "#E4F3E8", fg: "#1d7a46" },
  slipped: { label: "Slipped", bg: "#EEF0EE", fg: "#5f6b66" },
  open: { label: "Open", bg: "#FCEBDD", fg: "#B4561A" },
  upcoming: { label: "Upcoming", bg: "#E5EDFC", fg: "#2F5FC4" },
};

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Undated" : d.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
};
const dayStr = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export function KindChips({
  counts,
  active,
  onToggle,
}: {
  counts: Partial<Record<TimelineKind, number>>;
  active: Set<TimelineKind>;
  onToggle: (k: TimelineKind) => void;
}) {
  const kinds = KIND_ORDER.filter((k) => (counts[k] ?? 0) > 0);
  if (!kinds.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by source">
      {kinds.map((k) => {
        const on = active.has(k);
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(k)}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] transition-colors"
            style={{
              borderColor: on ? KIND_META[k].color : "var(--line, #E8EBE6)",
              background: on ? `${KIND_META[k].color}14` : "#fff",
            }}
          >
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: KIND_META[k].color }} aria-hidden="true" />
            {KIND_META[k].label}
            <span className="font-mono text-[11.5px] text-[var(--muted)]">{counts[k]}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function Timeline({ items, filter }: { items: TimelineItem[]; filter: Set<TimelineKind> }) {
  const [showAll, setShowAll] = useState(false);
  const [newestFirst, setNewestFirst] = useState(false);

  const filtered = useMemo(() => (filter.size ? items.filter((i) => filter.has(i.kind)) : items), [items, filter]);
  const LIMIT = 40;
  const hidden = showAll ? 0 : Math.max(0, filtered.length - LIMIT);
  // Oldest-first, but when trimmed we keep the latest 40.
  const visible = filtered.slice(hidden);
  const ordered = newestFirst ? [...visible].reverse() : visible;

  const groups: { month: string; items: TimelineItem[] }[] = [];
  for (const it of ordered) {
    const m = monthKey(it.date);
    const last = groups[groups.length - 1];
    if (last && last.month === m) last.items.push(it);
    else groups.push({ month: m, items: [it] });
  }

  if (!filtered.length) return <p className="text-[14px] text-[var(--muted)]">No interactions for this filter yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-[12.5px] text-[var(--muted)]">
        <span>
          {filtered.length} interaction{filtered.length === 1 ? "" : "s"}
        </span>
        <button type="button" className="underline underline-offset-2 hover:text-[var(--ink)]" onClick={() => setNewestFirst((v) => !v)}>
          {newestFirst ? "Oldest first" : "Newest first"}
        </button>
      </div>

      {hidden > 0 && !newestFirst && (
        <button type="button" className="btn self-start !py-1.5 !px-3 text-[12.5px]" onClick={() => setShowAll(true)}>
          Show {hidden} earlier
        </button>
      )}

      <ol className="relative flex flex-col">
        <span className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--line,#E2E6E0)]" aria-hidden="true" />
        {groups.map((g) => (
          <li key={g.month + g.items[0].id} className="flex flex-col">
            <h3 className="pl-7 pt-3 pb-2 text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">{g.month}</h3>
            <ol className="flex flex-col gap-2.5">
              {g.items.map((it) => {
                const meta = KIND_META[it.kind] ?? KIND_META.note;
                const st = it.status ? STATUS_META[it.status] : undefined;
                return (
                  <li key={it.id} className="relative pl-7">
                    <span
                      className="absolute left-[2px] top-[18px] w-[11px] h-[11px] rounded-full ring-[3px] ring-[var(--bg,#F7F8F5)]"
                      style={{ background: meta.color }}
                      aria-hidden="true"
                    />
                    <article className="rounded-[12px] border border-[var(--line,#E8EBE6)] bg-white px-4 py-3 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                        <span className="font-medium" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="font-mono text-[11.5px] text-[var(--muted)]">{dayStr(it.date)}</span>
                        {st && (
                          <span className="rounded-full px-2 py-[1px] text-[11px] font-medium" style={{ background: st.bg, color: st.fg }}>
                            {st.label}
                          </span>
                        )}
                        {it.synthetic && <span className="ml-auto text-[10.5px] uppercase tracking-wide text-[var(--muted)] opacity-80">synthetic</span>}
                      </div>
                      <h4 className="mt-1 text-[15px] font-semibold leading-snug break-words">{it.title}</h4>
                      {it.location && <p className="text-[13px] text-[var(--muted)] mt-0.5">{it.location}</p>}
                      {it.body && <p className="mt-1 text-[13.5px] leading-relaxed text-[#3d4b46] whitespace-pre-line break-words">{it.body}</p>}
                    </article>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
