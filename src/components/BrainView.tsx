"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { BrainGraph } from "@/lib/contracts";
import { useReducedMotion, usePoll } from "./hooks";
import { IconSearch, IconX } from "./icons";
import { TYPE_COLOR, typeColor } from "./BrainGlobe";

const BrainGlobe = dynamic(() => import("./BrainGlobe"), { ssr: false });

const LEGEND = ["Person", "Company", "Role", "Event", "Skill"];

export default function BrainView() {
  // Fetch once; the graph is large and refetching rebuilds the scene. Refresh is manual.
  const brain = usePoll<BrainGraph>("/api/brain", 0);
  const [refreshing, setRefreshing] = useState(false);
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const g = brain.data;

  const byId = useMemo(() => new Map((g?.nodes ?? []).map((n) => [n.id, n])), [g]);
  const findNode = (name: string) => {
    const s = name.trim().toLowerCase();
    if (!s || !g) return undefined;
    return g.nodes.find((n) => n.name.toLowerCase() === s) || g.nodes.find((n) => n.name.toLowerCase().includes(s)) || g.nodes.find((n) => s.includes(n.name.toLowerCase()) && n.name.length > 3);
  };

  const focus = params.get("focus");
  useEffect(() => {
    if (!focus || !g) return;
    const n = findNode(focus);
    if (n) setSelectedId(n.id);
    setQ(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, g]);

  const matches = q.trim() && g ? g.nodes.filter((n) => n.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  const sel = selectedId ? byId.get(selectedId) : undefined;
  const rels = sel && g ? g.edges.filter((e) => e.source === sel.id || e.target === sel.id) : [];

  return (
    <div className="relative h-[calc(100dvh-64px)] md:h-dvh min-h-[560px] overflow-hidden">
      {g && g.nodes.length > 0 && <BrainGlobe graph={g} selectedId={selectedId} onSelect={setSelectedId} reduceMotion={reduce} />}

      <header className="absolute top-4 left-4 right-4 md:right-auto md:max-w-[460px] flex flex-col gap-3 z-[60]">
        <div className="glass p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[18px] font-semibold">Your brain</h1>
            {g && <span className="chip !text-[11px] mono">{g.dataset}</span>}
            <button
              type="button"
              className="btn !py-1 !px-2.5 text-[12px] ml-auto"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                await brain.refresh();
                setRefreshing(false);
              }}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <p className="text-[12.5px] text-[var(--muted)] mt-1">Live from Cognee Cloud · single brain per user</p>
          {g && (
            <p className="text-[13px] mt-2">
              {g.counts.entities} entities · {g.counts.relations} relations · {g.counts.documents} memories
            </p>
          )}
          {g && g.nodeSets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {g.nodeSets.slice(0, 6).map((s) => (
                <span key={s} className="chip !text-[11px] !py-1">
                  {s}
                </span>
              ))}
              {g.nodeSets.length > 6 && (
                <span className="chip !text-[11px] !py-1" title={g.nodeSets.slice(6).join(", ")}>
                  +{g.nodeSets.length - 6} node sets
                </span>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <label htmlFor="brain-search" className="sr-only">
            Find in your brain
          </label>
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            <IconSearch size={16} />
          </span>
          <input
            id="brain-search"
            className="field !rounded-full !pl-10 !py-2.5 glass"
            placeholder="Find a person, company or role…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) setSelectedId(matches[0].id);
            }}
          />
          {matches.length > 0 && !(sel && sel.name.toLowerCase() === q.trim().toLowerCase()) && (
            <ul className="glass absolute z-20 left-0 right-0 mt-2 p-1.5">
              {matches.map((n) => (
                <li key={n.id}>
                  <button type="button" className="w-full text-left flex items-center gap-2 rounded-[12px] px-2.5 py-2 hover:bg-white text-[14px]" onClick={() => setSelectedId(n.id)}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: typeColor(n.entityType) }} aria-hidden="true" />
                    {n.name}
                    <span className="text-[12px] text-[var(--muted)]">{n.entityType}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <div className="absolute bottom-4 left-4 z-[60] glass px-3 py-2 hidden md:flex gap-3 text-[12px]">
        {LEGEND.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} aria-hidden="true" />
            {t}
          </span>
        ))}
      </div>

      {brain.loading && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="glass px-4 py-3 text-[14px]">Loading your brain from Cognee…</p>
        </div>
      )}
      {(brain.error || g?.error) && (
        <div className="absolute inset-0 grid place-items-center p-4">
          <div className="glass p-5 max-w-[420px] text-[14px]">
            <p className="font-medium">Couldn&apos;t load the brain</p>
            <p className="text-[var(--muted)] mt-1">{brain.error || g?.error}</p>
            <p className="text-[12.5px] text-[var(--muted)] mt-2">Cognee builds the graph in the background after new memories arrive; this can take a few minutes.</p>
          </div>
        </div>
      )}
      {g && !g.error && g.nodes.length === 0 && (
        <div className="absolute inset-0 grid place-items-center p-4">
          <p className="glass p-5 text-[14px] max-w-[420px]">Your brain is still being built. Cognee is extracting people, companies and roles from your memories.</p>
        </div>
      )}

      {sel && (
        <aside className="absolute z-[60] right-4 left-4 md:left-auto bottom-4 md:bottom-auto md:top-4 md:w-[320px] glass !bg-[var(--glass-strong)] p-4 flex flex-col gap-3 rise max-h-[60vh] overflow-auto" aria-live="polite">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 w-3 h-3 rounded-full shrink-0" style={{ background: typeColor(sel.entityType) }} aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold leading-snug">{sel.name}</h2>
              <p className="text-[12px] text-[var(--muted)]">{sel.entityType || sel.type}</p>
            </div>
            <button type="button" className="btn !p-2 ml-auto" aria-label="Close" onClick={() => setSelectedId(null)}>
              <IconX size={14} />
            </button>
          </div>
          {sel.description && <p className="text-[13px] leading-relaxed">{sel.description}</p>}
          <div>
            <h3 className="label mb-1.5">Relations</h3>
            {rels.length === 0 && <p className="text-[13px] text-[var(--muted)]">No relations yet.</p>}
            <ul className="flex flex-col gap-1 text-[13px]">
              {rels.slice(0, 14).map((e, i) => {
                const out = e.source === sel.id;
                const other = byId.get(out ? e.target : e.source);
                return (
                  <li key={i} className="flex flex-wrap gap-1 items-baseline">
                    {!out && <span>{other?.name}</span>}
                    <span className="mono text-[11.5px]" style={{ color: "var(--orange)" }}>
                      {out ? "" : "→ "}
                      {e.label.replace(/_/g, " ")}
                      {out ? " →" : ""}
                    </span>
                    {out && (
                      <button type="button" className="underline underline-offset-2" onClick={() => other && setSelectedId(other.id)}>
                        {other?.name}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          {sel.entityType === "Person" && (
            <Link href={`/ask?q=${encodeURIComponent(`What do I know about ${sel.name} and how can they help my career?`)}`} className="btn btn-dark !py-2">
              Ask about {sel.name.split(" ")[0]}
            </Link>
          )}
        </aside>
      )}
    </div>
  );
}
