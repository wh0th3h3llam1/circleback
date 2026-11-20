// Airbyte (self-hosted Community 2.x) via its public API.
// Flow: Airbyte syncs a source (Slack, Gmail, Calendar, a CSV, ...) into SingleStore,
// then Circleback reads the new rows and runs each one through the normal capture pipeline.
const URL_ = (process.env.AIRBYTE_URL || "").replace(/\/$/, "");
const ID = process.env.AIRBYTE_CLIENT_ID || "";
const SECRET = process.env.AIRBYTE_CLIENT_SECRET || "";

export const airbyteConfigured = () => URL_.length > 0;
const PASSWORD = process.env.AIRBYTE_PASSWORD || "";
export const airbyteAuthConfigured = () => URL_.length > 0 && ((ID.length > 0 && SECRET.length > 0) || PASSWORD.length > 0);

const g = globalThis as unknown as { __abTok?: { token: string; exp: number } };
const baseHeaders = { "ngrok-skip-browser-warning": "1", "Content-Type": "application/json", Accept: "application/json" };

async function token(): Promise<string> {
  if (g.__abTok && g.__abTok.exp > Date.now() + 30000) return g.__abTok.token;
  let res: Response;
  if (ID && SECRET) {
    res = await fetch(`${URL_}/api/public/v1/applications/token`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ client_id: ID, client_secret: SECRET, "grant-type": "client_credentials" }),
    });
  } else {
    // abctl "simple" auth: log in as the instance's default user.
    const cfg = (await (await fetch(`${URL_}/api/v1/instance_configuration`, { headers: baseHeaders })).json()) as { defaultOrganizationEmail?: string };
    res = await fetch(`${URL_}/api/login`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ username: process.env.AIRBYTE_EMAIL || cfg.defaultOrganizationEmail || "", password: PASSWORD }),
    });
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Airbyte token ${res.status}: ${text.slice(0, 200)}`);
  if (!text) {
    // /api/login returns the JWT as an HttpOnly cookie (valid 180s).
    const jwt = res.headers.getSetCookie().map((c) => /^JWT=([^;]+)/.exec(c)?.[1]).find(Boolean);
    if (!jwt) throw new Error("Airbyte login returned no JWT cookie");
    g.__abTok = { token: jwt, exp: Date.now() + 170 * 1000 };
    return jwt;
  }
  const d = JSON.parse(text) as { access_token: string; expires_in?: number };
  g.__abTok = { token: d.access_token, exp: Date.now() + (d.expires_in || 180) * 1000 };
  return d.access_token;
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { ...baseHeaders, Authorization: `Bearer ${await token()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Airbyte ${path} ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export async function health(): Promise<{ ok: boolean; version?: string }> {
  try {
    const r = await fetch(`${URL_}/api/v1/instance_configuration`, { headers: baseHeaders, signal: AbortSignal.timeout(8000) });
    const d = (await r.json()) as { version?: string };
    return { ok: r.ok, version: d.version };
  } catch {
    return { ok: false };
  }
}

export interface AbConnection {
  connectionId: string;
  name: string;
  status: string;
  sourceId: string;
  destinationId: string;
}

export async function listConnections(): Promise<AbConnection[]> {
  const d = await api<{ data: AbConnection[] }>("GET", "/api/public/v1/connections?limit=50");
  return d.data || [];
}

export async function lastJob(connectionId: string): Promise<{ status: string; startTime?: string } | undefined> {
  const d = await api<{ data: { status: string; startTime?: string }[] }>("GET", `/api/public/v1/jobs?connectionId=${connectionId}&limit=1&orderBy=createdAt|DESC`);
  return d.data?.[0];
}

export async function startSync(connectionId: string): Promise<{ jobId: number; status: string }> {
  return api("POST", "/api/public/v1/jobs", { connectionId, jobType: "sync" });
}

export async function jobStatus(jobId: number): Promise<string> {
  const d = await api<{ status: string }>("GET", `/api/public/v1/jobs/${jobId}`);
  return d.status;
}
