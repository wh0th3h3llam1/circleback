import type { Person, Pillar, Tier } from "@/lib/contracts";

export const PILLARS: Pillar[] = ["work", "career", "projects", "family"];

export const PILLAR_COLOR: Record<Pillar, string> = {
  work: "#3E8E86",
  career: "#C9A24A",
  projects: "#8A9A4B",
  family: "#B5523B",
};

export const PILLAR_LABEL: Record<Pillar, string> = {
  work: "Work",
  career: "Career",
  projects: "Projects",
  family: "Family",
};

export const TIER_LABEL: Record<Tier, string> = {
  inner: "Inner",
  close: "Close",
  good: "Good",
  known: "Known",
};

export function tierLabel(p: Person): string {
  return p.met ? TIER_LABEL[p.tier] : "2nd degree";
}

export function primaryPillar(p: Person): Pillar {
  return p.pillars[0] ?? "work";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function hash01(s: string, salt = 0): number {
  let h = 5381 + salt * 7919;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 10007) / 10007;
}

// Globe layout: each pillar owns a longitude band; closeness tier sets the latitude band.
export const GLOBE_R = 6;
export const PILLAR_LON: Record<Pillar, number> = {
  work: 0,
  career: Math.PI / 2,
  projects: Math.PI,
  family: (3 * Math.PI) / 2,
};
const TIER_LAT: Record<Tier, number> = { inner: 0.1, close: 0.42, good: 0.72, known: 1.0 };

export function sph(lat: number, lon: number, r: number): [number, number, number] {
  return [r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(lon)];
}

export function globePos(p: Person): [number, number, number] {
  if (p.id === "me") return [0, 0, 0];
  const pillar = primaryPillar(p);
  const lon = PILLAR_LON[pillar] + (hash01(p.id) - 0.5) * 1.15;
  const sign = hash01(p.id, 5) > 0.5 ? 1 : -1;
  if (!p.met) {
    const lat = sign * (0.25 + hash01(p.id, 2) * 0.7);
    return sph(lat, lon, GLOBE_R + 1.1);
  }
  const lat = sign * (TIER_LAT[p.tier] + (hash01(p.id, 3) - 0.5) * 0.18);
  return sph(lat, lon, GLOBE_R);
}

export function hubPos(p: Pillar): [number, number, number] {
  return sph(0, PILLAR_LON[p], 2.6);
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const text = await res.text();
  let body: unknown = undefined;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    /* non-json */
  }
  if (!res.ok) {
    const msg = (body as { error?: string } | undefined)?.error || `${res.status} ${res.statusText}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export function postJson<T>(url: string, data?: unknown, method = "POST"): Promise<T> {
  return getJson<T>(url, { method, body: data === undefined ? undefined : JSON.stringify(data) });
}

export function timeAgo(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const d = Math.round((Date.now() - t) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

export function shortDate(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  if (Number.isNaN(t.getTime())) return "";
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isOverdue(due?: string): boolean {
  if (!due) return false;
  return new Date(due + (due.length === 10 ? "T23:59:59" : "")).getTime() < Date.now();
}

export const LAST_ANSWER_KEY = "cb:lastAnswer";
