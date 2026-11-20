import type { TrailStep } from "./contracts";

export class Trail {
  steps: TrailStep[] = [];
  async run<T>(sponsor: TrailStep["sponsor"], label: string, fn: () => Promise<T>, detail: (r: T) => string): Promise<T> {
    const t = Date.now();
    const r = await fn();
    this.steps.push({ sponsor, label, detail: detail(r), ms: Date.now() - t, real: sponsor !== "Local" && sponsor !== "Rules" });
    return r;
  }
  /** Try a sponsor call; on failure record it and run the local fallback. */
  async tryRun<T>(
    sponsor: TrailStep["sponsor"],
    label: string,
    fn: () => Promise<T>,
    detail: (r: T) => string,
    fallback: () => T | Promise<T>,
    fallbackDetail = "fallback used",
  ): Promise<T> {
    const t = Date.now();
    try {
      const r = await fn();
      this.steps.push({ sponsor, label, detail: detail(r), ms: Date.now() - t, real: true });
      return r;
    } catch (e) {
      const r = await fallback();
      this.steps.push({ sponsor, label, detail: `${fallbackDetail}: ${(e as Error).message.slice(0, 120)}`, ms: Date.now() - t, real: false });
      return r;
    }
  }
  note(sponsor: TrailStep["sponsor"], label: string, detail: string, real = false) {
    this.steps.push({ sponsor, label, detail, ms: 0, real });
  }
}
