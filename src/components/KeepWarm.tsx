"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GraphData, Nudge, Promise as PromiseRow } from "@/lib/contracts";
import Avatar from "./Avatar";
import { usePoll } from "./hooks";
import { IconCheck } from "./icons";
import { isOverdue, postJson, shortDate } from "./ui";

/** Promises and people to circle back to, folded from the old Updates page. */
export default function KeepWarm({ graph }: { graph?: GraphData }) {
  const nudges = usePoll<Nudge[]>("/api/nudges", 15000);
  const promises = usePoll<PromiseRow[]>("/api/promises", 15000);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const people = useMemo(() => new Map((graph?.people ?? []).map((p) => [p.id, p])), [graph]);

  const promiseFor = (n: Nudge) => (promises.data ?? []).find((p) => p.status === "open" && p.personId === n.personId && n.text.includes(p.text));
  const items = (nudges.data ?? []).filter((n) => n.kind === "drift" || !kept.has(promiseFor(n)?.id ?? "")).slice(0, 5);

  const keep = async (n: Nudge) => {
    const p = promiseFor(n);
    if (!p) return;
    setBusy(p.id);
    try {
      await postJson(`/api/promises/${p.id}/keep`);
      setKept((s) => new Set(s).add(p.id));
      nudges.refresh();
      promises.refresh();
    } catch {
      /* stays open */
    } finally {
      setBusy(null);
    }
  };

  if (nudges.loading) return null;
  return (
    <section aria-labelledby="warm-h" className="flex flex-col gap-2">
      <h2 id="warm-h" className="label">
        Keep warm
      </h2>
      {items.length === 0 && (
        <p className="text-[14px]" style={{ color: "var(--green)" }}>
          ✅ All caught up
        </p>
      )}
      {items.map((n, i) => {
        const p = people.get(n.personId);
        const pr = n.kind === "promise" ? promiseFor(n) : undefined;
        const over = isOverdue(n.due);
        return (
          <div key={i} className="glass flex items-center gap-3 px-4 py-2.5 !rounded-[14px]">
            {p && <Avatar person={p} size={30} />}
            <div className="min-w-0 flex-1">
              <Link href={`/people/${n.personId}`} className="text-[13.5px] hover:underline underline-offset-4">
                {n.text}
              </Link>
              {n.due && (
                <div className="text-[12px]" style={{ color: over ? "var(--orange)" : "var(--muted)" }}>
                  {over ? "Was due" : "Due"} {shortDate(n.due)}
                </div>
              )}
            </div>
            {pr ? (
              <button type="button" className="btn !py-1.5 !px-3 text-[12px]" onClick={() => keep(n)} disabled={busy === pr.id}>
                <IconCheck size={14} /> {busy === pr.id ? "Saving…" : "Mark kept"}
              </button>
            ) : n.kind === "drift" ? (
              <Link href={`/ask?q=${encodeURIComponent(`Write a quick hello to ${p?.name ?? n.personId}`)}`} className="btn btn-green !py-1.5 !px-3 text-[12px]">
                Say hi
              </Link>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
