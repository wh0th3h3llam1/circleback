import { NextResponse } from "next/server";
import { importContacts } from "@/lib/contacts";
import { ensureSeeded } from "@/lib/boot";
import { invalidateOpportunities } from "@/lib/opportunities";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST the raw LinkedIn Connections.csv (text/csv body). Same mapping as the Airbyte path, for a direct upload.
export async function POST(req: Request) {
  await ensureSeeded();
  const text = (await req.text()).replace(/^﻿/, "");
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^"?First Name"?,/.test(l));
  if (start < 0) return NextResponse.json({ error: "No 'First Name,...' header found. Upload LinkedIn's Connections.csv." }, { status: 400 });
  const table = parseCsv(lines.slice(start).join("\n"));
  const [header, ...body] = table;
  const cols = header.map((h) => h.trim());
  const rows = body.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(cols.map((c, i) => [c, (r[i] || "").trim()])));
  try {
    const r = await importContacts("linkedin_upload", cols, rows, "URL");
    invalidateOpportunities();
    return NextResponse.json({ rows: rows.length, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function parseCsv(s: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur.replace(/\r$/, ""));
      out.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    out.push(row);
  }
  return out;
}
