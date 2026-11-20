// One-time Airbyte setup: SingleStore destination (via Airbyte's MySQL connector, SingleStore speaks the MySQL protocol),
// a File source reading a contacts CSV over HTTPS, and a manual-sync connection between them.
// Run: CSV_URL=https://.../linkedin_connections.csv pnpm exec tsx --env-file=.env.local scripts/airbyte-setup.ts
const U = process.env.AIRBYTE_URL!;
const CSV_URL = process.env.CSV_URL;
const h: Record<string, string> = { "ngrok-skip-browser-warning": "1", "Content-Type": "application/json" };

async function call(method: string, path: string, body?: unknown) {
  const r = await fetch(`${U}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${t.slice(0, 400)}`);
  return t ? JSON.parse(t) : {};
}

(async () => {
  const cfg = await call("GET", "/api/v1/instance_configuration");
  const login = await fetch(`${U}/api/login`, { method: "POST", headers: h, body: JSON.stringify({ username: cfg.defaultOrganizationEmail, password: process.env.AIRBYTE_PASSWORD }) });
  h.Authorization = "Bearer " + login.headers.getSetCookie().map((c) => /^JWT=([^;]+)/.exec(c)?.[1]).find(Boolean);
  const ws = (await call("GET", "/api/public/v1/workspaces")).data[0].workspaceId;
  console.log("workspace", ws);

  const dests = (await call("GET", "/api/public/v1/destinations")).data as { destinationId: string; name: string }[];
  let destId = dests.find((d) => d.name === "SingleStore (Orbit)")?.destinationId;
  if (!destId) {
    destId = (
      await call("POST", "/api/public/v1/destinations", {
        name: "SingleStore (Orbit)",
        workspaceId: ws,
        configuration: {
          destinationType: "mysql",
          host: process.env.SINGLESTORE_HOST,
          port: 3306,
          database: process.env.SINGLESTORE_DATABASE,
          username: process.env.SINGLESTORE_USER,
          password: process.env.SINGLESTORE_PASSWORD,
          ssl: true,
          tunnel_method: { tunnel_method: "NO_TUNNEL" },
        },
      })
    ).destinationId;
  }
  console.log("destination", destId);
  const chk = await call("POST", "/api/v1/destinations/check_connection", { destinationId: destId });
  console.log("destination check:", chk.status, chk.message || "");

  if (!CSV_URL) return console.log("Set CSV_URL to create the File source + connection.");
  const srcs = (await call("GET", "/api/public/v1/sources")).data as { sourceId: string; name: string }[];
  let srcId = srcs.find((s) => s.name === "Contacts CSV (Orbit)")?.sourceId;
  if (!srcId) {
    srcId = (
      await call("POST", "/api/public/v1/sources", {
        name: "Contacts CSV (Orbit)",
        workspaceId: ws,
        configuration: { sourceType: "file", dataset_name: "linkedin_connections", format: "csv", url: CSV_URL, provider: { storage: "HTTPS", user_agent: false } },
      })
    ).sourceId;
  }
  console.log("source", srcId);
  const conns = (await call("GET", "/api/public/v1/connections")).data as { connectionId: string; name: string }[];
  let connId = conns.find((c) => c.name === "Contacts CSV → SingleStore")?.connectionId;
  if (!connId) {
    connId = (
      await call("POST", "/api/public/v1/connections", {
        name: "Contacts CSV → SingleStore",
        sourceId: srcId,
        destinationId: destId,
        schedule: { scheduleType: "manual" },
        namespaceDefinition: "destination",
      })
    ).connectionId;
  }
  console.log("connection", connId, "→ set AIRBYTE_IMPORT_TABLES=linkedin_connections and press Sync now in Updates");
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
