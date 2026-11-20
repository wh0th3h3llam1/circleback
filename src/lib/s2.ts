// SingleStore: hybrid search over messages (vector + full text), people tiers, promise ledger, audit log.
// Enabled when SINGLESTORE_HOST and SINGLESTORE_PASSWORD are set; otherwise callers use the local store.
import mysql from "mysql2/promise";
import type { Message, Person, Promise as PromiseRow } from "./contracts";

const g = globalThis as unknown as { __s2pool?: mysql.Pool; __s2ready?: Promise<void> };

export const s2Enabled = () => !!(process.env.SINGLESTORE_HOST && process.env.SINGLESTORE_PASSWORD);
const DB = process.env.SINGLESTORE_DATABASE || "circleback";

function pool(): mysql.Pool {
  if (!g.__s2pool) {
    g.__s2pool = mysql.createPool({
      host: process.env.SINGLESTORE_HOST,
      port: Number(process.env.SINGLESTORE_PORT || 3306),
      user: process.env.SINGLESTORE_USER || "admin",
      password: process.env.SINGLESTORE_PASSWORD,
      ssl: { rejectUnauthorized: true },
      connectionLimit: 4,
      multipleStatements: false,
    });
  }
  return g.__s2pool;
}

export async function ensureSchema(): Promise<void> {
  if (!g.__s2ready) {
    g.__s2ready = (async () => {
      const p = pool();
      await p.query(`CREATE DATABASE IF NOT EXISTS ${DB}`);
      await p.query(`CREATE TABLE IF NOT EXISTS ${DB}.messages (
        id VARCHAR(64) PRIMARY KEY, source VARCHAR(16), pillar VARCHAR(16), text TEXT,
        person_ids JSON, ts DATETIME, seeded BOOL, embedding VECTOR(1024),
        FULLTEXT USING VERSION 2 ft_text (text))`);
      await p.query(`CREATE TABLE IF NOT EXISTS ${DB}.people (
        id VARCHAR(64) PRIMARY KEY, name VARCHAR(128), org VARCHAR(128), role VARCHAR(128),
        tier VARCHAR(8), points DOUBLE, met BOOL, last_contact DATETIME, pillars JSON, topics JSON)`);
      await p.query(`CREATE TABLE IF NOT EXISTS ${DB}.promises (
        id VARCHAR(64) PRIMARY KEY, person_id VARCHAR(64), text TEXT, direction VARCHAR(12),
        due DATE NULL, status VARCHAR(8), source_message_id VARCHAR(64))`);
      await p.query(`CREATE TABLE IF NOT EXISTS ${DB}.audit_log (
        id BIGINT AUTO_INCREMENT PRIMARY KEY, ts DATETIME DEFAULT NOW(), kind VARCHAR(16), payload JSON)`);
    })().catch((e) => {
      g.__s2ready = undefined;
      throw e;
    });
  }
  return g.__s2ready;
}

const dt = (iso?: string) => (iso ? iso.slice(0, 19).replace("T", " ") : null);

export async function upsertMessage(m: Message, vec?: number[]) {
  await ensureSchema();
  await pool().query(
    `REPLACE INTO ${DB}.messages (id, source, pillar, text, person_ids, ts, seeded, embedding) VALUES (?,?,?,?,?,?,?,?)`,
    [m.id, m.source, m.pillar, m.text, JSON.stringify(m.personIds), dt(m.ts), m.seeded, vec ? JSON.stringify(vec) : null],
  );
}

/** Bulk write for large imports (hundreds of rows per statement). */
export async function bulkUpsertMessages(msgs: Message[], vecs: (number[] | undefined)[]) {
  await ensureSchema();
  for (let i = 0; i < msgs.length; i += 100) {
    const chunk = msgs.slice(i, i + 100);
    const vals = chunk.flatMap((m, j) => [m.id, m.source, m.pillar, m.text, JSON.stringify(m.personIds), dt(m.ts), m.seeded, vecs[i + j] ? JSON.stringify(vecs[i + j]) : null]);
    await pool().query(`REPLACE INTO ${DB}.messages (id, source, pillar, text, person_ids, ts, seeded, embedding) VALUES ${chunk.map(() => "(?,?,?,?,?,?,?,?)").join(",")}`, vals);
  }
}

