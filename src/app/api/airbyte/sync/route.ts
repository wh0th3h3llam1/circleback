import { NextResponse } from "next/server";
import type { TrailStep } from "@/lib/contracts";
import * as ab from "@/lib/airbyte";
import * as s2 from "@/lib/s2";
import { db, save } from "@/lib/store";
import { ingest } from "@/lib/ingest";
import { contactColumns, importContacts } from "@/lib/contacts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Starts a sync on every Airbyte connection, waits briefly, then imports new rows that Airbyte
// wrote into SingleStore (table from AIRBYTE_IMPORT_TABLES, comma separated) through the capture pipeline.
export async function POST() {
  const trail: TrailStep[] = [];
  const started: string[] = [];
  let imported = 0;
  try {
    const conns = await ab.listConnections();
    for (const c of conns) {
      const t = Date.now();
      const job = await ab.startSync(c.connectionId);
      started.push(c.name);
      let status = job.status;
      for (let i = 0; i < 40 && ["pending", "running", "incomplete"].includes(status); i++) {
        await new Promise((r) => setTimeout(r, 3000));
        status = await ab.jobStatus(job.jobId);
      }
      trail.push({ sponsor: "Airbyte", label: `sync · ${c.name}`, detail: `job ${job.jobId} → ${status}`, ms: Date.now() - t, real: true });
    }
    const tables = (process.env.AIRBYTE_IMPORT_TABLES || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (s2.s2Enabled() && tables.length) {
      const d = db();
      d.airbyteImported = d.airbyteImported || [];
      for (const table of tables) {
        const t = Date.now();
        // Structured contacts (LinkedIn export, Sheets): map columns straight to people.
        const raw = await s2.tableRows(table);
        if (contactColumns(raw.cols).ok) {
          trail.push({ sponsor: "SingleStore", label: `read · ${table}`, detail: `${raw.rows.length} rows Airbyte synced`, ms: Date.now() - t, real: true });
          const r = await importContacts(table, raw.cols, raw.rows, raw.keyCol);
          imported += r.imported;
          trail.push(...r.trail);
          continue;
        }
        const rows = await s2.airbyteRows(table, 30);
        const fresh = rows.filter((r) => !d.airbyteImported!.includes(`${table}:${r.key}`) && r.text.trim().length > 10).slice(0, 8);
        for (const r of fresh) {
          await ingest(r.text.slice(0, 1500), "slack");
          d.airbyteImported.push(`${table}:${r.key}`);
          imported++;
        }
        save();
        trail.push({ sponsor: "SingleStore", label: `read · ${table}`, detail: `${rows.length} Airbyte rows, ${fresh.length} new imported`, ms: Date.now() - t, real: true });
      }
    }
    return NextResponse.json({ started, imported, trail });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, started, imported, trail }, { status: 502 });
  }
}
