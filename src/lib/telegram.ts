// Telegram: capture door (bot receives notes) and send channel (intro drafts).
import { db, findPerson, save } from "./store";
import { ingest } from "./ingest";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
export const telegramEnabled = () => TOKEN.length > 0;

export async function sendMessage(chatId: number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const d = (await res.json()) as { ok: boolean; description?: string; result?: { message_id: number } };
  if (!d.ok) throw new Error(`Telegram: ${d.description}`);
  return d.result?.message_id;
}

interface Update {
  update_id: number;
  message?: { chat: { id: number }; from?: { first_name?: string; username?: string }; text?: string; voice?: unknown };
}

/** Handles one Telegram update. Called by scripts/telegram-bot.ts via POST /api/telegram. */
export async function handleUpdate(u: Update): Promise<string> {
  const m = u.message;
  if (!m) return "ignored";
  const chatId = m.chat.id;
  const text = (m.text || "").trim();
  const d = db();
  const isOwner = d.telegram.ownerChatId === chatId;

  if (text.startsWith("/start")) {
    await sendMessage(
      chatId,
      "Circleback here. Send /me to make this chat your Circleback inbox (notes you send become memories). If you're one of the contacts, send /iam <your full name> so intros can reach you.",
    );
    return "start";
  }
  if (text === "/me") {
    d.telegram.ownerChatId = chatId;
    save();
    await sendMessage(chatId, "Linked. Anything you send here is saved to your circle. Try: \"Met Lena Park from Sonance, she leads voice AI. Promised to send her our demo Friday.\"");
    return "owner";
  }
  if (text.startsWith("/iam")) {
    const name = text.replace("/iam", "").trim();
    const p = findPerson(name);
    if (!p) {
      await sendMessage(chatId, `I couldn't find "${name}" in the circle. Ask the owner to mention you first.`);
      return "iam-miss";
    }
    d.telegram.links[p.id] = chatId;
    p.telegramLinked = true;
    save();
    await sendMessage(chatId, `Thanks ${p.name.split(" ")[0]}, you're linked. Intros from your contact will arrive here.`);
    return "iam";
  }
  if (!isOwner) {
    await sendMessage(chatId, "Only the owner's notes are saved. Send /iam <your name> to receive intros.");
    return "not-owner";
  }
  if (m.voice && !text) {
    await sendMessage(chatId, "Voice notes: please send text for now (or dictate with your keyboard mic).");
    return "voice";
  }
  if (!text) return "empty";

  const r = await ingest(text, "telegram");
  const people = r.people.map((p) => p.name).join(", ") || "no one new";
  const promises = r.promises.map((p) => `• ${p.direction === "i_owe" ? "You owe" : "Owed to you"}: ${p.text}${p.due ? ` (due ${p.due})` : ""}`).join("\n");
  await sendMessage(chatId, `✅ Got it · ${r.message.pillar}\n👤 ${people}${promises ? "\n🤝 " + promises : ""}`);
  return "ingested";
}
