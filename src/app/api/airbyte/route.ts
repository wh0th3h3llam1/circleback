import { NextResponse } from "next/server";
import type { AirbyteStatus } from "@/lib/contracts";
import * as ab from "@/lib/airbyte";
import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const out: AirbyteStatus = { reachable: false, authed: false, connections: [], imported: db().airbyteImported?.length || 0 };
  if (!ab.airbyteConfigured()) return NextResponse.json({ ...out, error: "AIRBYTE_URL not set" });
  const h = await ab.health();
  out.reachable = h.ok;
  out.version = h.version;
  if (!h.ok) return NextResponse.json({ ...out, error: "Airbyte is not reachable (tunnel offline?)" });
  try {
    const conns = await ab.listConnections();
    out.authed = true;
    out.connections = await Promise.all(
      conns.map(async (c) => {
        const j = await ab.lastJob(c.connectionId).catch(() => undefined);
        return { id: c.connectionId, name: c.name, status: j?.status || c.status, lastSync: j?.startTime };
      }),
    );
  } catch (e) {
    out.error = (e as Error).message.slice(0, 200);
  }
  return NextResponse.json(out);
}
