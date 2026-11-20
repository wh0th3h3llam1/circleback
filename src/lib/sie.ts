// Superlinked SIE Serverless client: chat, encode, score (rerank), extract (GLiNER2).
const BASE = process.env.SIE_BASE_URL || "https://api.superlinked.com";
const KEY = process.env.SIE_API_KEY || "";

export const SIE_MODELS = {
  chat: process.env.SIE_CHAT_MODEL || "Qwen/Qwen3.8-27B-FP8",
  embed: "BAAI/bge-m3", // 1024 dims, fits SingleStore VECTOR(1024)
  rerank: "Qwen/Qwen3-Reranker-4B",
  extract: "fastino/gliner2-large-v1",
  transcribe: "openai/whisper-large-v3-turbo",
};

export const sieEnabled = () => KEY.length > 0;

// The SIE key has a concurrent-request cap, so calls go through a small queue and retry on 429/503.
const MAX_CONCURRENT = Number(process.env.SIE_CONCURRENCY || 2);
let active = 0;
const waiting: (() => void)[] = [];
async function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((r) => waiting.push(r));
  active++;
}
function release() {
  active--;
  waiting.shift()?.();
}

async function post<T>(path: string, body: unknown, timeoutMs = 45000): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await acquire();
    try {
      return await postOnce<T>(path, body, timeoutMs);
    } catch (e) {
      const msg = (e as Error).message;
      if (attempt < 3 && /\b(429|503)\b/.test(msg)) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      throw e;
    } finally {
      release();
    }
  }
}

async function postOnce<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`SIE ${path} ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function chat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { maxTokens?: number; model?: string; temperature?: number } = {},
): Promise<string> {
  const d = await post<{ choices: { message: { content: string } }[] }>("/v1/chat/completions", {
    model: opts.model || SIE_MODELS.chat,
    messages,
    max_tokens: opts.maxTokens ?? 600,
    temperature: opts.temperature ?? 0.2,
  });
  return (d.choices?.[0]?.message?.content || "").trim();
}

/** Chat that must return JSON; strips code fences / think blocks and parses the first {...}. */
export async function chatJson<T>(system: string, user: string, maxTokens = 700): Promise<T> {
  const raw = await chat(
    [
      { role: "system", content: system + "\nReply with a single JSON object only. No prose, no code fences." },
      { role: "user", content: user },
    ],
    { maxTokens, temperature: 0 },
  );
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(json)?/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("SIE chat returned no JSON: " + raw.slice(0, 200));
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const d = await post<{ items: { dense: { values: number[] } }[] }>(`/v1/encode/${SIE_MODELS.embed}`, {
    items: texts.map((text) => ({ text: text.slice(0, 4000) })),
  });
  return d.items.map((i) => i.dense.values);
}

/** Rerank: returns a relevance score per doc, in the same order as docs. */
export async function rerank(query: string, docs: string[]): Promise<number[]> {
  if (docs.length === 0) return [];
  const d = await post<{ scores: { item_id: string; score: number }[] }>(`/v1/score/${SIE_MODELS.rerank}`, {
    query: { text: query },
    items: docs.map((text, i) => ({ id: `item-${i}`, text: text.slice(0, 3000) })),
  });
  const out = new Array(docs.length).fill(0);
  for (const s of d.scores) {
    const idx = Number(String(s.item_id).replace("item-", ""));
    if (!Number.isNaN(idx)) out[idx] = s.score;
  }
  return out;
}

export interface Entity {
  text: string;
  label: string;
  score: number;
}

export async function extractEntities(text: string, labels: string[]): Promise<Entity[]> {
  const d = await post<{ items: { entities: Entity[] }[] }>(`/v1/extract/${SIE_MODELS.extract}`, {
    items: [{ text }],
    params: { labels },
  });
  return d.items?.[0]?.entities || [];
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
