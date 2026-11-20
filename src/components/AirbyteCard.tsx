"use client";

import { useState } from "react";
import type { AirbyteStatus, TrailStep } from "@/lib/contracts";
import { usePoll } from "./hooks";
import { IconSync } from "./icons";
import { postJson, timeAgo } from "./ui";
import { Trail } from "./Why";

export default function AirbyteCard({ onSynced }: { onSynced?: () => void }) {
  const airbyte = usePoll<AirbyteStatus>("/api/airbyte", 30000);
  const [sync, setSync] = useState<{ busy: boolean; msg?: string; trail?: TrailStep[] }>({ busy: false });

  const runSync = async () => {
    setSync({ busy: true });
    try {
      const r = await postJson<{ started: string[]; imported: number; trail: TrailStep[] }>("/api/airbyte/sync");
      setSync({ busy: false, msg: `Synced ${r.started.length} connection${r.started.length === 1 ? "" : "s"} · imported ${r.imported}`, trail: r.trail });
      airbyte.refresh();
      onSynced?.();
    } catch (e) {
      setSync({ busy: false, msg: (e as Error).message });
    }
  };

  const d = airbyte.data;
  return (
    <section aria-labelledby="airbyte-h" className="glass p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 id="airbyte-h" className="text-[16px] font-semibold">
          LinkedIn via Airbyte
        </h2>
        {d && (
          <span className="chip !text-[11px]" style={d.authed ? { color: "var(--green)" } : undefined}>
            {d.authed ? `connected${d.version ? ` · v${d.version}` : ""}` : d.reachable ? "needs credentials" : "unreachable"}
          </span>
        )}
        <button type="button" className="btn btn-dark !py-1.5 !px-3 text-[12px] ml-auto" onClick={runSync} disabled={sync.busy || !d?.authed}>
          <IconSync size={14} /> {sync.busy ? "Syncing…" : "Sync now"}
        </button>
      </div>
      <p className="text-[13px] text-[var(--muted)]">
        Your LinkedIn Connections export syncs through Airbyte into SingleStore, then each contact lands in your brain.
      </p>
      {airbyte.loading && <p className="text-[13px] text-[var(--muted)]">Checking Airbyte…</p>}
      {airbyte.error && <p className="text-[13px] text-[var(--muted)]">Airbyte status unavailable: {airbyte.error}</p>}
      {d?.error && <p className="text-[12px] text-[var(--muted)]">{d.error}</p>}
      {d &&
        (d.connections.length > 0 ? (
          <ul className="flex flex-col gap-1 text-[13px]">
            {d.connections.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span>{c.name}</span>
                <span className="text-[var(--muted)]">
                  {c.status}
                  {c.lastSync ? ` · ${timeAgo(c.lastSync)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[var(--muted)]">No Airbyte connections yet. Add the LinkedIn sheet as a source in Airbyte.</p>
        ))}
      {d && <p className="text-[12px] text-[var(--muted)]">{d.imported} items imported so far</p>}
      {sync.msg && (
        <p className="text-[13px]" role="status">
          {sync.msg}
        </p>
      )}
      {sync.trail && <Trail steps={sync.trail} />}
    </section>
  );
}