export async function bulkUpsertPeople(people: Person[]) {
  await ensureSchema();
  for (let i = 0; i < people.length; i += 200) {
    const chunk = people.slice(i, i + 200);
    const vals = chunk.flatMap((p) => [p.id, p.name, p.org || null, p.role || null, p.tier, p.points, p.met, dt(p.lastContact), JSON.stringify(p.pillars), JSON.stringify(p.topics)]);
    await pool().query(`REPLACE INTO ${DB}.people (id, name, org, role, tier, points, met, last_contact, pillars, topics) VALUES ${chunk.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",")}`, vals);
  }
}

export async function upsertPeople(people: Person[]) {
  await ensureSchema();
  for (const p of people) {
    await pool().query(
      `REPLACE INTO ${DB}.people (id, name, org, role, tier, points, met, last_contact, pillars, topics) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [p.id, p.name, p.org || null, p.role || null, p.tier, p.points, p.met, dt(p.lastContact), JSON.stringify(p.pillars), JSON.stringify(p.topics)],
    );
  }
}

export async function upsertPromises(rows: PromiseRow[]) {
  await ensureSchema();
  for (const r of rows) {
    await pool().query(
      `REPLACE INTO ${DB}.promises (id, person_id, text, direction, due, status, source_message_id) VALUES (?,?,?,?,?,?,?)`,
      [r.id, r.personId, r.text, r.direction, r.due ? r.due.slice(0, 10) : null, r.status, r.sourceMessageId],
    );
  }
}

export async function audit(kind: string, payload: unknown) {
  await ensureSchema();
  await pool().query(`INSERT INTO ${DB}.audit_log (kind, payload) VALUES (?, ?)`, [kind, JSON.stringify(payload)]);
}

export interface Hit {
  id: string;
  score: number;
  vs: number;
  ft: number;
}

/** Hybrid search: dot product on bge-m3 vectors blended with BM25 full-text score. */
export async function hybridSearch(vec: number[], text: string, pillars: string[], limit = 8): Promise<{ hits: Hit[]; sql: string }> {
  await ensureSchema();
  const terms = text.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter((w) => w.length > 2).join(" ");
  const sql = `SELECT id, DOT_PRODUCT(embedding, ? :> VECTOR(1024)) AS vs,
      MATCH (TABLE messages) AGAINST (?) AS ft
    FROM ${DB}.messages WHERE pillar IN (${pillars.map(() => "?").join(",")}) AND embedding IS NOT NULL
    ORDER BY 0.75 * vs + 0.25 * LEAST(ft, 10) / 10 DESC LIMIT ${limit}`;
  try {
    const [rows] = await pool().query(sql, [JSON.stringify(vec), terms || text, ...pillars]);
    const hits = (rows as { id: string; vs: number; ft: number }[]).map((r) => ({
      id: r.id,
      vs: Number(r.vs),
      ft: Number(r.ft) || 0,
      score: 0.75 * Number(r.vs) + 0.25 * Math.min(Number(r.ft) || 0, 10) / 10,
    }));
    return { hits, sql: "DOT_PRODUCT(vector) + MATCH AGAINST(full-text v2)" };
  } catch {
    // Full-text index may still be building on a brand-new table: fall back to vector only.
    const vsql = `SELECT id, DOT_PRODUCT(embedding, ? :> VECTOR(1024)) AS vs FROM ${DB}.messages
      WHERE pillar IN (${pillars.map(() => "?").join(",")}) AND embedding IS NOT NULL ORDER BY vs DESC LIMIT ${limit}`;
    const [rows] = await pool().query(vsql, [JSON.stringify(vec), ...pillars]);
    const hits = (rows as { id: string; vs: number }[]).map((r) => ({ id: r.id, vs: Number(r.vs), ft: 0, score: Number(r.vs) }));
    return { hits, sql: "DOT_PRODUCT(vector) only (full-text index warming)" };
  }
}

export async function dueNudges(): Promise<{ promises: { id: string; person_id: string; text: string; due: string | null; direction: string }[]; drift: { id: string; name: string; tier: string; days: number }[] }> {
  await ensureSchema();
  const [pr] = await pool().query(
    `SELECT id, person_id, text, DATE_FORMAT(due, '%Y-%m-%d') AS due, direction FROM ${DB}.promises
     WHERE status = 'open' AND (due IS NULL OR due <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)) ORDER BY due IS NULL, due LIMIT 6`,
  );
  const [dr] = await pool().query(
    `SELECT id, name, tier, DATEDIFF(NOW(), last_contact) AS days FROM ${DB}.people
     WHERE met = 1 AND id <> 'me' AND ((tier = 'inner' AND last_contact < NOW() - INTERVAL 14 DAY) OR (tier = 'close' AND last_contact < NOW() - INTERVAL 21 DAY))
     ORDER BY days DESC LIMIT 4`,
  );
  return { promises: pr as never, drift: dr as never };
}

/** Raw rows of an Airbyte-synced table (columns as Airbyte wrote them). */
export async function tableRows(table: string, limit = 2000): Promise<{ cols: string[]; keyCol?: string; rows: Record<string, unknown>[] }> {
  await ensureSchema();
  if (!/^[A-Za-z0-9_]+$/.test(table)) throw new Error("bad table name");
  const [cols] = await pool().query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`, [DB, table]);
  const names = (cols as { COLUMN_NAME: string }[]).map((c) => c.COLUMN_NAME);
  if (!names.length) throw new Error(`table ${DB}.${table} not found (has Airbyte synced yet?)`);
  const keyCol = ["_airbyte_raw_id", "_airbyte_ab_id"].find((c) => names.includes(c));
  const [rows] = await pool().query(`SELECT * FROM ${DB}.\`${table}\` LIMIT ${limit}`);
  return { cols: names, keyCol, rows: rows as Record<string, unknown>[] };
}

