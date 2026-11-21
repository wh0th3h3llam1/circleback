// Long-polls Telegram and forwards each update to the Next.js app (single writer).
// Run: pnpm bot   (needs the app running on APP_URL, default http://localhost:3000)
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP = process.env.APP_URL || "http://localhost:3000";
const SECRET = process.env.BOT_SECRET || "local-bot";
if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing");

async function main() {
  let offset = 0;
  // Make sure no webhook is set, otherwise getUpdates returns 409.
  await fetch(`https://api.telegram.org/bot${TOKEN}/deleteWebhook`);
  console.log("Orbit bot polling…");
  for (;;) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=25&offset=${offset}`);
      const d = (await r.json()) as { ok: boolean; result: { update_id: number }[] };
      for (const u of d.result || []) {
        offset = u.update_id + 1;
        const res = await fetch(`${APP}/api/telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-bot-secret": SECRET },
          body: JSON.stringify(u),
        });
        console.log(new Date().toISOString(), u.update_id, res.status, (await res.text()).slice(0, 120));
      }
    } catch (e) {
      console.error("poll error", (e as Error).message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
main();
export {};
