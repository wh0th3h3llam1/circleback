"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { GraphData, Person } from "@/lib/contracts";
import Avatar from "./Avatar";
import { usePoll } from "./hooks";
import { IconChevron, IconSearch } from "./icons";
import { PILLAR_COLOR, PILLAR_LABEL, primaryPillar, timeAgo } from "./ui";

const GROUPS: { key: string; label: string; test: (p: Person) => boolean }[] = [
  { key: "inner", label: "Inner circle", test: (p) => p.met && p.tier === "inner" },
  { key: "close", label: "Close", test: (p) => p.met && p.tier === "close" },
  { key: "good", label: "Good", test: (p) => p.met && p.tier === "good" },
  { key: "known", label: "Known", test: (p) => p.met && p.tier === "known" },
  { key: "second", label: "Second degree · through someone", test: (p) => !p.met },
];

export default function PeopleView() {
  const graph = usePoll<GraphData>("/api/graph", 5000);
  const [q, setQ] = useState("");
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  useEffect(() => setQ(urlQ), [urlQ]);
  const all = (graph.data?.people ?? []).filter((p) => p.id !== "me");
  const list = q.trim() ? all.filter((p) => `${p.name} ${p.org ?? ""} ${p.role ?? ""} ${p.topics.join(" ")}`.toLowerCase().includes(q.toLowerCase())) : all;

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 md:px-8 pt-6 md:pt-10 pb-10 flex flex-col gap-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] md:text-[30px] font-semibold tracking-tight">People</h1>
          <p className="text-[14px] text-[var(--muted)] mt-1">{all.length} people across work, career, projects and family.</p>
        </div>
      </header>
      <div className="relative">
        <label htmlFor="ppl-q" className="sr-only">
          Search people
        </label>
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
          <IconSearch size={16} />
        </span>
        <input id="ppl-q" className="field glass !rounded-full !pl-10 !py-3" placeholder="Search by name, company or topic" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {graph.loading && <p className="text-[14px] text-[var(--muted)]">Loading people…</p>}
      {graph.error && !graph.data && <p className="text-[14px]" style={{ color: "#a3452a" }}>Couldn&apos;t load people: {graph.error}</p>}
      {graph.data && list.length === 0 && <p className="text-[14px] text-[var(--muted)]">No one matches “{q}”.</p>}

      {GROUPS.map((g) => {
        const rows = list.filter(g.test);
        if (!rows.length) return null;
        return (
          <section key={g.key} aria-labelledby={`g-${g.key}`} className="flex flex-col gap-2">
            <h2 id={`g-${g.key}`} className="label">
              {g.label} · {rows.length}
            </h2>
            <ul className="glass p-1.5 flex flex-col">
              {rows.map((p) => (
                <li key={p.id}>
                  <Link href={`/people/${p.id}`} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 hover:bg-white/80 transition-colors">
                    <Avatar person={p} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold truncate">{p.name}</span>
                        {p.seeded && <span className="tag-demo hidden sm:inline">demo</span>}
                      </span>
                      <span className="block text-[12px] text-[var(--muted)] truncate">{[p.role, p.org].filter(Boolean).join(" · ") || "—"}</span>
                    </span>
                    <span className="hidden sm:inline text-[12px]" style={{ color: PILLAR_COLOR[primaryPillar(p)] }}>
                      {PILLAR_LABEL[primaryPillar(p)]}
                    </span>
                    <span className="hidden md:inline text-[12px] text-[var(--muted)] w-24 text-right">{p.lastContact ? timeAgo(p.lastContact) : ""}</span>
                    <IconChevron size={16} className="text-[var(--muted)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