/** Rows that Airbyte synced into SingleStore. Finds a text-like column so any source (Slack, Gmail, CSV) works. */
export async function airbyteRows(table: string, limit = 25): Promise<{ key: string; text: string }[]> {
  await ensureSchema();
  if (!/^[A-Za-z0-9_]+$/.test(table)) throw new Error("bad table name");
  const [cols] = await pool().query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`, [DB, table]);
  const names = (cols as { COLUMN_NAME: string }[]).map((c) => c.COLUMN_NAME);
  if (!names.length) throw new Error(`table ${DB}.${table} not found (has Airbyte synced yet?)`);
  const textCol = ["text", "body", "snippet", "message", "content", "summary", "description", "notes", "_airbyte_data"].find((c) => names.includes(c));
  const keyCol = ["_airbyte_raw_id", "_airbyte_ab_id", "id", "ts", "client_msg_id"].find((c) => names.includes(c));
  if (!textCol) {
    // Tabular sources (CSV contacts, Sheets, Calendar): turn each row into a sentence of "column: value" pairs.
    const useful = names.filter((c) => !c.startsWith("_airbyte")).slice(0, 12);
    const [rows] = await pool().query(`SELECT ${[keyCol, ...useful].filter(Boolean).map((c) => "`" + c + "`").join(", ")} FROM ${DB}.\`${table}\` LIMIT ${limit}`);
    return (rows as Record<string, unknown>[]).map((r, i) => ({
      key: String(keyCol ? r[keyCol] : `${table}-${i}`),
      text: `Contact imported from ${table}: ` + useful.map((c) => (r[c] ? `${c.replace(/_/g, " ")}: ${String(r[c])}` : "")).filter(Boolean).join("; "),
    }));
  }
  const extra = ["user_name", "name", "from", "sender", "summary", "start", "attendees", "channel_name"].filter((c) => names.includes(c) && c !== textCol);
  const [rows] = await pool().query(
    `SELECT ${[keyCol, textCol, ...extra].filter(Boolean).map((c) => "`" + c + "`").join(", ")} FROM ${DB}.\`${table}\` LIMIT ${limit}`,
  );
  return (rows as Record<string, unknown>[]).map((r, i) => {
    const raw = r[textCol];
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const ctx = extra.map((c) => (r[c] ? `${c}: ${typeof r[c] === "string" ? r[c] : JSON.stringify(r[c])}` : "")).filter(Boolean).join(" · ");
    return { key: String(keyCol ? r[keyCol] : `${table}-${i}`), text: ctx ? `${text}\n(${ctx})` : text };
  });
}

/** Demo reset: empties Orbit's own tables (never touches tables Airbyte writes). */
export async function clearCore() {
  await ensureSchema();
  for (const t of ["messages", "people", "promises"]) await pool().query(`TRUNCATE TABLE ${DB}.${t}`);
}

export async function ping(): Promise<boolean> {
  try {
    await pool().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
